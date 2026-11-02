const test = require('node:test');
const assert = require('node:assert/strict');
const { createRouteMatcher } = require('../dist/core/route-location');
const { gcj02ToWgs84 } = require('../dist/shared/map-coordinates');
const { harness, userId, plain } = require('./harness.cjs');

const baseTime = Date.now();
const latitudeScale = 111195.0802335329;
const longitudeScale = latitudeScale * Math.cos(39.94 * Math.PI / 180);
function point(east, north) { return { longitude: 116.38 + east / longitudeScale, latitude: 39.94 + north / latitudeScale }; }
function fix(east, north, step, accuracy = 25) {
  const gcj = point(east, north);
  return { ...gcj02ToWgs84(gcj), gcj, accuracy, timestamp: baseTime + step * 3000, heading: 90 };
}
function apply(matcher, measurement, roads) { return matcher.match(measurement, roads, measurement.timestamp); }
function onRoad(actual, north) { assert.ok(Math.abs(actual.latitude - point(0, north).latitude) < 0.00000001); }
function parallelRoads() {
  return [{ points: [point(0, 0), point(400, 0), point(400, 20), point(0, 20)] }];
}

test('continuous progress stays on the established road despite jitter closer to a parallel return leg', () => {
  const matcher = createRouteMatcher(), roads = parallelRoads();
  onRoad(apply(matcher, fix(40, 0, 0), roads), 0);
  for (const [step, north] of [[1, 12], [2, 9], [3, 13], [4, 8]]) onRoad(apply(matcher, fix(40 + step * 4, north, step), roads), 0);
});

test('ambiguous acquisition falls back to the raw point until observations distinguish the roads', () => {
  const matcher = createRouteMatcher(), roads = parallelRoads(), ambiguous = fix(40, 10, 0);
  assert.deepEqual(apply(matcher, ambiguous, roads), ambiguous.gcj);
  onRoad(apply(matcher, fix(44, 0, 1), roads), 0);
});

test('a geometric crossing without a shared vertex cannot teleport to an unrelated line', () => {
  const matcher = createRouteMatcher();
  const roads = [{ points: [point(-100, 0), point(100, 0)] }, { points: [point(0, -100), point(0, 100)] }];
  onRoad(apply(matcher, fix(-40, 0, 0), roads), 0);
  onRoad(apply(matcher, fix(-12, 2, 1), roads), 0);
  onRoad(apply(matcher, fix(3, 8, 2), roads), 0);
});

test('shared endpoints allow turning between route parts and measured movement allows reversing', () => {
  const matcher = createRouteMatcher();
  const roads = [{ points: [point(0, 0), point(100, 0)] }, { points: [point(100, 100), point(100, 0)] }];
  onRoad(apply(matcher, fix(80, 0, 0), roads), 0);
  apply(matcher, fix(95, 2, 1), roads);
  const turned = apply(matcher, fix(101, 20, 2), roads);
  assert.equal(turned.longitude, point(100, 0).longitude);
  const reversed = apply(matcher, fix(99, 10, 3), roads);
  assert.equal(reversed.longitude, point(100, 0).longitude);
  assert.ok(reversed.latitude < turned.latitude);
});

test('a long gap, poor fix, route change or explicit reset reacquires rather than retaining old progress', () => {
  for (const reason of ['gap', 'weak', 'route', 'reset']) {
    const matcher = createRouteMatcher(); let roads = parallelRoads();
    onRoad(apply(matcher, fix(40, 0, 0), roads), 0);
    if (reason === 'weak') apply(matcher, fix(42, 10, 1, 100), roads);
    if (reason === 'route') roads = parallelRoads();
    if (reason === 'reset') matcher.reset();
    onRoad(apply(matcher, fix(48, 20, reason === 'gap' ? 6 : 2), roads), 20);
  }
});

test('an impossible jump or missing geometry returns the original point without changing its accuracy', () => {
  const matcher = createRouteMatcher(), roads = parallelRoads();
  apply(matcher, fix(40, 0, 0), roads);
  const jumped = fix(250, 0, 1), before = plain(jumped);
  assert.equal(apply(matcher, jumped, roads), jumped.gcj);
  assert.deepEqual(jumped, before);
  const next = fix(250, 10, 2);
  assert.equal(apply(matcher, next, []), next.gcj);
});

test('rendering and repeated camera updates consume each measurement only once', () => {
  const matcher = createRouteMatcher(), roads = parallelRoads(), measurement = fix(40, 0, 0);
  const first = apply(matcher, measurement, roads);
  for (let repeat = 0; repeat < 10; repeat++) assert.equal(apply(matcher, measurement, roads), first);
  onRoad(apply(matcher, fix(44, 12, 1), roads), 0);
});

test('older observations cannot replace established progress and stale fixes reset acquisition', () => {
  const matcher = createRouteMatcher(), roads = parallelRoads();
  apply(matcher, fix(40, 0, 1), roads);
  const older = fix(30, 20, 0);
  assert.equal(apply(matcher, older, roads), older.gcj);
  onRoad(apply(matcher, fix(44, 12, 2), roads), 0);
  const stale = fix(48, 20, 3);
  assert.equal(matcher.match(stale, roads, stale.timestamp + 16000), stale.gcj);
  onRoad(apply(matcher, fix(52, 20, 9), roads), 20);
});

test('an ambiguous shared crossing stays raw until further movement distinguishes the branch', () => {
  const matcher = createRouteMatcher();
  const roads = [{ points: [point(-100, 0), point(0, 0), point(100, 0)] }, { points: [point(0, -100), point(0, 0), point(0, 100)] }];
  apply(matcher, fix(-40, 0, 0), roads);
  apply(matcher, fix(-15, 0, 1), roads);
  const ambiguous = fix(5, 7, 2);
  assert.equal(apply(matcher, ambiguous, roads), ambiguous.gcj);
  onRoad(apply(matcher, fix(25, 1, 3), roads), 0);
});

function arrivalSetup(t, type = 'circle') {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: baseTime });
  const h = harness(), page = h.page('tour'), anchor = gcj02ToWgs84(point(40, 0));
  const stops = [{ id: 'current', placeId: 'current-place', name: 'current', ...gcj02ToWgs84(point(-200, 0)), images: [], guideNarrations: [] }, { id: 'nearby', placeId: 'nearby-place', name: 'nearby', ...anchor, images: [], guideNarrations: [] }];
  page._rev = 0; page._visible = true; page._user = userId; page._detail = { coordinateSystem: 1 };
  const ring = [[35, -3], [45, -3], [45, 3], [35, 3], [35, -3]].map(([east, north]) => { const coordinate = gcj02ToWgs84(point(east, north)); return [coordinate.longitude, coordinate.latitude]; });
  const range = { type, radiusMeters: 5, proximityDistanceMeters: 5, releaseDistanceMeters: 10, ...(type === 'polygon' ? { boundaryGeoJson: JSON.stringify({ type: 'Polygon', coordinates: [ring] }) } : {}) };
  page._places = [{ id: 'nearby-place', ...anchor, range }];
  page.setData({ route: { id: 'route' }, stops, tourStage: 'navigation', autoplay: false, 'map.routeLines': [{ points: [point(0, 0), point(100, 0)] }], visit: { visitId: 'visit', status: 1, currentStageId: 'current', completedStageIds: [] } });
  let deliver;
  h.load('services/location').watch = callback => { deliver = callback; return () => {}; };
  page.toggleLocation({ detail: { value: true } });
  return { h, page, deliver: measurement => deliver(measurement) };
}

for (const type of ['circle', 'polygon']) test('a corrected position inside a ' + type + ' triggers after stable dwell even if the raw position stays outside', t => {
  const { h, page, deliver } = arrivalSetup(t, type);
  const measurement = fix(40, 25, 0, 30);
  assert.equal(h.load('core/tour').candidates(page.data.stops, page._places, measurement, []).length, 0);
  deliver(measurement);
  assert.equal(page.data.arrivalCandidate, null);
  assert.equal(page.data.sequence.length, 0);
  t.mock.timers.tick(3000); deliver(fix(40, 25, 1, 30));
  onRoad(page.data.map.markers.find(marker => marker.id === 0), 0);
  assert.equal(page._fix.gcj.latitude, measurement.gcj.latitude);
  assert.equal(page.nearbyCandidates()[0].withinRange, true);
  assert.equal(page.data.arrivalCandidate.id, 'nearby');
  assert.equal(page.data.sequence.length, 0);
  t.mock.timers.tick(3000);
  assert.equal(page.data.sequence[0].id, 'nearby');
  page.onUnload();
});

test('ambiguous matching falls back to the raw outside position without triggering', t => {
  const { page, deliver } = arrivalSetup(t);
  page.setData({ 'map.routeLines': [{ points: [point(0, 0), point(100, 0)] }, { points: [point(0, 50), point(100, 50)] }] });
  const measurement = fix(40, 25, 0, 30);
  deliver(measurement); t.mock.timers.tick(3000); deliver(fix(40, 25, 1, 30));
  onRoad(page.data.map.markers.find(marker => marker.id === 0), 25);
  assert.equal(page._fix.gcj.latitude, measurement.gcj.latitude);
  assert.equal(page.nearbyCandidates().length, 0);
  assert.equal(page.data.arrivalCandidate, null);
  assert.equal(page.data.sequence.length, 0);
  page.onUnload();
});

test('a successful correction outside the range takes precedence over a raw point inside it', t => {
  const { page, deliver } = arrivalSetup(t);
  page.setData({ 'map.routeLines': [{ points: [point(0, 25), point(100, 25)] }] });
  deliver(fix(40, 0, 0, 30));
  t.mock.timers.tick(3000); deliver(fix(40, 0, 1, 30));
  onRoad(page.data.map.markers.find(marker => marker.id === 0), 25);
  assert.equal(page.nearbyCandidates().length, 0);
  assert.equal(page.data.arrivalCandidate, null);
  assert.equal(page.data.sequence.length, 0);
  page.onUnload();
});

test('missing route geometry falls back to an original inside position and still permits arrival', t => {
  const { page, deliver } = arrivalSetup(t);
  page.setData({ 'map.routeLines': [] });
  deliver(fix(40, 0, 0, 30));
  t.mock.timers.tick(3000); deliver(fix(40, 0, 1, 30));
  assert.equal(page.data.arrivalCandidate.id, 'nearby');
  t.mock.timers.tick(3000);
  assert.equal(page.data.sequence[0].id, 'nearby');
  page.onUnload();
});

test('a stale corrected fix cancels the arrival countdown instead of renewing its timestamp', t => {
  const { page, deliver } = arrivalSetup(t);
  deliver(fix(40, 25, 0, 30));
  t.mock.timers.tick(3000); deliver(fix(40, 25, 1, 30));
  assert.equal(page.data.arrivalCandidate.id, 'nearby');
  t.mock.timers.tick(16000);
  assert.equal(page.data.sequence.length, 0);
  assert.equal(page.data.arrivalCandidate, null);
  assert.equal(page._dwell, null);
  page.onUnload();
});

test('weak original quality cancels a corrected arrival even when its coordinates remain near the route', t => {
  const { page, deliver } = arrivalSetup(t);
  deliver(fix(40, 25, 0, 30));
  t.mock.timers.tick(3000); deliver(fix(40, 25, 1, 30));
  assert.ok(page.data.arrivalCandidate);
  t.mock.timers.tick(1000); deliver(fix(40, 0, 1, 100));
  assert.equal(page.data.arrivalCandidate, null);
  assert.equal(page.data.sequence.length, 0);
  assert.equal(page._dwell, null);
  page.onUnload();
});

test('background arrival uses the corrected position with the same raw quality and dwell requirements', t => {
  const { page, deliver } = arrivalSetup(t);
  page.onHide(); deliver(fix(40, 25, 0, 30));
  assert.equal(page.data.sequence.length, 0);
  t.mock.timers.tick(3000); deliver(fix(40, 25, 1, 30));
  assert.equal(page.data.sequence[0].id, 'nearby');
  assert.equal(page.data.arrivalCandidate, null);
  page.onUnload();
});
