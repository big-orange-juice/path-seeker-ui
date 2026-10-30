const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId, plain } = require('./harness.cjs');
const nearId = '9223372036854775804', farId = '9223372036854775803';
function setup(t) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  const h = harness(), page = h.page('tour');
  const stops = [
    { id: 'current', name: '当前站', order: 1, longitude: 116, latitude: 39 },
    { id: farId, name: '稍远的景点', order: 2, longitude: 116.383, latitude: 39.9373 },
    { id: nearId, name: '近处的景点', order: 3, longitude: 116.383, latitude: 39.93705, images: [{ url: 'https://example.com/stop.jpg' }] },
  ].map(stop => ({ images: [], guideNarrations: [], ...stop }));
  page._rev = 0; page._visible = true; page._user = userId; page._places = []; page._detail = { coordinateSystem: 1 };
  page.setData({ tourStage: 'navigation', route: { id: 'route' }, stops, visit: { visitId: 'visit', status: 1, currentStageId: 'current', completedStageIds: [] }, browsing: true });
  let fix, error;
  h.load('services/location').watch = (onFix, onError) => { fix = onFix; error = onError; return () => {}; };
  page.toggleTracking();
  const deliver = (overrides = {}) => fix({ longitude: 116.383, latitude: 39.937, accuracy: 35, timestamp: Date.now(), ...overrides });
  const stable = () => { deliver(); t.mock.timers.tick(2000); deliver(); };
  return { h, page, deliver, stable, error };
}

test('nearest stop shows its image, repeated fixes do not extend three seconds, and only that stop queues', t => {
  const { page, h, deliver, stable } = setup(t); stable();
  assert.equal(page.data.arrivalCandidate.id, nearId);
  assert.equal(page.data.arrivalCandidate.imageUrl, 'https://example.com/stop.jpg');
  assert.match(page.data.arrivalCountdown, /3/); assert.equal(page.data.sequence.length, 0);
  t.mock.timers.tick(1000); deliver(); assert.match(page.data.arrivalCountdown, /2/);
  t.mock.timers.tick(1999); assert.equal(page.data.sequence.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(plain(page.data.sequence.map(stop => stop.id)), [nearId]);
  assert.equal(h.requests[0].options.data.stageId, nearId);
  assert.equal(page.data.arrivalCandidate, null); assert.equal(page._arrivalTimer, null);
  deliver(); assert.equal(page.data.arrivalCandidate, null);
});

test('choosing another stop restarts its countdown and queues the chosen string ID', t => {
  const { page, stable } = setup(t); page.setData({ autoplay: false }); stable();
  t.mock.timers.tick(2000); page.cycleArrivalCandidate();
  assert.equal(page.data.arrivalCandidate.id, farId); assert.equal(page.data.arrivalCandidate.imageUrl, '');
  t.mock.timers.tick(1000); assert.equal(page.data.sequence.length, 0);
  t.mock.timers.tick(2000); assert.deepEqual(plain(page.data.sequence.map(stop => stop.id)), [farId]);
  assert.equal(page.data.arrivalCandidate, null);
});

test('arrival queues behind ongoing narration without changing the current stop or audio', t => {
  const { h, page, stable } = setup(t);
  page.setData({ stop: page.data.stops[0], browsing: false });
  h.load('services/audio').snapshot = () => ({ owner: 'tour', playing: true });
  stable(); t.mock.timers.tick(3000);
  assert.equal(page.data.sequence[0].id, nearId); assert.equal(page.data.stop.id, 'current');
  assert.equal(h.requests.length, 0); assert.equal(page.data.arrivalCandidate, null);
});

test('dismiss, weak GPS, lost range, overlays, page exit and route/account changes cancel pending arrival', t => {
  for (const change of [
    ({ page }) => page.dismissCandidates(),
    ({ deliver }) => deliver({ accuracy: 100 }),
    ({ deliver }) => deliver({ latitude: 40 }),
    ({ error }) => error({ denied: true }),
    ({ page }) => page.toggleTracking(),
    ({ page }) => page.toggleQueue(),
    ({ page }) => { page.setData({ stop: page.data.stops[0] }); page.openContent(); },
    ({ page }) => page.setData({ chatOpen: true }),
    ({ page }) => page.onHide(),
    ({ page }) => page.showStop(1),
    ({ page }) => page.setData({ route: { id: 'other' } }),
    ({ page }) => page.setData({ visit: { ...page.data.visit, visitId: 'other' } }),
    ({ page }) => { page._user = 'other'; },
  ]) {
    const state = setup(t); state.stable(); assert.ok(state.page.data.arrivalCandidate);
    change(state); t.mock.timers.tick(3000);
    assert.equal(state.page.data.arrivalCandidate, null); assert.equal(state.page.data.sequence.length, 0); assert.equal(state.h.requests.length, 0);
    t.mock.timers.reset();
  }
});

test('stale position at expiry does not queue and an explicit tap enters once before expiry', async t => {
  const state = setup(t); state.stable();
  state.page._fix.timestamp -= 16000; t.mock.timers.tick(3000);
  assert.equal(state.page.data.arrivalCandidate, null); assert.equal(state.h.requests.length, 0);
  state.stable();
  state.page.enterCandidate({ currentTarget: { dataset: { id: nearId } } });
  assert.equal(state.h.requests[0].options.data.stageId, nearId);
  state.h.requests[0].ok({ visitId: 'visit', status: 1, currentStageId: nearId, completedStageIds: [] }); await tick();
  t.mock.timers.tick(3000); assert.equal(state.h.requests.length, 1); assert.equal(state.page.data.stop.id, nearId);
});

test('enabling guidance follows repeated native fixes and 3D focus preserves location instead of first stop', t => {
  const { page, deliver } = setup(t);
  page.setData({ 'map.markers': [{ id: 1, longitude: 116.4, latitude: 39.95 }] });
  deliver({ gcj: { longitude: 116.39, latitude: 39.94 } });
  assert.equal(page.data.following, true); assert.equal(page.data.map.longitude, 116.39);
  page.focusNavigationMap(); assert.equal(page.data.map.longitude, 116.39); assert.equal(page.data.following, true);
  deliver({ gcj: { longitude: 116.391, latitude: 39.941 } }); assert.equal(page.data.map.longitude, 116.391);
  deliver({ gcj: { longitude: 116.8, latitude: 40 }, accuracy: 100 }); assert.equal(page.data.map.longitude, 116.391);
  page.toggleFollow(); deliver({ gcj: { longitude: 116.392, latitude: 39.942 } }); assert.equal(page.data.map.longitude, 116.391);
  page.focusNavigationMap(); assert.equal(page.data.map.longitude, 116.4);
  page.toggleFollow(); assert.equal(page.data.map.longitude, 116.392);
});

test('stationary GPS preserves a dragged viewport while marker and proximity callbacks keep updating', t => {
  const { h, page, deliver } = setup(t);
  let viewport = null;
  const cameraUpdates = [];
  h.my.createMapContext = () => ({ updateComponents(value) { cameraUpdates.push(value); viewport = { longitude: value.longitude, latitude: value.latitude }; } });
  const point = { longitude: 116.39, latitude: 39.94 };
  deliver({ gcj: point, heading: 0 });
  assert.equal(cameraUpdates.length, 1);
  viewport = { longitude: 116.4, latitude: 39.95 };
  deliver({ gcj: point, heading: 90, accuracy: 20 });
  assert.equal(cameraUpdates.length, 1); assert.equal(page.data.mapRotation, 0);
  assert.deepEqual(viewport, { longitude: 116.4, latitude: 39.95 });
  deliver({ gcj: { ...point, latitude: point.latitude + 2 / 111195 } });
  deliver({ gcj: { ...point, latitude: point.latitude + 4 / 111195 } });
  assert.equal(cameraUpdates.length, 1);
  assert.notEqual(page.data.map.markers.find(marker => marker.id === 0).latitude, point.latitude);
  assert.ok(page._dwell);
  const moved = { ...point, latitude: point.latitude + 6 / 111195 };
  deliver({ gcj: moved, heading: 45 });
  assert.equal(cameraUpdates.length, 2); assert.deepEqual(viewport, moved); assert.equal(page.data.mapRotation, 45);
});

test('explicitly reopening follow or guidance recentres the same GPS position after dragging', t => {
  const { page, h, deliver } = setup(t);
  const updates = [];
  h.my.createMapContext = () => ({ updateComponents(value) { updates.push(value); } });
  const point = { longitude: 116.39, latitude: 39.94 };
  deliver({ gcj: point }); assert.equal(updates.length, 1);
  page.toggleFollow(); assert.equal(page.data.following, false);
  page.toggleFollow(); assert.equal(updates.length, 2); assert.equal(updates[1].longitude, point.longitude);
  page.toggleTracking(); page.toggleTracking();
  deliver({ gcj: point }); assert.equal(updates.length, 3);
  deliver({ gcj: point, accuracy: 10 }); assert.equal(updates.length, 3);
  deliver({ gcj: { longitude: 116.4, latitude: 40 }, accuracy: 100 }); assert.equal(updates.length, 3);
  deliver({ gcj: point }); assert.equal(updates.length, 3);
});

test('missing ranges use a 50-metre point radius and route fallback coordinates use the route system', () => {
  const tour = harness().load('core/tour'), fix = { longitude: 116.383, latitude: 39.937, accuracy: 35, timestamp: Date.now() };
  const stop = { id: nearId, placeId: 'place', longitude: fix.longitude, latitude: fix.latitude + 49 / 111195 };
  assert.equal(tour.candidates([stop], [], fix, [])[0].id, nearId);
  assert.equal(tour.candidates([{ ...stop, latitude: fix.latitude + 51 / 111195 }], [], fix, []).length, 0);
  assert.equal(tour.candidates([{ ...stop, triggerRadiusMeters: 60, latitude: fix.latitude + 55 / 111195 }], [], fix, []).length, 1);
  const gcj = require('../dist/shared/map-coordinates').toGcj02(fix, 1);
  for (const range of [null, { type: 'polygon', boundaryGeoJson: null }, { type: 'circle', radiusMeters: null }]) {
    const result = tour.candidates([{ ...stop, ...gcj }], [{ id: 'place', range }], fix, [], 2);
    assert.equal(result[0].id, nearId); assert.ok(result[0].distance < 2);
  }
  const missing = { ...stop, longitude: null, latitude: null };
  assert.equal(tour.candidates([missing], [], fix, []).length, 0);
});

test('circle and polygon distances use their boundary and configured thresholds', () => {
  const h = harness(), tour = h.load('core/tour');
  const fix = { longitude: 116.383, latitude: 39.937, accuracy: 35, timestamp: Date.now() };
  const stop = { id: nearId, placeId: 'place', ...fix };
  const place = { id: 'place', longitude: fix.longitude, latitude: fix.latitude + 100 / 111195, range: { type: 'circle', radiusMeters: 60 } };
  const circle = tour.candidates([stop], [place], fix, [])[0];
  assert.ok(circle.distance > 39 && circle.distance < 41); assert.equal(circle.withinRange, false);
  assert.equal(tour.candidates([stop], [{ ...place, range: { ...place.range, proximityDistanceMeters: 30 } }], fix, []).length, 0);
  const ring = [[116.38, 39.93], [116.39, 39.93], [116.39, 39.94], [116.38, 39.94], [116.38, 39.93]];
  const polygon = tour.candidates([stop], [{ id: 'place', range: { type: 'polygon', boundaryGeoJson: JSON.stringify({ type: 'Polygon', coordinates: [ring] }) } }], fix, [])[0];
  assert.equal(polygon.withinRange, true); assert.equal(polygon.distance, 0);
});
