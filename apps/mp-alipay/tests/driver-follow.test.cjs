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
  translation.subscribe = callback => { callback(state); return () => {}; };
  h.my.getLocation = () => assert.fail('native location must not be called');
  const page = h.page('tour'), center = { longitude: 116.4, latitude: 39.9 };
  page._rev = 0; page._visible = true; page._user = userId; page._places = []; page._detail = { coordinateSystem: 1 };
  page.setData({ tourStage: 'navigation', route: { id: 'route' }, stops: [{ id: stageId, name: '景点', ...center, images: [], guideNarrations: [] }], visit: { visitId: 'visit', status: 1, currentStageId: null, completedStageIds: [] } });
  page.showStop(0, true); page.toggleTracking();
  const gcj = h.load('shared/map-coordinates').wgs84ToGcj02(center);
  const deliver = async (values = {}) => {
    h.requests.at(-1).ok({ roomId, status: 'online', coordinateSystem: 'GCJ-02', ...gcj, accuracy: 10, sampledAt: new Date(Date.now()).toISOString(), serverTime: new Date(Date.now()).toISOString(), ...values });
    await tick();
  };
  return { h, page, deliver };
}

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
