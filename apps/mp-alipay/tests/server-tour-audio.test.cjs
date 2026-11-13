const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId, plain } = require('./harness.cjs');

const roomId = '9223372036854775806', routeId = '9223372036854775805', visitId = '9223372036854775804';
const stageIds = ['9223372036854775803', '9223372036854775802'];
function interruptionEvents(fixture) {
  const events = {};
  fixture.my.onAudioInterruptionBegin = callback => { events.begin = callback; };
  fixture.my.onAudioInterruptionEnd = callback => { events.end = callback; };
  fixture.load('services/audio-interruption').init();
  return events;
}
function setup(context, realRoom = false, following = false, realLocation = false) {
  const fixture = harness(), manager = fixture.my.createInnerAudioContext();
  fixture.audioContexts.length = 0;
  let assignments = 0;
  Object.defineProperty(manager, 'src', { set(value) { this.url = value; this.currentTime = 0; assignments++; this.play(); } });
  fixture.my.getBackgroundAudioManager = () => manager;
  fixture.load('config').diagnostics = false;
  const room = { room: { roomId, status: 'paused', isHost: false }, following, disconnected: false };
  const translation = fixture.load('services/translation-session');
  if (realRoom) {
    fixture.load('services/translation-room').connect = () => ({ close() {}, yieldToTour() {} });
    translation.attach(room.room, 'zh');
    if (realLocation) translation.event({ type: 'subscription.ready', payload: { room: room.room } });
    translation.setFollowing(following);
  } else translation.snapshot = () => room;
  if (!realLocation) fixture.load('services/location').watch = () => () => {};
  const page = fixture.page('tour');
  const visit = { visitId, routeId, status: 1, currentStageId: null, visitedStageIds: [], completedStageIds: [] };
  const stops = stageIds.map((id, index) => ({ id, name: '节点' + index, order: index, images: [], extraAudios: [],
    guideNarrations: [{ guideId: '9223372036854775801', locale: 'zh', chapters: [{ id: 'chapter' + index, audioUrl: 'https://media.test/' + index + '.mp3' }] }] }));
  page._rev = 0; page._user = userId; page._visible = true; page._places = [];
  if (realLocation) page._routeMatcher = fixture.load('core/route-location').createRouteMatcher({ enabled: false });
  page.setData({ route: { id: routeId }, stops, visit, tourStage: 'navigation', autoplay: true, locationEnabled: true });
  page.showStop(0, true);
  let state = { sessionId: 'session-1', streamId: 'stream-1', revision: 1, status: 'streaming', visitId, routeId,
    stageId: null, paused: false, held: false, queue: [], visit, itemTimeSeconds: 0, itemDurationSeconds: 2 };
  const service = fixture.load('services/tour-audio-session');
  context.after(() => { if (page._watch) page._watch(); service.stop(); if (page._serverSubscription) page._serverSubscription(); });
  async function start() {
    page.startNextSequence();
    assert.match(fixture.requests[0].options.url, /TourAudioSessions$/);
    assert.deepEqual(plain(fixture.requests[0].options.data), { roomId, routeId, visitId, guideId: '9223372036854775801',
      startStageId: null, language: 'zh', skipExtra: false, autoplay: true, following, roomMuted: false, paused: false, lockContent: false });
    fixture.requests[0].ok({ sessionId: state.sessionId, mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state });
    await tick();
  }
  function reply(request, changes = {}) { state = { ...state, ...changes, revision: state.revision + 1 }; request.ok(state); }
  return { fixture, manager, page, service, translation, room, start, reply, state: () => state, assignments: () => assignments };
}

test('normal navigation creates one continuous media session and excludes local arrival/completion writes', async context => {
  const { fixture, page, service, start, assignments } = setup(context);
  await start();
  assert.equal(service.active(), true);
  assert.equal(assignments(), 1);
  page.startNextSequence(); page.recordPrerequisiteArrival(stageIds[0]); page.complete(2);
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.load('services/audio').snapshot().live, true);
  assert.equal(fixture.audioContexts.length, 0);
});

test('system interruption pauses the server and end or foreground polling cannot automatically resume it', async context => {
  const { fixture, manager, page, service, start, reply, assignments } = setup(context, false, true);
  const events = interruptionEvents(fixture);
  await start();
  events.begin(); await tick();
  assert.equal(service.snapshot().pausedIntent, true);
  assert.equal(service.diagnostics().phase, 'interrupted');
  assert.equal(fixture.requests[1].options.data.command, 'pause');
  reply(fixture.requests[1], { paused: true }); await tick();
  page.retryAudio();
  assert.equal(fixture.requests.length, 2);
  events.end();
  manager.emit('Play'); manager.emit('Error', { errorMessage: 'audio focus lost' });
  const pending = service.refresh();
  reply(fixture.requests[2], { paused: false, status: 'disconnected' }); await pending;
  await service.setPaused(false); await service.release();
  assert.equal(fixture.requests.length, 3);
  assert.equal(assignments(), 1);
  assert.equal(service.diagnostics().recoveryAttempts, 0);
  assert.equal(fixture.load('services/audio').snapshot().playing, false);
  assert.equal(page.data.audioError, '');
  assert.match(page.data.followStatus, /点击重新连接/);
});

test('explicit reconnect after a system interruption realigns before acquiring audio again', async context => {
  const { fixture, page, service, start, reply, assignments } = setup(context, false, true);
  const events = interruptionEvents(fixture);
  await start(); events.begin(); await tick();
  reply(fixture.requests[1], { paused: true }); await tick();
  events.end(); page.retryAudio(); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'realign');
  reply(fixture.requests[2], { paused: false, held: false, stageId: null, itemId: null, queue: [] }); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'resume');
  reply(fixture.requests[3]); await tick();
  assert.equal(fixture.requests[4].options.data.command, 'reconnect');
  reply(fixture.requests[4], { status: 'disconnected' }); await tick();
  assert.equal(assignments(), 2);
  assert.equal(service.snapshot().interruption.resumeRequired, false);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
});

test('interruption during creation prevents its late media source from starting', async context => {
  const { fixture, page, service, state, assignments } = setup(context, false, true);
  const events = interruptionEvents(fixture);
  page.startNextSequence(); events.begin(); events.end();
  fixture.requests[0].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state: state() });
  await tick();
  assert.equal(assignments(), 0);
  assert.equal(service.snapshot().pausedIntent, true);
  assert.equal(fixture.requests[1].options.data.command, 'pause');
  assert.equal(service.diagnostics().phase, 'interrupted');
});

test('a call starting during reconnect invalidates the late response and keeps the source paused', async context => {
  const { fixture, manager, service, start, reply, assignments } = setup(context, false, true);
  const events = interruptionEvents(fixture);
  await start();
  manager.emit('Error', { errorMessage: 'temporary failure' });
  const resumed = service.setPaused(false); await tick();
  reply(fixture.requests[1]); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'reconnect');
  events.begin();
  reply(fixture.requests[2], { status: 'disconnected' }); await resumed; await tick();
  assert.equal(fixture.requests[3].options.data.command, 'pause');
  reply(fixture.requests[3], { paused: true }); await tick(); events.end();
  assert.equal(assignments(), 1);
  assert.equal(service.snapshot().pausedIntent, true);
  assert.equal(fixture.load('services/audio').snapshot().playing, false);
});

test('interruption does not permanently mute the driver room inside a continuous audio session', async context => {
  const { fixture, service, translation, start } = setup(context, true, true);
  const events = interruptionEvents(fixture);
  await start(); events.begin(); await tick(); events.end();
  assert.equal(translation.snapshot().paused, false);
  assert.equal(service.snapshot().pausedIntent, true);
  assert.ok(!fixture.requests.some(request => request.options.data?.command === 'room-mute'));
});

test('disabling screen-off listening pauses a pending session before its late source can autoplay', async context => {
  const { fixture, page, service, state, reply } = setup(context, false, true);
  fixture.load('app');
  page.toggleScreenOffListening();
  page.startNextSequence();
  fixture.app.onHide();
  assert.equal(service.snapshot().pausedIntent, true);
  fixture.requests[0].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state: state() });
  await tick();
  assert.equal(fixture.load('services/audio').snapshot().playing, false);
  assert.equal(fixture.requests[1].options.data.command, 'pause');
  reply(fixture.requests[1], { paused: true }); await tick();
  const count = fixture.requests.length;
  await service.setPaused(false); await service.release();
  assert.equal(fixture.requests.length, count);
  fixture.app.onShow();
  assert.equal(service.snapshot().pausedIntent, true);
  assert.equal(fixture.load('services/audio').snapshot().playing, false);
});

test('new server node updates the screen without replacing or stopping the live player', async context => {
  const { fixture, page, service, start, reply, assignments } = setup(context);
  await start();
  const pending = service.refresh();
  reply(fixture.requests[1], { stageId: stageIds[1], itemId: 'chapter1', itemTitle: '第二站',
    queue: [{ stageId: stageIds[1], status: 'playing' }] });
  await pending;
  assert.equal(page.data.stop.id, stageIds[1]);
  assert.equal(page.data.selectionMode, 'formal');
  assert.equal(assignments(), 1);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
});

test('hiding and losing the visitor websocket preserve the media session and following preferences', async context => {
  const { fixture, page, service, room, start, assignments } = setup(context);
  await start(); page.onHide(); room.disconnected = true;
  page.syncDriverFollowing();
  assert.equal(service.active(), true);
  assert.equal(page.data.locationEnabled, true);
  assert.equal(assignments(), 1);
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
});

test('the real location watcher preserves following and the stream when the hidden visitor websocket disconnects', async context => {
  const { fixture, page, service, translation, start, assignments } = setup(context, true, true, true);
  await start();
  page.watchLocation();
  const pendingFix = fixture.requests.at(-1);
  assert.match(pendingFix.options.url, /\/location$/);
  const unsubscribe = translation.subscribe(() => page.syncDriverFollowing());
  context.after(unsubscribe);
  page.onHide();
  await tick();
  const controlsBeforeDisconnect = fixture.requests.filter(request => /\/control$/.test(request.options.url)).length;
  translation.disconnect(true);
  await tick();
  assert.equal(pendingFix.aborted, false);
  assert.equal(page.data.locationEnabled, true);
  assert.equal(page.data.autoplay, true);
  assert.equal(translation.snapshot().following, true);
  pendingFix.ok({ roomId, status: 'online', coordinateSystem: 'GCJ-02', longitude: 116.4, latitude: 39.9,
    accuracy: 8, sampledAt: new Date().toISOString(), serverTime: new Date().toISOString() });
  await tick();
  assert.equal(page._fix.roomId, roomId);
  assert.equal(service.activeForRoom(roomId), true);
  assert.equal(assignments(), 1);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
  const controls = fixture.requests.filter(request => /\/control$/.test(request.options.url));
  assert.equal(controls.length, controlsBeforeDisconnect);
  assert.ok(controls.every(request => request.options.data.following !== false));
  assert.ok(fixture.requests.every(request => !/RouteVisit/.test(request.options.url)));
});

test('a location authorization failure still disables following with an active media session', async context => {
  const { fixture, page, translation, start } = setup(context, true, true, true);
  await start();
  page.watchLocation();
  fixture.requests.at(-1).ok({}, 403);
  await tick();
  assert.equal(page.data.locationEnabled, false);
  assert.equal(page.data.autoplay, false);
  assert.equal(translation.snapshot().following, false);
  const control = fixture.requests.find(request => /\/control$/.test(request.options.url));
  assert.equal(control.options.data.following, false);
});

test('screen off removes the temporary panel lock while keeping explicit lock preference', async context => {
  const { fixture, page, start, reply } = setup(context);
  await start();
  page.setData({ contentOpen: true });
  assert.equal(page.serverAudioOptions().lockContent, true);
  page.onHide(); await tick();
  assert.equal(fixture.requests[1].options.data.lockContent, false);
  reply(fixture.requests[1]); await tick();
  page.setData({ lockContent: true });
  assert.equal(page.serverAudioOptions().lockContent, true);
});

test('previous and next preview commands do not claim formal entry', async context => {
  const { fixture, page, start, reply } = setup(context);
  await start(); page.browseBy(1); await tick();
  assert.equal(fixture.requests[1].options.data.command, 'preview');
  assert.equal(fixture.requests[1].options.data.stageId, stageIds[1]);
  reply(fixture.requests[1], { stageId: stageIds[1] }); await tick();
  assert.equal(page._manualBrowse, true);
  assert.equal(page.data.browsing, true);
});

test('manual node selection uses the session control instead of the old visit endpoint', async context => {
  const { fixture, page, start, reply } = setup(context);
  await start();
  const pending = page.enter(1);
  await tick();
  const control = fixture.requests[1];
  assert.equal(control.options.data.command, 'select');
  assert.equal(control.options.data.stageId, stageIds[1]);
  reply(control, { stageId: stageIds[1] }); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'resume');
  reply(fixture.requests[2]); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'reconnect');
  reply(fixture.requests[3], { status: 'disconnected' }); await pending; await tick();
  assert.ok(fixture.requests.every(request => !/RouteVisit/.test(request.options.url)));
  reply(fixture.requests[4]);
});

test('question holds server progression and closing it reconnects without buffered silence', async context => {
  const { fixture, page, start, reply, assignments } = setup(context);
  await start(); page.ask(); await tick();
  assert.equal(fixture.requests[1].options.data.command, 'hold');
  reply(fixture.requests[1], { held: true }); await tick();
  page.closeChat(); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'release');
  reply(fixture.requests[2], { held: false }); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'reconnect');
  reply(fixture.requests[3], { status: 'disconnected' }); await tick();
  assert.equal(assignments(), 2);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
  assert.equal(fixture.requests.length, 4, 'reconnecting must not send a new hold command');
});

test('explicit pause and resume control the server and flush accumulated silence on resume', async context => {
  const { fixture, service, start, reply, assignments } = setup(context);
  await start();
  const paused = service.setPaused(true); await tick();
  reply(fixture.requests[1], { paused: true }); await paused;
  assert.equal(fixture.load('services/audio').snapshot().playing, false);
  const resumed = service.setPaused(false); await tick();
  reply(fixture.requests[2], { paused: false }); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'reconnect');
  reply(fixture.requests[3], { status: 'disconnected' }); await resumed;
  assert.equal(assignments(), 2);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
  await tick();
  assert.equal(fixture.requests.length, 4, 'resuming must not hold the session it just resumed');
});

test('overlapping resume requests share one reconnect and do not interrupt each other', async context => {
  const { fixture, service, start, reply, assignments } = setup(context);
  await start();
  fixture.load('services/audio').pause();
  const first = service.setPaused(false), second = service.setPaused(false); await tick();
  reply(fixture.requests[1]); await tick();
  reply(fixture.requests[2]); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'reconnect');
  reply(fixture.requests[3], { status: 'disconnected' }); await Promise.all([first, second]); await tick();
  assert.equal(assignments(), 2);
  assert.equal(fixture.requests.length, 4);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
});

test('the visible play button selects the displayed node while the continuous stream is idle', async context => {
  const { fixture, page, start, reply } = setup(context);
  await start();
  assert.equal(page.data.playing, false);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
  page.togglePlay(); await tick();
  assert.equal(fixture.requests[1].options.data.command, 'select');
  assert.equal(fixture.requests[1].options.data.stageId, stageIds[0]);
  reply(fixture.requests[1], { stageId: stageIds[0], itemId: 'chapter0' }); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'resume');
  reply(fixture.requests[2]); await tick();
  assert.equal(page.data.playing, true);
});

test('native playback errors remain visible through successful state polling until playback recovers', async context => {
  const { fixture, manager, page, service, start, reply } = setup(context);
  await start();
  manager.emit('Error', { errorMessage: '媒体解码失败' });
  const pending = service.refresh();
  reply(fixture.requests[1], { error: null }); await pending;
  assert.match(page.data.audioError, /媒体解码失败/);
  assert.match(service.snapshot().error, /媒体解码失败/);
  const retried = service.setPaused(false); await tick();
  reply(fixture.requests[2]); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'reconnect');
  reply(fixture.requests[3], { status: 'disconnected' }); await retried;
  assert.equal(service.snapshot().error, '');
  assert.equal(fixture.load('services/audio').snapshot().failed, false);
});

test('a native player stuck at zero exposes a retryable failure instead of pretending to play', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const { fixture, page, service, start, reply, assignments } = setup(context);
  await start();
  context.mock.timers.tick(21000);
  const pending = service.refresh();
  reply(fixture.requests[1], { stageId: stageIds[0], itemId: 'chapter0', sentBytes: 120000, mediaTimeSeconds: 20 }); await pending;
  assert.equal(service.snapshot().stalled, true);
  assert.equal(page.data.playing, false);
  assert.match(page.data.audioError, /卡住/);
  page.retryAudio(); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'resume');
  reply(fixture.requests[2]); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'reconnect');
  reply(fixture.requests[3], { status: 'disconnected' }); await tick();
  assert.equal(assignments(), 2);
  assert.equal(service.snapshot().stalled, false);
  assert.equal(page.data.audioError, '');
});

test('an intentionally paused or hidden player does not produce a stall failure', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const { fixture, service, start, reply } = setup(context);
  await start();
  const paused = service.setPaused(true); await tick();
  reply(fixture.requests[1], { paused: true }); await paused;
  context.mock.timers.tick(60000);
  let pending = service.refresh(); reply(fixture.requests[2]); await pending;
  assert.equal(service.snapshot().stalled, false);
  service.setForeground(false);
  context.mock.timers.tick(60000);
  pending = service.refresh(); reply(fixture.requests[3], { paused: false }); await pending;
  assert.equal(service.snapshot().stalled, false);
  assert.equal(service.snapshot().error, '');
});

test('playback diagnostics identify server and native state without exposing media or login credentials', async context => {
  const { fixture, manager, page, service, start, reply } = setup(context);
  await start();
  const refreshed = service.refresh();
  reply(fixture.requests[1], { schedulerStatus: 'room-priority', arrival: { status: 'weak-accuracy', rejectedSamples: { 'weak-accuracy': 3 } },
    transport: { maximumWriteMilliseconds: 2400, events: [{ streamId: 'stream-1', kind: 'write-backpressure', reason: 'write-or-flush-exceeded-2s' }] },
    stageTimings: [{ stageId: stageIds[0], arrivedAt: '2026-11-11T09:29:00Z', audioStartedAt: null }] });
  await refreshed;
  fixture.my.setClipboard = options => { fixture.clipboard = options.text; };
  manager.emit('Error', { errorMessage: 'https://test/media.mp3?ticket=secret Authorization: Bearer access' });
  page.copyAudioReport();
  const report = JSON.parse(fixture.clipboard);
  assert.equal(report.version, 'tour-audio-startup-guards-20261113');
  assert.equal(report.sessionId, 'session-1');
  assert.equal(report.player.failed, true);
  assert.equal(report.selectedStageId, stageIds[0]);
  assert.equal(report.hasPlaybackError, true);
  assert.equal(report.server.schedulerStatus, 'room-priority');
  assert.equal(report.server.arrival.rejectedSamples['weak-accuracy'], 3);
  assert.equal(report.server.stageTimings[0].stageId, stageIds[0]);
  assert.equal(report.server.stageTimings[0].audioStartedAt, null);
  assert.equal(report.server.transport.maximumWriteMilliseconds, 2400);
  assert.equal(report.server.transport.events[0].kind, 'write-backpressure');
  assert.ok(!/ticket|secret|Bearer|access|https:/.test(fixture.clipboard));
});

test('foreground diagnostics preserve native playback before refresh or recovery replaces its evidence', async context => {
  const { fixture, manager, service, start, reply, assignments } = setup(context);
  await start();
  manager.currentTime = 12;
  service.setForeground(false);
  manager.currentTime = 12.4;
  service.setForeground(true);
  const records = plain(service.diagnostics().lifecycle).slice(-2);
  assert.equal(records[0].event, 'background');
  assert.equal(records[0].playerTime, 12);
  assert.equal(records[1].event, 'foreground-before-refresh');
  assert.equal(records[1].playerTime, 12.4);
  assert.equal(records[1].streamId, 'stream-1');
  assert.equal(assignments(), 1);
  reply(fixture.requests[1], { mediaTimeSeconds: 80 }); await tick();
  assert.equal(service.diagnostics().lifecycle.at(-1).lastKnownServerMediaSeconds, 0);
  assert.equal(service.diagnostics().server.mediaTimeSeconds, 80);
  assert.ok(!/ticket|secret|Bearer|https:/.test(JSON.stringify(service.diagnostics().lifecycle)));
});

test('lifecycle evidence is bounded and repeated foreground values do not duplicate transitions', async context => {
  const { fixture, service, start, reply } = setup(context);
  await start();
  for (let index = 0; index < 8; index++) {
    service.setForeground(false); service.setForeground(false);
    service.setForeground(true);
    reply(fixture.requests[fixture.requests.length - 1]); await tick();
  }
  assert.equal(service.diagnostics().lifecycle.length, 12);
  assert.equal(service.diagnostics().lifecycle.at(-1).event, 'foreground-before-refresh');
  service.stop();
  assert.equal(service.diagnostics().lifecycle.length, 12);
  assert.equal(service.diagnostics().lifecycle.at(-1).event, 'stopped');
  fixture.auth.logout();
  assert.deepEqual(plain(service.diagnostics().lifecycle), []);
});

test('manual resume releases a held session before reconnecting and never holds it again', async context => {
  const { fixture, service, start, reply } = setup(context);
  await start();
  const held = service.control('hold'); await tick();
  reply(fixture.requests[1], { held: true }); await held;
  fixture.load('services/audio').pause();
  const resumed = service.setPaused(false); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'release');
  reply(fixture.requests[2], { held: false }); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'resume');
  reply(fixture.requests[3], { paused: false }); await tick();
  assert.equal(fixture.requests[4].options.data.command, 'reconnect');
  reply(fixture.requests[4], { status: 'disconnected' }); await resumed; await tick();
  assert.equal(fixture.requests.length, 5);
  assert.equal(service.snapshot().state.held, false);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
});

test('selecting a different node after pause also resumes its native media connection', async context => {
  const { fixture, page, service, start, reply, assignments } = setup(context);
  await start();
  const paused = service.setPaused(true); await tick();
  reply(fixture.requests[1], { paused: true }); await paused;
  const pending = page.enter(1); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'select');
  reply(fixture.requests[2], { stageId: stageIds[1], paused: false }); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'resume');
  reply(fixture.requests[3]); await tick();
  assert.equal(fixture.requests[4].options.data.command, 'reconnect');
  reply(fixture.requests[4], { status: 'disconnected' }); await pending; await tick();
  assert.equal(assignments(), 2);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
  reply(fixture.requests[5]);
});

test('leaving a real room never recreates a live session and ordinary node playback works', async context => {
  const { fixture, manager, page, service, translation, start } = setup(context, true);
  await start();
  manager.emit('Error', { errorMessage: '连续媒体解码失败' });
  page._userPaused = true;
  const unsubscribe = translation.subscribe(() => {
    page.syncDriverFollowing(); page.syncRoomPlayback(); page.flushFinished(); page.startNextSequence();
  });
  context.after(unsubscribe);
  const leaving = translation.leave(); await tick();
  assert.equal(translation.snapshot().room, null);
  assert.equal(service.active(), false);
  assert.equal(page._userPaused, false);
  assert.equal(page.data.audioError, '');
  assert.equal(fixture.requests.filter(request => request.options.method === 'POST' && /TourAudioSessions$/.test(request.options.url)).length, 1);
  const request = fixture.requests.find(request => /\/leave$/.test(request.options.url));
  request.ok({}); await leaving;
  page.togglePlay(); await tick();
  const playback = fixture.load('services/audio').snapshot();
  assert.equal(playback.live, false);
  assert.equal(playback.item.id, 'chapter0');
  assert.equal(playback.playing, true);
  assert.equal(page.data.audioError, '');
});

test('leaving during session creation revokes the late result without taking ordinary audio', async context => {
  const { fixture, page, service, translation, state, assignments } = setup(context, true);
  page.startNextSequence();
  const unsubscribe = translation.subscribe(() => page.startNextSequence());
  context.after(unsubscribe);
  const leaving = translation.leave(); await tick();
  assert.equal(service.active(), false);
  fixture.requests.find(request => /\/leave$/.test(request.options.url)).ok({}); await leaving;
  page.togglePlay();
  fixture.requests[0].ok({ sessionId: state().sessionId, mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state: state() });
  await tick();
  assert.equal(assignments(), 1);
  assert.equal(fixture.load('services/audio').snapshot().item.id, 'chapter0');
  assert.equal(service.active(), false);
});

test('failed creation stays visible and never falls back to the foreground-only scheduler', async context => {
  const { fixture, page, service } = setup(context);
  page.startNextSequence(); fixture.requests[0].reject({ errorMessage: '服务器尚未发布' }); await tick();
  page.startNextSequence(); page.startNextSequence();
  assert.equal(service.active(), false);
  assert.match(page.data.audioError, /服务器尚未发布/);
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.audioContexts.length, 0);
});

test('failed creation diagnostics explain why no session or player was created', async context => {
  const { fixture, page, service } = setup(context);
  page.startNextSequence();
  fixture.requests[0].options.success({ status: 400, data: { code: 10003, message: '请先开始当前路线的游览' } });
  await tick();
  const report = service.diagnostics();
  assert.equal(report.active, false);
  assert.equal(report.creating, false);
  assert.equal(report.sessionId, '');
  assert.equal(report.phase, 'failed');
  assert.match(report.error, /请先开始当前路线/);
  assert.equal(report.lifecycle.at(-1).event, 'create-failed');
  assert.match(report.lifecycle.at(-1).error, /请先开始当前路线/);
  assert.equal(report.lifecycle.at(-1).status, 400);
  assert.equal(report.lifecycle.at(-1).code, 10003);
  assert.equal(report.player.requested, false);
});

test('pending creation displays connecting and repeated retry cannot create or resume twice', async context => {
  const { fixture, page, service, state } = setup(context, false, true);
  page.startNextSequence();
  assert.equal(page.data.audioCreating, true);
  assert.equal(page.data.followStatus, '正在连接讲解，请稍候');
  page.retryAudio(); page.retryAudio(); page.startNextSequence();
  assert.equal(fixture.requests.length, 1);
  fixture.requests[0].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state: state() });
  await tick();
  assert.equal(page.data.audioCreating, false);
  assert.deepEqual(plain(service.diagnostics().lifecycle).map(record => record.event), ['create-start', 'create-success']);
  assert.equal(service.diagnostics().phase, 'connecting', 'server streaming with zero native progress does not prove playback');
});

test('startup prerequisites explain a missing visit without issuing an audio request', async context => {
  const { fixture, page } = setup(context, false, true);
  page.setData({ visit: null });
  page.startNextSequence(); page.retryAudio();
  assert.equal(fixture.requests.length, 0);
  assert.equal(page.serverAudioReadiness().code, 'visit-required');
  assert.match(page.data.audioError, /开始当前路线/);
  fixture.my.setClipboard = options => { fixture.clipboard = JSON.parse(options.text); };
  page.copyAudioReport();
  assert.equal(fixture.clipboard.startup.readiness.code, 'visit-required');
  assert.equal(fixture.clipboard.startup.roomId, roomId);
});

test('a failure in a previous room does not suppress startup in the new room', async context => {
  const { fixture, page, room } = setup(context);
  page.startNextSequence();
  fixture.requests[0].reject({ errorMessage: '请求超时' }); await tick();
  assert.equal(page.data.followStatus, '讲解未连接，请重试');
  page.startNextSequence();
  assert.equal(fixture.requests.length, 1);
  room.room.roomId = '9223372036854775700';
  page.startNextSequence();
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.requests[1].options.data.roomId, room.room.roomId);
  fixture.requests[1].reject({ errorMessage: '请求超时' }); await tick();
});

test('failed creation history survives cleanup, is redacted, and clears on logout', async context => {
  const { fixture, page, service } = setup(context);
  page.startNextSequence();
  fixture.requests[0].reject({ errorMessage: 'https://media.test/?ticket=secret Bearer access token=secret' }); await tick();
  await service.stop();
  const report = service.diagnostics();
  assert.equal(report.lifecycle.at(-1).event, 'create-failed');
  assert.ok(!/ticket|secret|Bearer|access|https:/.test(JSON.stringify(report)));
  fixture.auth.logout();
  assert.deepEqual(plain(service.diagnostics().lifecycle), []);
});

test('browsing after startup failure preserves the error and retry entry', async context => {
  const { fixture, page } = setup(context, false, true);
  page.startNextSequence();
  fixture.requests[0].reject({ errorMessage: '连接失败，请重试' }); await tick();
  page.showStop(1, true);
  assert.match(page.data.audioError, /连接失败/);
  assert.equal(page.data.followStatus, '讲解未连接，请重试');
  assert.equal(fixture.requests.length, 1);
});

for (const [name, mutate, expected] of [
  ['closed room', ({ room }) => { room.room.status = 'closed'; }, 'room-ended'],
  ['missing route', ({ page }) => page.setData({ route: null }), 'route-required'],
  ['completed visit', ({ page }) => page.setData({ visit: { visitId, routeId, status: 2 } }), 'visit-required'],
  ['mismatched visit', ({ page }) => page.setData({ visit: { visitId, routeId: 'another-route', status: 1 } }), 'visit-mismatch'],
  ['unsupported runtime', ({ fixture }) => { delete fixture.my.getBackgroundAudioManager; }, 'unsupported']
]) {
  test('explicit startup explains ' + name + ' before requesting a session', async context => {
    const values = setup(context, false, true);
    mutate(values);
    assert.equal(await values.page.ensureServerAudio(), null);
    assert.equal(values.page.serverAudioReadiness().code, expected);
    if (expected === 'room-ended') {
      assert.equal(values.page.data.audioError, '');
      assert.equal(values.page.data.roomNotice, '车夫已解散房间');
    } else assert.ok(values.page.data.audioError);
    assert.equal(values.fixture.requests.length, 0);
  });
}

test('manual reconnect clicks share the pending operation after startup failure', async context => {
  const { fixture, page, state, reply } = setup(context, false, true);
  page.startNextSequence();
  fixture.requests[0].reject({ errorMessage: '网络断开' }); await tick();
  page.retryAudio(); page.retryAudio();
  assert.equal(fixture.requests.length, 2);
  fixture.requests[1].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state: state() });
  await tick();
  assert.equal(fixture.requests[2].options.data.command, 'realign');
  page.retryAudio();
  reply(fixture.requests[2]); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'resume');
  reply(fixture.requests[3]); await tick();
  assert.equal(fixture.requests[4].options.data.command, 'reconnect');
  reply(fixture.requests[4], { status: 'disconnected' }); await tick();
  assert.equal(fixture.requests.length, 5);
  assert.equal(page._audioRetry, null);
});

test('manual reconnect discards old route backlog and follows the newly detected driver node', async context => {
  const { fixture, page, service, start, reply, assignments } = setup(context, false, true);
  await start();
  const refreshed = service.refresh();
  reply(fixture.requests[1], { stageId: stageIds[0], itemId: 'chapter0',
    queue: [{ stageId: stageIds[0], status: 'emitted' }, { stageId: stageIds[1], status: 'queued' }] });
  await refreshed;
  await page.enter(1);
  assert.equal(page._manualBrowse, true);
  page.retryAudio(); page.retryAudio(); await tick();
  assert.equal(fixture.load('services/audio').snapshot().playing, false);
  assert.equal(page._manualBrowse, false);
  assert.equal(fixture.requests[2].options.data.command, 'realign');
  assert.equal(fixture.requests[2].options.data.stageId, undefined);
  reply(fixture.requests[2], { stageId: null, itemId: null, queue: [], held: false, paused: false }); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'resume');
  reply(fixture.requests[3]); await tick();
  assert.equal(fixture.requests[4].options.data.command, 'reconnect');
  reply(fixture.requests[4], { status: 'disconnected' }); await tick();
  assert.deepEqual(plain(page.data.sequence), []);
  assert.equal(page.data.playing, false);
  const next = service.refresh();
  reply(fixture.requests[5], { status: 'streaming', streamId: 'stream-2', stageId: stageIds[1],
    itemId: 'chapter1', itemTimeSeconds: 0, queue: [{ stageId: stageIds[1], status: 'playing' }] });
  await next;
  assert.equal(page.data.stop.id, stageIds[1]);
  assert.equal(page.data.playingStopId, stageIds[1]);
  assert.equal(assignments(), 2);
  assert.ok(!fixture.requests.some(request => ['select', 'replay', 'complete'].includes(request.options.data?.command)));
});

test('a newer question cancels a manual reconnect before it can resume the realigned stream', async context => {
  const { fixture, page, service, start, reply, assignments } = setup(context, false, true);
  await start();
  page.retryAudio(); await tick();
  assert.equal(fixture.requests[1].options.data.command, 'realign');
  page.ask();
  reply(fixture.requests[1], { paused: false, held: false, stageId: null, itemId: null, queue: [] }); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'hold');
  reply(fixture.requests[2], { held: true }); await tick();
  assert.equal(service.snapshot().heldIntent, true);
  assert.equal(fixture.load('services/audio').snapshot().playing, false);
  assert.equal(assignments(), 1);
  assert.equal(fixture.requests.length, 3);
});

test('closing the room during manual realignment prevents any resume or replacement player', async context => {
  const { fixture, page, service, translation, start, reply, assignments } = setup(context, true, true);
  await start();
  page.retryAudio(); await tick();
  assert.equal(fixture.requests[1].options.data.command, 'realign');
  translation.event({ type: 'room.closed', roomId, payload: { mode: 'immediate' } });
  reply(fixture.requests[1], { status: 'closed' }); await tick();
  assert.equal(service.active(), false);
  assert.equal(page.data.audioError, '');
  assert.equal(assignments(), 1);
  assert.ok(!fixture.requests.some(request => ['resume', 'reconnect'].includes(request.options.data?.command)));
});

test('a late creation after account logout is revoked and cannot start audio', async context => {
  const { fixture, page, assignments, state } = setup(context);
  page.startNextSequence(); fixture.auth.logout();
  fixture.requests[0].ok({ sessionId: 'late-session', mediaUrl: '/TourAudioSessions/late-session/media.mp3?ticket=secret', state: state() });
  await tick();
  assert.equal(assignments(), 0);
  assert.equal(fixture.requests[1].options.method, 'DELETE');
});

test('confirmed final progress reaches the page before the ended media session is released', async context => {
  const { fixture, page, service, start, reply, state } = setup(context);
  await start();
  const pending = service.refresh();
  reply(fixture.requests[1], { status: 'ended', visit: { ...state().visit, status: 2, completedStageIds: stageIds } });
  await pending;
  assert.equal(page.data.visit.status, 2);
  assert.deepEqual(plain(page.data.visit.completedStageIds), stageIds);
  assert.equal(service.active(), false);
  assert.equal(fixture.load('services/audio').snapshot().playing, false);
});

test('a late resume response cannot undo a more recent explicit pause', async context => {
  const { fixture, service, start, reply } = setup(context);
  await start();
  const resumed = service.setPaused(false); await tick();
  const paused = service.setPaused(true);
  reply(fixture.requests[1], { paused: false }); await resumed; await tick();
  assert.equal(fixture.load('services/audio').snapshot().playing, false);
  reply(fixture.requests[2], { paused: true }); await paused;
  assert.equal(fixture.load('services/audio').snapshot().requested, false);
});

test('holding for a question during reconnect prevents the old reconnect from reclaiming audio', async context => {
  const { fixture, service, start, reply, assignments } = setup(context);
  await start();
  fixture.load('services/audio').pause();
  const resumed = service.setPaused(false); await tick();
  reply(fixture.requests[1]); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'reconnect');
  const held = service.control('hold');
  fixture.load('services/audio').playQueue('chat', [{ id: 'answer', url: '/answer.mp3' }]);
  reply(fixture.requests[2], { status: 'disconnected' }); await resumed; await tick();
  assert.equal(assignments(), 1);
  assert.equal(fixture.load('services/audio').snapshot().owner, 'chat');
  reply(fixture.requests[3], { held: true }); await held;
});

test('a pre-reconnect status response cannot acknowledge time from the replacement player', async context => {
  const { fixture, manager, service, start, reply, state } = setup(context);
  await start();
  const refresh = service.refresh(), oldState = { ...state() };
  fixture.load('services/audio').pause();
  const resumed = service.setPaused(false); await tick();
  reply(fixture.requests[2]); await tick();
  reply(fixture.requests[3], { status: 'disconnected' }); await resumed;
  manager.currentTime = 12;
  fixture.requests[1].ok(oldState); await tick();
  assert.equal(fixture.requests.length, 4);
  await refresh;
});

test('switching rooms during a select response cannot send the old play continuation to the new session', async context => {
  const { fixture, page, service, start, reply, state } = setup(context);
  await start();
  page.play(); await tick();
  const selected = fixture.requests[1];
  assert.equal(selected.options.data.command, 'select');
  const next = service.start({ ...page.serverAudioOptions(), roomId: 'another-room' });
  fixture.requests.find(request => request.options.method === 'POST' && /TourAudioSessions$/.test(request.options.url) && request.options.data.roomId === 'another-room')
    .ok({ sessionId: 'session-2', mediaUrl: '/TourAudioSessions/session-2/media.mp3?ticket=new-secret', state: { ...state(), sessionId: 'session-2' } });
  await next;
  reply(selected, { stageId: stageIds[0] }); await tick();
  assert.equal(service.snapshot().sessionId, 'session-2');
  assert.ok(!fixture.requests.some(request => /session-2\/control$/.test(request.options.url)));
});

test('an immediate room closure cannot recreate the closing room during teardown callbacks', async context => {
  const { fixture, page, service, translation, start } = setup(context, true);
  await start();
  const unsubscribe = translation.subscribe(() => page.startNextSequence()); context.after(unsubscribe);
  translation.event({ type: 'room.closed', roomId, payload: { mode: 'immediate' } }); await tick();
  assert.equal(translation.snapshot().room.status, 'closed');
  assert.equal(service.active(), false);
  assert.equal(translation.snapshot().error, '');
  assert.equal(translation.snapshot().following, false);
  assert.equal(translation.snapshot().displayNotice, '车夫已解散房间');
  assert.equal(page.data.audioError, '');
  assert.equal(page.data.roomNotice, '车夫已解散房间');
  assert.equal(service.diagnostics().phase, 'idle');
  page.retryAudio(); page.startNextSequence();
  assert.equal(fixture.requests.filter(request => request.options.method === 'POST' && /TourAudioSessions$/.test(request.options.url)).length, 1);
});

test('missing a room closure in background resolves membership rejection as a normal room notice', async context => {
  const { fixture, page, service, translation } = setup(context, true);
  translation.attach({ roomId, code: '12345678', status: 'waiting', isHost: false }, 'zh');
  page.startNextSequence();
  fixture.requests[0].options.success({ status: 403, data: { code: 10003, message: '请先加入房间' } });
  await tick();
  const join = fixture.requests.find(request => /\/TranslationRooms\/join$/.test(request.options.url));
  assert.ok(join);
  join.options.success({ status: 400, data: { code: 10001, message: '房间已结束，不能继续加入或输入' } });
  await tick();
  assert.equal(translation.snapshot().room.status, 'closed');
  assert.equal(translation.snapshot().following, false);
  assert.equal(page.data.roomNotice, '车夫已解散房间');
  assert.equal(page.data.audioError, '');
  assert.equal(service.diagnostics().phase, 'idle');
  page.retryAudio(); page.startNextSequence();
  await translation.resume();
  assert.equal(fixture.requests.length, 2);
});

test('expired membership rejoins an open room before retrying audio instead of declaring it closed', async context => {
  const { fixture, page, translation } = setup(context, true);
  const room = { roomId, code: '12345678', status: 'waiting', isHost: false };
  translation.attach(room, 'zh');
  page.startNextSequence();
  fixture.requests[0].options.success({ status: 403, data: { code: 10003, message: '请先加入房间' } });
  await tick();
  const join = fixture.requests[1];
  assert.match(join.options.url, /\/TranslationRooms\/join$/);
  join.ok(room); await tick();
  assert.equal(translation.snapshot().room.status, 'waiting');
  assert.equal(page.data.roomNotice, '');
  assert.equal(page.data.audioError, '');
  assert.equal(fixture.requests.length, 2);
  translation.event({ type: 'subscription.ready', payload: { room } });
  page.startNextSequence();
  assert.match(fixture.requests[2].options.url, /TourAudioSessions$/);
});

test('unrelated authorization failures remain errors and do not trigger a room rejoin', async context => {
  const { fixture, page } = setup(context, true);
  page.startNextSequence();
  fixture.requests[0].options.success({ status: 403, data: { code: 10003, message: '当前用户不可用' } });
  await tick();
  assert.equal(page.data.audioError, '当前用户不可用');
  assert.equal(fixture.requests.length, 1);
});

test('switching real rooms publishes the new room before teardown can start another media session', async context => {
  const { fixture, page, service, translation, start } = setup(context, true);
  await start();
  const unsubscribe = translation.subscribe(() => page.startNextSequence()); context.after(unsubscribe);
  translation.attach({ roomId: 'another-room', status: 'paused', isHost: false }, 'zh'); await tick();
  const creations = fixture.requests.filter(request => request.options.method === 'POST' && /TourAudioSessions$/.test(request.options.url));
  assert.equal(creations.length, 2);
  assert.equal(creations[1].options.data.roomId, 'another-room');
  assert.equal(service.snapshot().roomId, 'another-room');
});

test('overlapping session creation waits for the old create to settle before submitting the replacement', async context => {
  const { fixture, page, service, state } = setup(context);
  const previous = service.start(page.serverAudioOptions()).catch(error => error);
  const next = service.start({ ...page.serverAudioOptions(), roomId: 'another-room' });
  assert.equal(fixture.requests.length, 1);
  fixture.requests[0].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=old', state: state() });
  assert.equal((await previous).cancelled, true); await tick();
  const replacement = fixture.requests.find(request => request.options.data && request.options.data.roomId === 'another-room');
  replacement.ok({ sessionId: 'session-2', mediaUrl: '/TourAudioSessions/session-2/media.mp3?ticket=new', state: { ...state(), sessionId: 'session-2' } });
  await next;
  assert.equal(service.snapshot().sessionId, 'session-2');
});

test('preferences changed during creation reach that session after creation completes', async context => {
  const { fixture, page, service, state } = setup(context);
  page.startNextSequence();
  const preferences = service.control('preferences', { following: false, autoplay: false });
  fixture.requests[0].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state: state() });
  await tick();
  assert.equal(fixture.requests[1]?.options.data.command, 'preferences');
  fixture.requests[1].ok(state()); await preferences;
});

test('holding during creation prevents source autoplay before the hold request finishes', async context => {
  const { fixture, page, service, state } = setup(context);
  page.startNextSequence();
  const held = service.control('hold');
  fixture.requests[0].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state: state() });
  await tick();
  assert.equal(fixture.load('services/audio').snapshot().playing, false);
  assert.equal(fixture.requests[1]?.options.data.command, 'hold');
  fixture.requests[1].ok({ ...state(), held: true }); await held;
});

test('a delayed extra-audio hold cannot start the extra after opening a question', async context => {
  const { fixture, page, start, reply } = setup(context);
  await start();
  page.playExtraItem({ id: 'extra', url: '/extra.mp3', kind: 'after' }); await tick();
  page.ask();
  reply(fixture.requests[1], { held: true }); await tick();
  assert.notEqual(fixture.load('services/audio').snapshot().owner, 'tour-extra');
  if (fixture.requests[2]) reply(fixture.requests[2], { held: true });
});

test('language selection cannot recreate a media session in the room being left', async context => {
  const { fixture, page, service, translation, start } = setup(context, true);
  await start();
  const unsubscribe = translation.subscribe(() => page.startNextSequence()); context.after(unsubscribe);
  const changed = translation.changeLanguage(); await tick();
  assert.equal(service.active(), false);
  assert.equal(fixture.requests.filter(request => request.options.method === 'POST' && /TourAudioSessions$/.test(request.options.url)).length, 1);
  fixture.requests.find(request => /\/leave$/.test(request.options.url)).ok({}); await changed;
});

test('switching session immediately after play is requested cannot select the old node in the replacement', async context => {
  const { fixture, page, service, start, state } = setup(context);
  await start();
  page.play();
  const next = service.start({ ...page.serverAudioOptions(), roomId: 'another-room' });
  const replacement = fixture.requests.find(request => request.options.data && request.options.data.roomId === 'another-room');
  replacement.ok({ sessionId: 'session-2', mediaUrl: '/TourAudioSessions/session-2/media.mp3?ticket=new', state: { ...state(), sessionId: 'session-2' } });
  await next; await tick();
  assert.ok(!fixture.requests.some(request => /session-2\/control$/.test(request.options.url)));
});

test('a manual play awaiting creation cannot clear a newer question hold', async context => {
  const { fixture, page, service, state } = setup(context);
  page.play();
  page.ask();
  fixture.requests[0].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state: state() });
  await tick();
  assert.equal(fixture.requests[1].options.data.command, 'hold');
  fixture.requests[1].ok({ ...state(), held: true }); await tick();
  assert.equal(fixture.requests.length, 2);
  assert.equal(service.snapshot().heldIntent, true);
  assert.equal(fixture.load('services/audio').snapshot().playing, false);
});

test('hiding extra playback releases its session without waiting for an inner-player ended callback', async context => {
  const { fixture, page, start, reply } = setup(context);
  await start();
  page.playExtraItem({ id: 'extra', url: '/extra.mp3', kind: 'after' }); await tick();
  reply(fixture.requests[1], { held: true }); await tick();
  page.onHide(); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'release');
  reply(fixture.requests[2], { held: false }); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'preferences');
  reply(fixture.requests[3]); await tick();
  assert.equal(fixture.requests[4].options.data.command, 'reconnect');
  reply(fixture.requests[4], { status: 'disconnected' }); await tick();
  assert.equal(fixture.load('services/audio').snapshot().live, true);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
});

test('an extra-audio error followed by finished releases the session only once', async context => {
  const { fixture, page, start, reply } = setup(context);
  await start();
  page.playExtraItem({ id: 'extra', url: '/extra.mp3', kind: 'after' }); await tick();
  reply(fixture.requests[1], { held: true }); await tick();
  fixture.audioContexts.at(-1).emit('Error', { errorMessage: 'failed extra' }); await tick();
  reply(fixture.requests[2], { held: false }); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'reconnect');
  reply(fixture.requests[3], { status: 'disconnected' }); await tick();
  assert.equal(fixture.requests.filter(request => request.options.data?.command === 'release').length, 1);
});

test('a reentrant subscriber awaiting the same creation receives the actual creation promise', async context => {
  const { fixture, page, service, state } = setup(context);
  let nested;
  const unsubscribe = service.subscribe(value => { if (value.creating && !nested) nested = service.start(page.serverAudioOptions()); });
  const operation = service.start(page.serverAudioOptions());
  fixture.requests[0].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state: state() });
  assert.equal((await nested).sessionId, 'session-1'); await operation;
  unsubscribe();
  assert.equal(fixture.requests.length, 1);
});

test('progress acknowledgement resumes only after the replacement stream id is observed', async context => {
  const { fixture, manager, service, start, reply } = setup(context);
  await start();
  fixture.load('services/audio').pause();
  const resumed = service.setPaused(false); await tick();
  reply(fixture.requests[1]); await tick();
  reply(fixture.requests[2], { status: 'disconnected' }); await resumed;
  manager.currentTime = 4;
  const refresh = service.refresh();
  reply(fixture.requests[3], { status: 'streaming', streamId: 'stream-2' }); await tick();
  assert.equal(fixture.requests[4].options.data.command, 'ack');
  assert.equal(fixture.requests[4].options.data.streamId, 'stream-2');
  assert.equal(fixture.requests[4].options.data.mediaTimeSeconds, 4);
  reply(fixture.requests[4]); await refresh;
});

test('queued creation controls are cancelled on leave and never delivered to a replacement', async context => {
  const { fixture, page, service, state } = setup(context);
  const previous = service.start(page.serverAudioOptions()).catch(error => error);
  const held = service.control('hold').catch(error => error);
  service.stop();
  const next = service.start({ ...page.serverAudioOptions(), roomId: 'another-room' });
  fixture.requests[0].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=old', state: state() });
  await previous; assert.equal((await held).cancelled, true); await tick();
  fixture.requests.find(request => request.options.data?.roomId === 'another-room')
    .ok({ sessionId: 'session-2', mediaUrl: '/TourAudioSessions/session-2/media.mp3?ticket=new', state: { ...state(), sessionId: 'session-2' } });
  await next; await tick();
  assert.ok(!fixture.requests.some(request => /session-2\/control$/.test(request.options.url)));
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
});

test('a preview awaiting creation cannot cancel a newer question hold', async context => {
  const { fixture, page, service, state } = setup(context);
  page._manualBrowse = true;
  page.play(); page.ask();
  fixture.requests[0].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state: state() });
  await tick();
  fixture.requests[1].ok({ ...state(), held: true }); await tick();
  assert.equal(fixture.requests.length, 2);
  assert.equal(service.snapshot().heldIntent, true);
});

test('a missing server session is discarded and retry creates a fresh session', async context => {
  const { fixture, page, service, start } = setup(context);
  await start();
  const refresh = service.refresh();
  fixture.requests[1].options.success({ status: 404, data: { code: 10004, message: '讲解会话不存在，请重新开始' } });
  await assert.rejects(refresh);
  assert.equal(service.active(), false);
  assert.match(page.data.audioError, /重新|失效/);
  page.retryAudio(); await tick();
  assert.equal(fixture.requests.filter(request => request.options.method === 'POST' && /TourAudioSessions$/.test(request.options.url)).length, 2);
});

test('a failed resume remains visible after polling a healthy server until a control retry succeeds', async context => {
  const { fixture, service, start, reply } = setup(context);
  await start();
  const resumed = service.setPaused(false); await tick();
  fixture.requests[1].reject({ errorMessage: '恢复操作网络失败' }); await assert.rejects(resumed);
  const refresh = service.refresh(); reply(fixture.requests[2]); await refresh;
  assert.match(service.snapshot().error, /恢复操作网络失败/);
  const retried = service.setPaused(false); await tick();
  reply(fixture.requests[3]); await retried;
  assert.equal(service.snapshot().error, '');
});

test('a synchronous decoder failure from the replacement source is not hidden as an old reconnect error', async context => {
  const { fixture, manager, service, start, reply } = setup(context);
  await start(); fixture.load('services/audio').pause();
  const resumed = service.setPaused(false); await tick();
  reply(fixture.requests[1]); await tick();
  manager.play = () => manager.emit('Error', { errorMessage: '新连接解码失败' });
  reply(fixture.requests[2], { status: 'disconnected' }); await resumed;
  assert.equal(fixture.load('services/audio').snapshot().failed, true);
  assert.match(service.snapshot().error, /新连接解码失败/);
});

test('returning to the driver position resumes a paused native media player', async context => {
  const { fixture, page, service, start, reply } = setup(context);
  await start();
  const paused = service.setPaused(true); await tick();
  reply(fixture.requests[1], { paused: true }); await paused;
  page.returnToNow(); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'realign');
  reply(fixture.requests[2], { paused: false, held: false }); await tick();
  assert.equal(fixture.requests[3]?.options.data.command, 'resume');
  reply(fixture.requests[3]); await tick();
  assert.equal(fixture.requests[4].options.data.command, 'reconnect');
  reply(fixture.requests[4], { status: 'disconnected' }); await tick();
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
});

test('the lock-screen pause button retains the native resume path', async context => {
  const { fixture, manager, service, start, reply } = setup(context);
  await start(); manager.emit('Pause'); await tick();
  assert.equal(fixture.requests[1].options.data.command, 'pause');
  reply(fixture.requests[1], { paused: true }); await tick();
  assert.equal(fixture.load('services/audio').snapshot().nativePaused, true);
  manager.emit('Play'); await tick();
  assert.equal(fixture.requests[2]?.options.data.command, 'resume');
  reply(fixture.requests[2], { paused: false }); await tick();
  reply(fixture.requests[3], { status: 'disconnected' }); await tick();
  assert.equal(service.snapshot().pausedIntent, false);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
});

test('a delayed realign response cannot resume narration over a newer question', async context => {
  const { fixture, page, service, start, reply } = setup(context);
  await start(); page.returnToNow(); await tick();
  assert.equal(fixture.requests[1].options.data.command, 'realign');
  page.ask();
  reply(fixture.requests[1], { held: false, paused: false }); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'hold');
  reply(fixture.requests[2], { held: true }); await tick();
  assert.equal(service.snapshot().heldIntent, true);
  assert.equal(fixture.load('services/audio').snapshot().playing, false);
  assert.equal(fixture.requests.length, 3);
});

test('extra playback has its own progress, pause and seek without releasing the held narration', async context => {
  const { fixture, page, service, start, reply } = setup(context);
  await start();
  page.playExtraItem({ id: 'extra', url: '/extra.mp3', title: '补充音频', kind: 'after' }); await tick();
  reply(fixture.requests[1], { held: true, itemTitle: '路线', itemDurationSeconds: 200 }); await tick();
  const extra = fixture.audioContexts.at(-1);
  extra.currentTime = 9; extra.emit('TimeUpdate');
  assert.equal(page.data.playing, true);
  assert.equal(page.data.itemTitle, '补充音频');
  const refresh = service.refresh(); reply(fixture.requests[2]); await refresh;
  assert.equal(page.data.timeLabel, '0:09');
  page.seek({ detail: { value: 50 } });
  assert.equal(extra.currentTime, 30);
  page.togglePlay();
  assert.equal(fixture.load('services/audio').snapshot().playing, false);
  page.togglePlay();
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
  assert.equal(service.snapshot().heldIntent, true);
  assert.equal(fixture.requests.length, 3);
});

test('video pause and resume retain the extra owner instead of restarting narration', async context => {
  const { fixture, page, service, start, reply } = setup(context);
  await start();
  const calls = [];
  fixture.my.createVideoContext = () => ({ pause() { calls.push('pause'); }, play() { calls.push('play'); } });
  page.playExtraItem({ id: 'video', url: '/video.mp4', kind: 'interlude-video' }); await tick();
  reply(fixture.requests[1], { held: true }); await tick();
  const playback = fixture.load('services/audio').snapshot();
  const event = { currentTarget: { dataset: { id: 'video', generation: playback.generation } } };
  page.videoPlay(event); page.videoPause(event);
  assert.equal(page.data.paused, true);
  page.togglePlay();
  assert.ok(calls.includes('play'));
  assert.equal(service.snapshot().heldIntent, true);
  assert.equal(fixture.requests.length, 2);
});

test('hiding after an extra was interrupted by a question cannot release the question hold', async context => {
  const { fixture, page, service, start, reply } = setup(context);
  await start();
  page.playExtraItem({ id: 'extra', url: '/extra.mp3', kind: 'after' }); await tick();
  reply(fixture.requests[1], { held: true }); await tick();
  page.ask(); await tick();
  reply(fixture.requests[2], { held: true }); await tick();
  page.onHide(); await tick();
  assert.equal(service.snapshot().heldIntent, true);
  assert.ok(!fixture.requests.some(request => request.options.data?.command === 'release'));
});

test('rapid node choices during creation preserve the last selected node', async context => {
  const { fixture, page, service, state, reply } = setup(context);
  page.play(); page.browseBy(1);
  fixture.requests[0].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state: state() });
  await tick();
  assert.equal(fixture.requests[1]?.options.data.command, 'preview');
  assert.equal(fixture.requests[1].options.data.stageId, stageIds[1]);
  reply(fixture.requests[1], { stageId: stageIds[1] }); await tick();
  reply(fixture.requests[2]); await tick();
  assert.equal(service.snapshot().state.stageId, stageIds[1]);
  assert.equal(page.data.stop.id, stageIds[1]);
});

test('an extra completion after returning to now cannot override a newer pause', async context => {
  const { fixture, page, service, start, reply } = setup(context);
  await start();
  page.playExtraItem({ id: 'extra', url: '/extra.mp3', kind: 'after' }); await tick();
  reply(fixture.requests[1], { held: true }); await tick();
  const extra = fixture.audioContexts.at(-1);
  page.returnToNow(); await tick();
  const paused = service.setPaused(true); await tick();
  extra.emit('Ended'); await tick();
  reply(fixture.requests[2], { held: false, paused: false }); await tick();
  reply(fixture.requests[3], { paused: true }); await paused; await tick();
  assert.equal(service.snapshot().pausedIntent, true);
  assert.ok(!fixture.requests.some(request => request.options.data?.command === 'release'));
});

test('retrying a failed release clears the server hold before resuming the native player', async context => {
  const { fixture, service, start, reply } = setup(context);
  await start();
  const held = service.control('hold'); await tick();
  reply(fixture.requests[1], { held: true }); await held;
  const resumed = service.setPaused(false); await tick();
  fixture.requests[2].reject({ errorMessage: '解除挂起失败' }); await assert.rejects(resumed);
  const retried = service.setPaused(false); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'release');
  reply(fixture.requests[3], { held: false }); await tick();
  assert.equal(fixture.requests[4].options.data.command, 'resume');
  reply(fixture.requests[4]); await tick();
  reply(fixture.requests[5], { status: 'disconnected' }); await retried;
  assert.equal(service.snapshot().state.held, false);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
  assert.equal(service.snapshot().error, '');
});

test('room updates cannot create a playing tour session over an already open question', async context => {
  const { fixture, page, service, state } = setup(context);
  page.ask(); page.startNextSequence(); await tick();
  assert.equal(service.active(), false);
  assert.equal(fixture.requests.length, 0);
  page.closeChat(); await tick();
  assert.equal(fixture.requests[0].options.method, 'POST');
  fixture.requests[0].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state: state() });
  await tick();
  assert.equal(service.active(), true);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
});

for (const phase of ['creating', 'playing']) {
  for (const first of ['pause', 'resume', 'hold', 'release']) {
    for (const second of ['pause', 'resume', 'hold', 'release']) {
      for (const third of ['pause', 'resume', 'hold', 'release']) {
        const commands = [first, second, third];
        test(`overlapping controls while ${phase}: ${commands.join(' then ')}`, async context => {
          const { fixture, page, service, start, state, reply } = setup(context);
          if (phase === 'playing') await start(); else page.startNextSequence();
          let paused = false, held = false, settled = 0;
          const errors = [];
          for (const command of commands) {
            if (command === 'pause') paused = true;
            if (command === 'hold') held = true;
            if (command === 'release') held = false;
            if (command === 'resume') { paused = false; held = false; }
            const operation = command === 'pause' || command === 'resume' ? service.setPaused(command === 'pause')
              : command === 'release' ? service.release() : service.control('hold');
            operation.then(() => { settled++; }, error => { settled++; if (!error.cancelled) errors.push(error); });
          }
          if (phase === 'creating') fixture.requests[0].ok({ sessionId: 'session-1', mediaUrl: '/TourAudioSessions/session-1/media.mp3?ticket=secret', state: state() });
          const answered = new Set();
          for (let attempt = 0; attempt < 16 && settled < commands.length; attempt++) {
            await tick();
            const request = fixture.requests.find(value => /\/control$/.test(value.options.url) && !answered.has(value));
            if (!request) continue;
            answered.add(request);
            const command = request.options.data.command;
            reply(request, command === 'pause' ? { paused: true } : command === 'resume' ? { paused: false }
              : command === 'hold' ? { held: true } : command === 'release' ? { held: false } : { status: 'disconnected' });
          }
          await tick();
          assert.deepEqual(errors, []);
          assert.equal(settled, commands.length, 'every control must settle');
          assert.equal(service.snapshot().pausedIntent, paused);
          assert.equal(service.snapshot().heldIntent, held);
          assert.equal(service.snapshot().state.paused, paused);
          assert.equal(service.snapshot().state.held, held);
          assert.equal(fixture.load('services/audio').snapshot().playing, !paused && !held);
        });
      }
    }
  }
}

test('following driver blocks manual audio controls and browsing cannot select a different stream node', async context => {
  const { fixture, page, service, start, reply, assignments } = setup(context, false, true);
  await start();
  assert.equal(page.data.driverManaged, true);
  page.togglePlay(); page.replay(); page.previous(); page.next();
  page.seek({ detail: { value: 50 } }); page.backAudio(); page.forwardAudio();
  page.playExtraItem({ id: 'extra', url: '/extra.mp3', kind: 'after' });
  await page.enter(1); await tick();
  assert.equal(fixture.requests.length, 1);
  assert.equal(service.active(), true);
  assert.equal(fixture.load('services/audio').snapshot().live, true);
  page.openContent(); await tick();
  assert.equal(page.data.contentOpen, true);
  assert.equal(page.data.stop.id, stageIds[1]);
  assert.equal(fixture.requests[1].options.data.lockContent, false);
  reply(fixture.requests[1], { stageId: stageIds[0], itemId: 'chapter0', itemTitle: '第一站' }); await tick();
  assert.equal(page.data.stop.id, stageIds[1]);
  assert.equal(page.data.playingStopId, stageIds[0]);
  assert.equal(page.data.contentOpen, true);
  assert.equal(assignments(), 1);
  page.closeContent(); await tick();
  assert.equal(page.data.contentOpen, false);
  assert.equal(page.data.stop.id, stageIds[0]);
  assert.equal(page._manualBrowse, false);
  assert.equal(fixture.requests[2].options.data.command, 'preferences');
  assert.equal(fixture.requests[2].options.data.lockContent, false);
  reply(fixture.requests[2]); await tick();
  assert.equal(assignments(), 1);
  assert.ok(!fixture.requests.some(request => ['select', 'preview', 'realign', 'reconnect'].includes(request.options.data?.command)));
});

test('turning following off restores manual playback of the browsed content without leaving the room', async context => {
  const { fixture, page, translation, start, reply, assignments } = setup(context, true, true);
  await start();
  await page.enter(1);
  page.openContent(); await tick();
  reply(fixture.requests[1]); await tick();
  page.toggleTracking(); await tick();
  assert.equal(translation.snapshot().following, false);
  assert.equal(page.data.driverManaged, false);
  assert.equal(page.data.contentOpen, true);
  assert.equal(fixture.requests[2].options.data.following, false);
  reply(fixture.requests[2]); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'preferences');
  assert.equal(fixture.requests[3].options.data.following, false);
  reply(fixture.requests[3]); await tick();
  page.syncDriverFollowing();
  assert.equal(page.data.locationEnabled, false);
  page.togglePlay(); await tick();
  assert.equal(fixture.requests[4].options.data.command, 'preview');
  assert.equal(fixture.requests[4].options.data.stageId, stageIds[1]);
  reply(fixture.requests[4], { stageId: stageIds[1] }); await tick();
  assert.equal(fixture.requests[5].options.data.command, 'resume');
  reply(fixture.requests[5]); await tick();
  assert.equal(fixture.requests[6].options.data.command, 'reconnect');
  reply(fixture.requests[6], { status: 'disconnected' }); await tick();
  assert.equal(assignments(), 2);
  assert.equal(fixture.load('services/audio').snapshot().playing, true);
  assert.equal(translation.snapshot().room.roomId, roomId);
});

test('following recovery preserves the session guide after browsing a node with a different guide', async context => {
  const { fixture, manager, page, service, start, reply, assignments } = setup(context, false, true);
  await start();
  page.data.stops[1].guideNarrations[0].guideId = '9223372036854775800';
  await page.enter(1);
  assert.equal(page.data.guides[0].guideId, '9223372036854775800');
  assert.equal(page.serverAudioOptions().guideId, '9223372036854775801');
  manager.emit('Error', { error: 1004, errorMessage: 'decoder failed' });
  page.retryAudio(); await tick();
  assert.equal(fixture.requests[1].options.data.command, 'realign');
  reply(fixture.requests[1]); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'resume');
  reply(fixture.requests[2]); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'reconnect');
  reply(fixture.requests[3], { status: 'disconnected' }); await tick();
  assert.equal(service.snapshot().sessionId, 'session-1');
  assert.equal(page.data.stop.id, stageIds[1]);
  assert.equal(assignments(), 2);
  assert.equal(fixture.requests.filter(request => /TourAudioSessions$/.test(request.options.url)).length, 1);
});

test('audible node uses the native media clock instead of the server production clock', async context => {
  const { fixture, manager, page, service, start, reply } = setup(context, false, true);
  await start(); manager.currentTime = 142.397;
  const refresh = service.refresh();
  reply(fixture.requests[1], { mediaTimeSeconds: 165.2, stageId: stageIds[1], itemId: 'chapter1', itemTimeSeconds: 2.32,
    timeline: [{ start: 100, end: 162.88, kind: 'route', stageId: stageIds[0], itemId: 'chapter0', title: '第一站', itemStart: 0, duration: 62.88 },
      { start: 162.88, end: 165.2, kind: 'route', stageId: stageIds[1], itemId: 'chapter1', title: '第二站', itemStart: 0, duration: 81.48 }] });
  await tick(); reply(fixture.requests[2]); await refresh;
  assert.equal(page.data.stop.id, stageIds[0]);
  assert.equal(page.data.itemTitle, '第一站');
  assert.equal(page.data.timeLabel, '0:42');
  assert.equal(page.data.audioLag, 23);
  manager.currentTime = 164; manager.emit('TimeUpdate');
  assert.equal(page.data.stop.id, stageIds[1]);
  assert.equal(page.data.itemTitle, '第二站');
});

for (const following of [false, true]) {
  test(`native time progress repairs page playback state with following=${following} when Play is missing`, async context => {
    const { manager, page, start, state } = setup(context, false, following);
    manager.play = () => { manager.paused = false; };
    Object.assign(state(), { stageId: stageIds[0], itemId: 'chapter0', mediaTimeSeconds: 15,
      timeline: [{ start: 0, end: 15, kind: 'route', stageId: stageIds[0], itemId: 'chapter0', title: '什刹海体校', itemStart: 0, duration: 88 }] });
    await start();
    manager.currentTime = 8; manager.emit('TimeUpdate');
    assert.equal(page.data.timeLabel, '0:08');
    assert.equal(page.data.playing, false);
    manager.currentTime = 8.3; manager.emit('TimeUpdate');
    assert.equal(page.data.playing, true);
    assert.equal(page.data.playingStopId, stageIds[0]);
    assert.equal(page.data.durationLabel, '1:28');
    assert.equal(page.data.driverManaged, following);
    if (following) assert.equal(page.data.followStatus, '正在自动讲解');
  });
}

test('following driver recovers a failed native source through one serialized reconnect', async context => {
  const { fixture, manager, service, start, reply, assignments } = setup(context, false, true);
  await start(); manager.emit('Error', { error: 1004, errorMessage: 'decoder failed' }); manager.emit('Play');
  const refresh = service.refresh(); reply(fixture.requests[1]); await tick();
  assert.equal(fixture.requests[2].options.data.command, 'resume');
  reply(fixture.requests[2]); await tick();
  assert.equal(fixture.requests[3].options.data.command, 'reconnect');
  reply(fixture.requests[3], { status: 'disconnected' }); await refresh;
  assert.equal(assignments(), 2);
  assert.equal(fixture.load('services/audio').snapshot().failed, false);
  assert.equal(service.snapshot().recovering, false);
});
