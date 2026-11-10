const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId, plain } = require('./harness.cjs');

const roomId = '9223372036854775805';
const routeId = '9223372036854775804';
const stageIds = ['9223372036854775803', '9223372036854775802', '9223372036854775801', '9223372036854775800', '9223372036854775799'];

function setup({ live = false } = {}) {
  const h = harness(), page = h.page('tour');
  const state = { room: { roomId, status: 'live', isHost: false }, paused: !live, disconnected: false, following: true };
  const translation = h.load('services/translation-session');
  translation.snapshot = () => state;
  translation.setFollowing = value => { state.following = value; };
  h.my.getLocation = () => assert.fail('following uses the driver location');
  let onLocation;
  h.load('services/location').watch = callback => { onLocation = callback; return () => {}; };
  const stops = stageIds.map((id, index) => ({
    id, name: ['起点', '恭王府', '途经站', '银锭桥', '下一站'][index], order: index + 1,
    longitude: 116.38 + index * 0.003, latitude: 39.94, images: [], extraAudios: [],
    guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'chapter-' + id, audioUrl: '/' + id + '.mp3' }] }],
  }));
  const visit = { visitId: 'visit', routeId, status: 1, currentStageId: stageIds[0], completedStageIds: [], visitedStageIds: [] };
  page._rev = 0; page._visible = true; page._user = userId; page._places = []; page._detail = { coordinateSystem: 1 };
  page.setData({ route: { id: routeId, title: 'A线' }, stops, visit, tourStage: 'navigation', autoplay: true, locationEnabled: true });
  page.showStop(0, true);
  page.watchLocation();
  const fix = (index = 3, overrides = {}) => ({ ...stops[index], timestamp: Date.now(), accuracy: 10, source: 'driver', roomId, ...overrides });
  return { h, page, state, stops, visit, fix, deliver(index = 3, overrides = {}) { onLocation(fix(index, overrides)); } };
}

test('back to now clears the old queue and interrupted preview, then starts Yinding Bridge from the beginning', async () => {
  const { h, page, visit, fix } = setup();
  page.sequenceStatus(stageIds[0], 'completed', 0);
  page.sequenceStatus(stageIds[1], 'queued', 1);
  page.sequenceStatus(stageIds[2], 'queued', 2);
  page.sequenceStatus(stageIds[4], 'queued', 4);
  page.setData({ visit: { ...visit, completedStageIds: [stageIds[0]] } });
  page._manualBrowse = true; page.showStop(1, true); page.play();
  const previousAudio = h.audioContexts[0];
  page._roomResume = page.capturePlayback();
  page._fix = fix();
  page.returnToNow();
  assert.equal(previousAudio.stopped, true);
  assert.equal(page.data.stop.id, stageIds[3]);
  assert.equal(page.data.driverAligning, false);
  assert.equal(page._manualBrowse, false);
  assert.equal(page._roomResume, null);
  assert.deepEqual(plain(page.data.sequence.map(item => ({ id: item.id, status: item.status }))), [{ id: stageIds[3], status: 'queued' }]);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].options.data.stageId, stageIds[3]);
  assert.equal(h.requests[0].options.data.action, 'start');
  h.requests[0].ok({ ...visit, currentStageId: stageIds[3], completedStageIds: [stageIds[0]] });
  await tick();
  assert.equal(h.load('services/audio').snapshot().item.id, 'chapter-' + stageIds[3]);
  assert.equal(h.load('services/audio').snapshot().time, 0);
  assert.equal(page.data.contentOpen, false);
  assert.deepEqual(plain(page.data.visit.completedStageIds), [stageIds[0]]);
  const storage = h.load('services/storage');
  const saved = storage.read(storage.scoped(userId, 'sequence'));
  assert.deepEqual(plain(saved.items.map(item => item.id)), [stageIds[3]]);
  page.onUnload();
});

test('starting again in a joined room locates the driver before entering any stage', async () => {
  const { h, page, visit, deliver } = setup();
  page.setData({ visit: { ...visit, status: 3 }, tourStage: 'overview', locationEnabled: false });
  const starting = page.startVisit();
  assert.match(h.requests[0].options.url, /RouteVisit\/Start$/);
  const fresh = { ...visit, visitId: 'new-visit', currentStageId: null };
  h.requests[0].ok(fresh);
  await starting;
  assert.equal(page.data.driverAligning, true);
  assert.equal(h.requests.length, 1);
  assert.equal(h.audioContexts.length, 0);
  deliver();
  assert.equal(page.data.stop.id, stageIds[3]);
  assert.equal(h.requests[1].options.data.stageId, stageIds[3]);
  h.requests[1].ok({ ...fresh, currentStageId: stageIds[3] }); await tick();
  assert.equal(h.load('services/audio').snapshot().item.id, 'chapter-' + stageIds[3]);
  assert.equal(page.data.sequence.filter(item => item.status === 'skipped').length, 3);
  page.onUnload();
});

test('joining a room during an active visit aligns before playing an old pending stop', async () => {
  const { h, page, state, visit, deliver } = setup();
  page.setData({ locationEnabled: false, autoplay: false });
  page._watch = null;
  page._pendingPlayback = { key: page.contextKey(), automatic: true };
  page.sequenceStatus(stageIds[0], 'queued', 0);
  page.syncDriverFollowing();
  assert.equal(page.data.driverAligning, true);
  page.startNextSequence();
  assert.equal(h.requests.length, 0);
  assert.equal(h.audioContexts.length, 0);
  deliver();
  assert.equal(h.requests[0].options.data.stageId, stageIds[3]);
  h.requests[0].ok({ ...visit, currentStageId: stageIds[3] }); await tick();
  state.room = null; page.syncDriverFollowing();
  assert.equal(page.data.driverAligning, false);
  assert.equal(page.data.locationEnabled, false);
  page.onUnload();
});

test('stale or inaccurate positions and positions away from stops never start the old queue', () => {
  for (const overrides of [{ timestamp: Date.now() - 60000 }, { accuracy: 200 }, { longitude: 117 }]) {
    const { h, page, fix, deliver } = setup({ live: true });
    page.sequenceStatus(stageIds[0], 'queued', 0);
    page._fix = fix(3, overrides);
    page.returnToNow();
    page.startNextSequence();
    assert.equal(page.data.driverAligning, true);
    assert.equal(h.requests.length, 0);
    assert.equal(h.audioContexts.length, 0);
    assert.equal(page.data.sequence.length, 0);
    assert.equal(page.data.queuedCount, 0);
    const storage = h.load('services/storage');
    assert.deepEqual(plain(storage.read(storage.scoped(userId, 'sequence')).items), []);
    deliver();
    assert.equal(page.data.driverAligning, false);
    assert.equal(page.data.stop.id, stageIds[3]);
    assert.deepEqual(plain(page.data.sequence.map(item => item.id)), [stageIds[3]]);
    page.onUnload();
  }
});

test('live room commentary retains priority after snapping to the current stop', async () => {
  const { h, page, state, visit, fix } = setup({ live: true });
  page._fix = fix(); page.returnToNow();
  assert.equal(page.data.stop.id, stageIds[3]);
  assert.equal(page.data.sequence.find(item => item.id === stageIds[3]).status, 'queued');
  assert.equal(h.requests.length, 0); assert.equal(h.audioContexts.length, 0);
  state.paused = true; page.syncRoomPlayback(); page.startNextSequence();
  assert.equal(h.requests[0].options.data.stageId, stageIds[3]);
  h.requests[0].ok({ ...visit, currentStageId: stageIds[3] }); await tick();
  assert.equal(h.load('services/audio').snapshot().item.id, 'chapter-' + stageIds[3]);
  page.onUnload();
});

test('an ended room, another room position or a switched account cannot redirect playback', () => {
  for (const change of ['closed', 'room', 'account']) {
    const { h, page, state, fix, deliver } = setup();
    page._fix = fix(3, { roomId: 'another-room' });
    page.returnToNow();
    assert.equal(h.requests.length, 0);
    if (change === 'closed') { state.room = null; page.syncDriverFollowing(); }
    if (change === 'room') state.room = { ...state.room, roomId: 'another-room' };
    if (change === 'account') h.auth.logout();
    deliver();
    assert.equal(h.requests.length, 0); assert.equal(h.audioContexts.length, 0);
    assert.equal(page.data.stop.id, stageIds[0]);
    page.onUnload();
  }
});

test('releasing room audio while waiting for a location cannot restore the old preview', () => {
  const { h, page, state, fix } = setup();
  page.showStop(1, true); page.play();
  state.paused = false; page.syncRoomPlayback();
  assert.ok(page._roomResume);
  page._fix = fix(3, { timestamp: Date.now() - 60000 }); page.returnToNow();
  page.syncRoomPlayback();
  state.paused = true; page.syncRoomPlayback(); page.startNextSequence();
  assert.equal(page.data.driverAligning, true);
  assert.equal(h.load('services/audio').snapshot().item, null);
  assert.equal(h.requests.length, 0);
  page.onUnload();
});

test('completed stops can be replayed at the current position without completing skipped stops', () => {
  const { h, page, visit, fix } = setup();
  page.setData({ visit: { ...visit, completedStageIds: [stageIds[3]] } });
  page._fix = fix(); page.returnToNow();
  assert.equal(h.requests.length, 0);
  assert.equal(page.data.browsing, true);
  assert.equal(h.load('services/audio').snapshot().item.id, 'chapter-' + stageIds[3]);
  assert.equal(page.data.sequence.find(item => item.id === stageIds[3]).status, 'completed');
  assert.deepEqual(plain(page.data.visit.completedStageIds), [stageIds[3]]);
  page.onUnload();
});

test('location alignment still respects a terminal stop prerequisite', () => {
  const { h, page, stops, fix } = setup({ live: true });
  stops[4].autoTriggerPrerequisiteStageId = stageIds[2];
  stops[4].longitude = stops[0].longitude;
  page._fix = fix(0); page.returnToNow();
  assert.equal(page.data.stop.id, stageIds[0]);
  assert.equal(page.data.sequence.some(item => item.id === stageIds[4]), false);
  assert.equal(h.requests.length, 0);
  page.onUnload();
});

test('without driver following the back-to-now action leaves manual browsing intact', () => {
  const { h, page, fix } = setup();
  page.setData({ locationEnabled: false }); page._fix = fix(); page._manualBrowse = true;
  page.returnToNow();
  assert.equal(page._manualBrowse, true); assert.equal(page.data.stop.id, stageIds[0]);
  assert.equal(h.requests.length, 0);
  page.onUnload();
});
