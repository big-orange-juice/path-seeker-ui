const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, userId, tick } = require('./harness.cjs');

function setup(t) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  const h = harness(), page = h.page('tour'), audio = h.load('services/audio');
  page.driverRoomAvailable = () => true;
  const center = { longitude: 116.3856068, latitude: 39.9377928 };
  const stops = ['current', 'bar'].map((id, index) => ({ id, placeId: 'p-' + id, order: index + 1, name: id, ...center,
    images: [], guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'c-' + id, audioUrl: '/' + id + '.mp3' }] }] }));
  h.my.createVideoContext = () => ({ play() {}, pause() {}, seek() {} });
  page._rev = 0; page._visible = true; page._user = userId; page._detail = { coordinateSystem: 1 };
  page._places = stops.map(stop => ({ id: stop.placeId, ...center, range: { type: 'circle', radiusMeters: 30, proximityDistanceMeters: 5, releaseDistanceMeters: 15 } }));
  page.setData({ route: { id: 'route' }, stops, tourStage: 'navigation', visit: { visitId: 'visit', routeId: 'route', status: 1, currentStageId: 'current', completedStageIds: [] } });
  page.showStop(0, false);
  let callback;
  h.load('services/location').watch = onFix => { callback = onFix; return () => {}; };
  page.toggleTracking();
  const fix = metres => callback({ longitude: center.longitude, latitude: center.latitude + metres / 111195.0802335329, accuracy: 10, timestamp: Date.now() });
  return { h, page, audio, stops, fix };
}

test('background fixes queue an arrival only after a fresh stable dwell and gaps restart that dwell', t => {
  const { page, fix } = setup(t); page.setData({ autoplay: false });
  page.onHide(); fix(0);
  t.mock.timers.tick(16000); fix(0);
  assert.equal(page.data.sequence.length, 0);
  t.mock.timers.tick(2000); fix(0);
  assert.equal(page.data.sequence.length, 1);
  assert.equal(page.data.sequence[0].id, 'bar');
  assert.equal(page.data.arrivalCandidate, null);
  page.onUnload();
});

test('a 30m circle enters at 35m and retains its countdown through jitter up to the 45m release boundary', t => {
  const { page, fix } = setup(t); page.setData({ autoplay: false });
  fix(34); t.mock.timers.tick(2000); fix(38);
  assert.equal(page.data.arrivalCandidate && page.data.arrivalCandidate.id, 'bar');
  t.mock.timers.tick(1000); fix(40); t.mock.timers.tick(2000);
  assert.equal(page.data.sequence.length, 1); assert.equal(page.data.sequence[0].id, 'bar');
  page.onUnload();
});

test('the release band cannot trigger a new arrival and leaving it resets the approach', t => {
  const { page, fix } = setup(t); page.setData({ autoplay: false });
  fix(38); t.mock.timers.tick(2000); fix(38); assert.equal(page.data.arrivalCandidate, null);
  fix(34); t.mock.timers.tick(2000); fix(34); assert.ok(page.data.arrivalCandidate);
  fix(46); assert.equal(page.data.arrivalCandidate, null);
  t.mock.timers.tick(4000); fix(40); assert.equal(page.data.sequence.length, 0);
  fix(34); t.mock.timers.tick(2000); fix(34); assert.ok(page.data.arrivalCandidate);
  page.onUnload();
});

test('closing chat while room audio is busy retains narration recovery until the room yields', t => {
  const { h, page, audio } = setup(t);
  page.play(); const original = h.audioContexts[0]; original.currentTime = 23;
  page.ask();
  let roomBusy = true;
  h.load('services/translation-session').snapshot = () => ({ audioPlaying: roomBusy });
  page.closeChat(); assert.equal(audio.snapshot().playing, false);
  roomBusy = false; page.startNextSequence(); page.startNextSequence();
  assert.equal(audio.snapshot().playing, true); assert.equal(audio.snapshot().time, 23);
  assert.equal(h.audioContexts.length, 1); assert.equal(h.requests.length, 0);
  page.onUnload();
});

test('returning while room audio is busy retains the checkpoint after the room replaces the tour player', t => {
  const { h, page, audio } = setup(t);
  page.play(); h.audioContexts[0].currentTime = 19; page.onHide();
  let roomBusy = true;
  h.load('services/translation-session').snapshot = () => ({ audioPlaying: roomBusy });
  audio.playQueue('translation-room', [{ id: 'room', url: '/room.mp3' }]); page.onShow();
  assert.equal(audio.snapshot().owner, 'translation-room');
  roomBusy = false; audio.stop('translation-room'); page.startNextSequence();
  assert.equal(audio.snapshot().owner, 'tour'); assert.equal(audio.snapshot().item.id, 'c-current');
  assert.equal(audio.snapshot().time, 19); assert.equal(audio.snapshot().playing, true);
  page.onUnload();
});

test('a late video end during chat keeps the following audio paused until chat closes', t => {
  const { h, page, audio, stops } = setup(t);
  stops[0].guideNarrations = []; stops[0].video = '/bar.mp4';
  stops[0].extraAudios = [{ id: 'after', position: 'after', url: '/after.mp3' }];
  page.showStop(0, false); page.play(); const video = page.data.videoItem;
  page.videoPlay({ currentTarget: { dataset: video } }); page.ask();
  page.videoEnded({ currentTarget: { dataset: video } });
  assert.equal(audio.snapshot().item.id, 'after'); assert.equal(audio.snapshot().playing, false);
  page.closeChat(); assert.equal(audio.snapshot().playing, true); assert.equal(audio.snapshot().item.id, 'after');
  assert.equal(h.requests.length, 0);
  page.onUnload();
});

test('late native video play after hiding remains paused even when background audio is enabled', t => {
  const { page, audio, stops } = setup(t);
  stops[0].guideNarrations = []; stops[0].video = '/bar.mp4';
  page.showStop(0, false); page.play(); const video = page.data.videoItem;
  page.onHide(); page.videoPlay({ currentTarget: { dataset: video } });
  assert.equal(audio.snapshot().playing, false);
  page.onShow(); assert.equal(audio.snapshot().requested, true);
  page.onUnload();
});

test('native pause emitted at natural video end still continues without an explicit pause request', t => {
  const { page, audio, stops } = setup(t);
  stops[0].guideNarrations = []; stops[0].video = '/bar.mp4';
  stops[0].extraAudios = [{ id: 'after', position: 'after', url: '/after.mp3' }];
  page.showStop(0, false); page.play(); const video = page.data.videoItem;
  page.videoPlay({ currentTarget: { dataset: video } }); page.videoPause({ currentTarget: { dataset: video } });
  page.videoEnded({ currentTarget: { dataset: video } });
  assert.equal(audio.snapshot().item.id, 'after'); assert.equal(audio.snapshot().playing, true);
  page.onUnload();
});

test('a deferred recovery cannot restart audio after returning to route overview', t => {
  const { h, page, audio } = setup(t); page.play(); page.ask();
  let roomBusy = true;
  h.load('services/translation-session').snapshot = () => ({ audioPlaying: roomBusy });
  page.closeChat(); page.backToOverview(); roomBusy = false; page.startNextSequence();
  assert.equal(audio.snapshot().playing, false); page.onUnload();
});

test('an explicitly paused narration is not resurrected after room playback yields', t => {
  const { h, page, audio } = setup(t); page.play(); page.ask();
  let roomBusy = true;
  h.load('services/translation-session').snapshot = () => ({ audioPlaying: roomBusy });
  page.closeChat(); page._userPaused = true; roomBusy = false; page.startNextSequence();
  assert.equal(audio.snapshot().playing, false); assert.equal(page._deferredResume, null);
  page.onUnload();
});

test('weak and stale GPS cancel a retained edge countdown without allowing the release band to reenter', t => {
  const { page, fix } = setup(t); page.setData({ autoplay: false });
  fix(34); t.mock.timers.tick(2000); fix(38); assert.ok(page.data.arrivalCandidate);
  page._fix.accuracy = 100; t.mock.timers.tick(1000);
  assert.equal(page.data.arrivalCandidate, null);
  page._fix.accuracy = 10; page._fix.timestamp -= 16000; t.mock.timers.tick(3000);
  assert.equal(page.data.sequence.length, 0); page.onUnload();
});

test('a countdown delayed beyond GPS freshness forgets the old retained approach', t => {
  const { page, fix } = setup(t); page.setData({ autoplay: false });
  fix(34); t.mock.timers.tick(2000); fix(34); assert.ok(page.data.arrivalCandidate);
  t.mock.timers.tick(16000); assert.equal(page.data.arrivalCandidate, null);
  fix(40); assert.equal(page.data.arrivalCandidate, null);
  assert.equal(page.data.sequence.length, 0); page.onUnload();
});

test('a queued prerequisite retries a failed arrival write so the return stop can unlock before playback catches up', async t => {
  const { h, page, fix, stops } = setup(t);
  stops.push({ id: 'terminal', order: 3, autoTriggerPrerequisiteStageId: 'bar', images: [] });
  page.play(); page.enqueueCandidates([{ id: 'bar', index: 1, distance: 0, order: 2 }]);
  assert.equal(h.requests[0].options.data.action, 'arrive');
  h.requests[0].reject({ errorMessage: '网络错误' }); await tick();
  fix(0); t.mock.timers.tick(6000); fix(0); await tick();
  assert.equal(h.requests.length, 2); assert.equal(h.requests[1].options.data.action, 'arrive');
  h.requests[1].ok({ ...page.data.visit, visitedStageIds: ['bar'] }); await tick();
  assert.ok(page.data.visit.visitedStageIds.includes('bar')); assert.equal(page.data.stop.id, 'current');
  page.onUnload();
});

test('a slow progress request does not discard a nearby arrival while playback is busy', t => {
  const { h, page, fix } = setup(t); page.setData({ busy: true });
  fix(0); t.mock.timers.tick(2000); fix(0); t.mock.timers.tick(3000);
  assert.equal(page.data.sequence.find(item => item.id === 'bar')?.status, 'queued');
  assert.equal(h.requests.length, 0);
  page.setData({ busy: false, browsing: true }); page.startNextSequence();
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].options.data.stageId, 'bar');
  page.onUnload();
});

test('audio finishing in the background prepares the next video paused and return resumes it', t => {
  const { h, page, audio, stops } = setup(t);
  stops[0].video = '/bar.mp4'; page.showStop(0, false); page.play(); page.onHide();
  h.audioContexts[0].emit('Ended');
  assert.equal(audio.snapshot().item.kind, 'interlude-video');
  assert.equal(page.data.videoItem.paused, true); assert.equal(audio.snapshot().requested, false);
  page.onShow(); assert.equal(audio.snapshot().requested, true);
  page.onUnload();
});

test('same-ID authentication changes cannot consume old pending playback before page reset', async t => {
  const { h, page, audio } = setup(t);
  page._authVersion = h.auth.version();
  page._pendingPlayback = { key: page.contextKey(), automatic: true };
  const signing = h.auth.login({ account: 'new', password: 'password' });
  h.requests[0].ok({ ...h.auth.current(), isGuest: false }); await signing;
  page.startNextSequence();
  assert.equal(audio.snapshot().item, null);
  page.onUnload();
});
