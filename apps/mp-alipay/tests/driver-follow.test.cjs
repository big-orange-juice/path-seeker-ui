const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId } = require('./harness.cjs');
const roomId = '9223372036854775805', stageId = '9223372036854775804';
function setup(t, live = true) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  const h = harness(), room = { roomId, status: 'live', isHost: false };
  const translation = h.load('services/translation-session');
  const state = { room, disconnected: false, paused: !live };
  translation.snapshot = () => state;
  const listeners = new Set();
  translation.subscribe = callback => { listeners.add(callback); callback(state); return () => listeners.delete(callback); };
  h.my.getLocation = () => assert.fail('native location must not be called');
  const page = h.page('tour'), center = { longitude: 116.4, latitude: 39.9 };
  page._rev = 0; page._visible = true; page._user = userId; page._places = []; page._detail = { coordinateSystem: 1 };
  page.setData({ tourStage: 'navigation', route: { id: 'route' }, stops: [{ id: stageId, name: '景点', ...center, images: [], guideNarrations: [] }], visit: { visitId: 'visit', status: 1, currentStageId: null, completedStageIds: [] } });
  page._driverPositionKey = roomId + ':visit';
  page.showStop(0, true); page.toggleTracking();
  const gcj = h.load('shared/map-coordinates').wgs84ToGcj02(center);
  const deliver = async (values = {}) => {
    h.requests.at(-1).ok({ roomId, status: 'online', coordinateSystem: 'GCJ-02', ...gcj, accuracy: 10, sampledAt: new Date(Date.now()).toISOString(), serverTime: new Date(Date.now()).toISOString(), ...values });
    await tick();
  };
  return { h, page, deliver, updateRoom(values) { Object.assign(state, values); listeners.forEach(callback => callback(state)); } };
}

test('without joining a room automatic guidance stays off and tapping follow opens room entry', () => {
  const h = harness(), page = h.page('tour'), navigations = [];
  assert.equal(page.data.autoplay, false);
  h.my.navigateTo = value => navigations.push(value.url);
  h.my.getLocation = () => assert.fail('native location must not be called');
  page.watchLocation = () => assert.fail('driver watch must not start without joining');
  page.enableNearbyGuidance();
  assert.equal(page.data.autoplay, false);
  assert.equal(page.data.locationEnabled, false); assert.equal(page.data.following, false);
  assert.equal(navigations.length, 0);
  page.toggleTracking();
  assert.equal(page.data.autoplay, false);
  assert.equal(page.data.locationEnabled, false); assert.equal(page.data.following, false);
  assert.equal(page.data.locationNote, page.data.messages.driverRoomRequired);
  assert.deepEqual(navigations, ['/pages/translation-room/index']);
  assert.equal(h.requests.length, 0);
});

test('joining a connected room enables autoplay and range detection, leaving switches both off', () => {
  const h = harness(), page = h.page('tour');
  const state = { room: null, disconnected: false, following: true };
  h.load('services/translation-session').snapshot = () => state;
  page._visible = true;
  page.setData({ tourStage: 'navigation', visit: { visitId: 'visit', status: 1 } });
  let watches = 0, stops = 0;
  page.watchLocation = () => { watches++; page._watch = () => { stops++; }; };
  page.changeAutoplay({ detail: { value: true } });
  assert.equal(page.data.autoplay, false);
  page.syncDriverFollowing();
  assert.equal(page.data.autoplay, false); assert.equal(page.data.locationEnabled, false);
  state.room = { roomId, status: 'live', isHost: false };
  page.syncDriverFollowing();
  assert.equal(page.data.autoplay, true); assert.equal(page.data.locationEnabled, true);
  assert.equal(watches, 1);
  page.changeAutoplay({ detail: { value: false } });
  page.syncDriverFollowing();
  assert.equal(page.data.autoplay, false);
  state.room = null;
  page.syncDriverFollowing();
  assert.equal(page.data.autoplay, false); assert.equal(page.data.locationEnabled, false);
  assert.equal(stops, 1);
});

test('host, closed and disconnected rooms cannot enable driver following', () => {
  for (const state of [
    { room: { roomId, status: 'live', isHost: true } },
    { room: { roomId, status: 'closed', isHost: false } },
    { room: { roomId, status: 'draining', isHost: false } },
    { room: { roomId, status: 'live', isHost: false }, disconnected: true },
  ]) {
    const h = harness(), page = h.page('tour');
    h.load('services/translation-session').snapshot = () => state;
    page.watchLocation = () => assert.fail('unavailable room must not start following');
    page.enableNearbyGuidance(); page.toggleTracking(); page.toggleLocation({ detail: { value: true } });
    assert.equal(page.data.locationEnabled, false); assert.equal(page.data.following, false);
    assert.equal(h.requests.length, 0);
  }
});

test('leaving a room switches following off and clears its marker and pending countdown', async t => {
  const { page, deliver, updateRoom } = setup(t);
  await deliver(); t.mock.timers.tick(2000); await deliver(); assert.ok(page.data.arrivalCandidate);
  updateRoom({ room: null });
  assert.equal(page.data.locationEnabled, false); assert.equal(page.data.following, false);
  assert.equal(page.data.autoplay, false);
  assert.equal(page._watch, null); assert.equal(page._fix, null); assert.equal(page.data.arrivalCandidate, null);
  assert.equal(page.data.map.markers.some(marker => marker.id === 0), false);
  t.mock.timers.tick(10000); assert.equal(page.data.sequence.length, 0); page.onUnload();
});

test('server membership rejection switches following off instead of leaving a green switch', async t => {
  const { h, page } = setup(t);
  h.requests[0].ok({ message: '请先加入房间' }, 403); await tick();
  assert.equal(page.data.locationEnabled, false); assert.equal(page.data.following, false);
  assert.equal(page._watch, null);
  assert.equal(page.data.locationNote, page.data.messages.driverRoomRequired);
  t.mock.timers.tick(10000); assert.equal(h.requests.length, 1); page.onUnload();
});

test('room driver fixes update the map and queue arrivals while live commentary keeps playback priority', async t => {
  const { h, page, deliver } = setup(t);
  await deliver(); assert.equal(page._fix.source, 'driver'); assert.equal(page.data.map.markers.find(marker => marker.id === 0).title, '车夫位置');
  t.mock.timers.tick(2000); await deliver(); assert.equal(page.data.arrivalCandidate.id, stageId);
  t.mock.timers.tick(3000);
  assert.equal(page.data.sequence[0].id, stageId); assert.equal(page.data.sequence[0].status, 'queued');
  assert.equal(h.requests.some(request => /RouteVisit/.test(request.options.url)), false);
  assert.equal(h.audioContexts.length, 0); page.onUnload();
});

test('stale driver coordinates cancel an active countdown and cannot enqueue a stop', async t => {
  const { page, deliver } = setup(t);
  await deliver(); t.mock.timers.tick(2000); await deliver(); assert.ok(page.data.arrivalCandidate);
  t.mock.timers.tick(1000); await deliver({ status: 'stale', longitude: null, latitude: null });
  assert.equal(page._fix, null); assert.equal(page.data.arrivalCandidate, null);
  t.mock.timers.tick(3000); assert.equal(page.data.sequence.length, 0); page.onUnload();
});

test('turning off driver following aborts the pending query and prevents late arrival triggers', async t => {
  const { h, page, deliver } = setup(t);
  await deliver(); t.mock.timers.tick(2000);
  const pending = h.requests.at(-1); page.toggleTracking(); assert.equal(pending.aborted, true);
  await deliver(); t.mock.timers.tick(20000);
  assert.equal(page.data.locationEnabled, false); assert.equal(page._fix, null); assert.equal(page.data.sequence.length, 0);
  assert.equal(page.data.map.markers.some(marker => marker.id === 0), false); page.onUnload();
});

test('reconnecting restarts following after acknowledgement and preserves a manual off preference', async t => {
  const { h, page, updateRoom } = setup(t);
  const state = h.load('services/translation-session').snapshot();
  const unsubscribe = h.load('services/translation-session').subscribe(() => page.syncDriverFollowing());
  t.after(unsubscribe);
  updateRoom({ disconnected: true, reconnecting: true, following: true });
  assert.equal(page.data.locationEnabled, false);
  assert.equal(page.data.autoplay, false);
  assert.equal(h.requests[0].aborted, true);
  updateRoom({ disconnected: false, reconnecting: false });
  assert.equal(page.data.locationEnabled, true);
  assert.equal(page.data.autoplay, true);
  assert.equal(page.data.following, true);
  assert.equal(h.requests.length, 2);
  h.load('services/translation-session').setFollowing = value => { state.following = value; };
  page.toggleTracking();
  updateRoom({ disconnected: true, reconnecting: true });
  updateRoom({ disconnected: false, reconnecting: false });
  page.enableNearbyGuidance();
  assert.equal(page.data.locationEnabled, false);
  assert.equal(page.data.autoplay, false);
  assert.equal(h.requests.length, 2);
  page.onUnload();
});
