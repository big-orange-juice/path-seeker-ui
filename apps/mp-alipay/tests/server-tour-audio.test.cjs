const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId, plain } = require('./harness.cjs');

const roomId = '9223372036854775806', routeId = '9223372036854775805', visitId = '9223372036854775804';
const stageIds = ['9223372036854775803', '9223372036854775802'];
function setup(context, realRoom = false) {
  const fixture = harness(), manager = fixture.my.createInnerAudioContext();
  fixture.audioContexts.length = 0;
  let assignments = 0;
  Object.defineProperty(manager, 'src', { set(value) { this.url = value; this.currentTime = 0; assignments++; this.play(); } });
  fixture.my.getBackgroundAudioManager = () => manager;
  fixture.load('config').diagnostics = false;
  const room = { room: { roomId, status: 'paused', isHost: false }, following: true, disconnected: false };
  const translation = fixture.load('services/translation-session');
  if (realRoom) {
    fixture.load('services/translation-room').connect = () => ({ close() {}, yieldToTour() {} });
    translation.attach(room.room, 'zh');
  } else translation.snapshot = () => room;
  fixture.load('services/location').watch = () => () => {};
  const page = fixture.page('tour');
  const visit = { visitId, routeId, status: 1, currentStageId: null, visitedStageIds: [], completedStageIds: [] };
  const stops = stageIds.map((id, index) => ({ id, name: '节点' + index, order: index, images: [], extraAudios: [],
    guideNarrations: [{ guideId: '9223372036854775801', locale: 'zh', chapters: [{ id: 'chapter' + index, audioUrl: 'https://media.test/' + index + '.mp3' }] }] }));
  page._rev = 0; page._user = userId; page._visible = true; page._places = [];
  page.setData({ route: { id: routeId }, stops, visit, tourStage: 'navigation', autoplay: true, locationEnabled: true });
  page.showStop(0, true);
  let state = { sessionId: 'session-1', streamId: 'stream-1', revision: 1, status: 'streaming', visitId, routeId,
    stageId: null, paused: false, held: false, queue: [], visit, itemTimeSeconds: 0, itemDurationSeconds: 2 };
  const service = fixture.load('services/tour-audio-session');
  context.after(() => { service.stop(); if (page._serverSubscription) page._serverSubscription(); });
  async function start() {
    page.startNextSequence();
    assert.match(fixture.requests[0].options.url, /TourAudioSessions$/);
    assert.deepEqual(plain(fixture.requests[0].options.data), { roomId, routeId, visitId, guideId: '9223372036854775801',
      startStageId: null, language: 'zh', skipExtra: false, autoplay: true, following: true, roomMuted: false, paused: false, lockContent: false });
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
  reply(fixture.requests[2]); await pending; await tick();
  assert.ok(fixture.requests.every(request => !/RouteVisit/.test(request.options.url)));
  reply(fixture.requests[3]);
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
  const { fixture, manager, page, start } = setup(context);
  await start();
  fixture.my.setClipboard = options => { fixture.clipboard = options.text; };
  manager.emit('Error', { errorMessage: 'https://test/media.mp3?ticket=secret Authorization: Bearer access' });
  page.copyAudioReport();
  const report = JSON.parse(fixture.clipboard);
  assert.equal(report.version, 'tour-audio-recovery-20261111');
  assert.equal(report.sessionId, 'session-1');
  assert.equal(report.player.failed, true);
  assert.equal(report.selectedStageId, stageIds[0]);
  assert.equal(report.hasPlaybackError, true);
  assert.ok(!/ticket|secret|Bearer|access|https:/.test(fixture.clipboard));
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
