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

test('disabled correction follows native coordinates through offsets and jumps and keeps arrival quality checks', () => {
  const matcher = createRouteMatcher({ enabled: false }), roads = parallelRoads();
  for (const measurement of [fix(40, 10, 0), fix(80, 100, 1), fix(250, 0, 2)]) {
    assert.equal(matcher.resolve(measurement, roads, measurement.timestamp).status, 'disabled');
    assert.equal(matcher.display(measurement, roads, measurement.timestamp), measurement.gcj);
    assert.equal(matcher.arrival(measurement, roads, measurement.timestamp), measurement);
  }
  const weak = fix(260, 10, 3, 100), stale = fix(270, 10, 4);
  assert.equal(matcher.arrival(weak, roads, weak.timestamp), null);
  assert.equal(matcher.arrival(stale, roads, stale.timestamp + 16000), null);
});

test('default page configuration bypasses correction for marker, camera and nearby arrival', t => {
  const { h, page, deliver } = arrivalSetup(t);
  h.load('config').routeCorrection = false;
  page._routeMatcher = null;
  page.setData({ following: true });
  for (const measurement of [fix(40, 25, 0, 30), fix(80, 100, 1, 30)]) {
    t.mock.timers.tick(measurement.timestamp - Date.now());
    deliver(measurement);
    const marker = page.data.map.markers.find(item => item.id === 0);
    assert.equal(marker.longitude, measurement.gcj.longitude);
    assert.equal(marker.latitude, measurement.gcj.latitude);
    assert.equal(page.data.map.longitude, measurement.gcj.longitude);
    assert.equal(page.data.map.latitude, measurement.gcj.latitude);
    assert.equal(page.nearbyCandidates().length, 0);
    assert.equal(page.data.sequence.length, 0);
  }
  page.onUnload();
});

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
  page.driverRoomAvailable = () => true;
  h.load('config').routeCorrection = true;
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

test('ambiguous matching keeps the display on the route while arrival uses the raw outside position', t => {
  const { page, deliver } = arrivalSetup(t);
  page.setData({ 'map.routeLines': [{ points: [point(0, 0), point(100, 0)] }, { points: [point(0, 50), point(100, 50)] }] });
  const measurement = fix(40, 25, 0, 30);
  deliver(measurement); t.mock.timers.tick(3000); deliver(fix(40, 25, 1, 30));
  const marker = page.data.map.markers.find(marker => marker.id === 0);
  assert.ok(Math.min(Math.abs(marker.latitude - point(0, 0).latitude), Math.abs(marker.latitude - point(0, 50).latitude)) < 0.00000001);
  assert.equal(page._fix.gcj.latitude, measurement.gcj.latitude);
  assert.equal(page.nearbyCandidates().length, 0);
  assert.equal(page.data.arrivalCandidate, null);
  assert.equal(page.data.sequence.length, 0);
  page.onUnload();
});

test('a 38-metre fix beyond the old 30-metre limit remains on the route and can be matched', () => {
  const matcher = createRouteMatcher(), roads = [{ points: [point(0, 0), point(100, 0)] }];
  const measurement = fix(40, 38, 0, 38);
  const result = matcher.resolve(measurement, roads, measurement.timestamp);
  onRoad(result.point, 0); assert.equal(result.status, 'matched');
  onRoad(matcher.arrival(measurement, roads, measurement.timestamp).gcj, 0);
  assert.equal(measurement.gcj.latitude, point(40, 38).latitude);
});

test('large offsets and impossible jumps stay on the displayed route without repeatedly promoting the same sample to a trusted fix', () => {
  const matcher = createRouteMatcher(), roads = parallelRoads();
  apply(matcher, fix(40, 0, 0), roads);
  const jumped = fix(250, 0, 1);
  for (let repeat = 0; repeat < 5; repeat++) {
    onRoad(matcher.display(jumped, roads, jumped.timestamp), 0);
    assert.equal(matcher.resolve(jumped, roads, jumped.timestamp).status, 'jump');
    assert.equal(matcher.arrival(jumped, roads, jumped.timestamp), null);
  }
  const distant = fix(260, -180, 2);
  onRoad(matcher.display(distant, roads, distant.timestamp), 0);
  assert.equal(matcher.resolve(distant, roads, distant.timestamp).status, 'off-route');
  assert.equal(matcher.arrival(distant, roads, distant.timestamp), distant);
});

test('weak and stale measurements retain an on-route display but never become usable arrival coordinates', () => {
  const matcher = createRouteMatcher(), roads = [{ points: [point(0, 0), point(100, 0)] }];
  const first = fix(40, 10, 0);
  const display = matcher.display(first, roads, first.timestamp);
  const weak = fix(70, 100, 1, 100);
  assert.equal(matcher.display(weak, roads, weak.timestamp), display);
  assert.equal(matcher.arrival(weak, roads, weak.timestamp), null);
  assert.equal(matcher.display(first, roads, first.timestamp + 16000), display);
  assert.equal(matcher.arrival(first, roads, first.timestamp + 16000), null);
});

test('native GCJ fixes and WGS84 or GCJ route geometry resolve to the same route location', () => {
  const h = harness(), tour = h.load('core/tour');
  const gcjPoints = [point(0, 0), point(100, 0)], measurement = fix(40, 10, 0);
  for (const system of [1, 2]) {
    const coordinates = gcjPoints.map(gcj => { const coordinate = system === 1 ? gcj02ToWgs84(gcj) : gcj; return [coordinate.longitude, coordinate.latitude]; });
    const map = tour.mapData({ coordinateSystem: system, geometry: JSON.stringify({ type: 'LineString', coordinates }), stops: [] }, null, []);
    const result = createRouteMatcher().resolve(measurement, map.routeLines, measurement.timestamp);
    assert.equal(result.status, 'matched');
    onRoad(result.point, 0);
    assert.ok(Math.abs(result.point.longitude - point(40, 0).longitude) < 0.00000001);
  }
});

test('driver location failures clear the route marker and recover on the next fresh fix', t => {
  const { h, page, deliver } = arrivalSetup(t);
  let failed, recovered;
  h.load('services/location').watch = (onFix, onError) => { recovered = onFix; failed = onError; return () => {}; };
  page._watch = null; page.watchLocation();
  deliver(fix(40, 38, 0, 38));
  for (const reason of ['driverNetwork', 'driverWaiting', 'driverStopped', 'driverUnavailable']) {
    failed({ driver: true, reason });
    assert.equal(page.data.locationNote, page.data.messages[reason]);
    assert.equal(page.data.locationEnabled, true);
    assert.equal(page.data.map.markers.some(item => item.id === 0), false);
    assert.equal(page._fix, null);
    assert.equal(page.nearbyCandidates().length, 0);
  }
  t.mock.timers.tick(3000); recovered(fix(45, 38, 1, 38));
  onRoad(page.data.map.markers.find(item => item.id === 0), 0);
  assert.match(page.data.locationNote, /38/);
  page.onUnload();
});

test('route following updates after two metres instead of waiting for five metres of travel', t => {
  const { page, deliver } = arrivalSetup(t);
  page.setData({ following: true });
  deliver(fix(40, 38, 0, 38));
  const first = page.data.map.longitude;
  t.mock.timers.tick(3000); deliver(fix(42, 38, 1, 38));
  assert.ok(page.data.map.longitude > first);
  assert.ok(Math.abs(page.data.map.longitude - point(42, 0).longitude) < 0.00000001);
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

test('a weak original sample is tolerated briefly while its corrected arrival remains near the route', t => {
  const { page, deliver } = arrivalSetup(t);
  deliver(fix(40, 25, 0, 30));
  t.mock.timers.tick(3000); deliver(fix(40, 25, 1, 30));
  assert.ok(page.data.arrivalCandidate);
  t.mock.timers.tick(1000); deliver(fix(40, 0, 1, 100));
  assert.ok(page.data.arrivalCandidate);
  assert.equal(page.data.sequence.length, 0);
  assert.ok(page._dwell);
  t.mock.timers.tick(7000);
  assert.equal(page.data.arrivalCandidate, null);
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

test('a single forward spike holds the route display and the next real sample continues from the established section', () => {
  const matcher = createRouteMatcher(), roads = parallelRoads();
  const established = matcher.display(fix(40, 0, 0), roads, baseTime);
  const spike = fix(250, 0, 1);
  const result = matcher.resolve(spike, roads, spike.timestamp);
  assert.equal(result.status, 'jump'); assert.equal(result.point, established);
  assert.equal(matcher.arrival(spike, roads, spike.timestamp), null);
  const returned = fix(48, 12, 2);
  assert.equal(matcher.resolve(returned, roads, returned.timestamp).status, 'matched');
  onRoad(matcher.display(returned, roads, returned.timestamp), 0);
  assert.ok(Math.abs(matcher.display(returned, roads, returned.timestamp).longitude - point(48, 0).longitude) < 0.00000001);
});

test('reacquisition after a jump requires distinct consistent samples spanning stable dwell time', () => {
  const matcher = createRouteMatcher(), roads = [{ points: [point(0, 0), point(500, 0)] }];
  const established = matcher.display(fix(40, 0, 0), roads, baseTime);
  const jumped = fix(250, 0, 1);
  for (const measurement of [jumped, { ...jumped }, { ...fix(252, 0, 1), timestamp: jumped.timestamp + 1000 }]) {
    assert.equal(matcher.resolve(measurement, roads, measurement.timestamp).status, 'jump');
    assert.equal(matcher.display(measurement, roads, measurement.timestamp), established);
    assert.equal(matcher.arrival(measurement, roads, measurement.timestamp), null);
  }
  const confirmed = { ...fix(254, 0, 2), timestamp: jumped.timestamp + 2000 };
  const result = matcher.resolve(confirmed, roads, confirmed.timestamp);
  assert.equal(result.status, 'matched'); onRoad(result.point, 0);
  assert.ok(Math.abs(result.point.longitude - confirmed.gcj.longitude) < 0.00000001);
  assert.ok(matcher.arrival(confirmed, roads, confirmed.timestamp));
});

test('inconsistent consecutive jumps restart acquisition instead of confirming each other', () => {
  const matcher = createRouteMatcher(), roads = [{ points: [point(0, 0), point(1000, 0)] }];
  const established = matcher.display(fix(40, 0, 0), roads, baseTime);
  for (const measurement of [fix(250, 0, 1), fix(800, 0, 2), fix(250, 0, 3)]) {
    assert.equal(matcher.resolve(measurement, roads, measurement.timestamp).status, 'jump');
    assert.equal(matcher.display(measurement, roads, measurement.timestamp), established);
  }
});

test('an off-route outlier holds the display and preserves the established branch on recovery', () => {
  const matcher = createRouteMatcher(), roads = parallelRoads();
  const established = matcher.display(fix(40, 0, 0), roads, baseTime);
  const outlier = fix(200, 200, 1);
  assert.equal(matcher.resolve(outlier, roads, outlier.timestamp).status, 'off-route');
  assert.equal(matcher.display(outlier, roads, outlier.timestamp), established);
  const recovered = fix(48, 12, 2);
  onRoad(matcher.display(recovered, roads, recovered.timestamp), 0);
});

test('a reordered sample inside a stop cannot trigger arrival or replace the displayed route progress', t => {
  const { page, deliver } = arrivalSetup(t);
  deliver(fix(80, 0, 0));
  const marker = page.data.map.markers.find(item => item.id === 0);
  const reordered = { ...fix(40, 0, 0), timestamp: baseTime - 1000 };
  t.mock.timers.tick(3000); deliver(reordered);
  assert.equal(page.nearbyCandidates().length, 0);
  assert.equal(page.data.arrivalCandidate, null);
  assert.equal(page.data.map.markers.find(item => item.id === 0).longitude, marker.longitude);
  assert.equal(page.data.sequence.length, 0);
  page.onUnload();
});

test('one-second walking observations update immediately without drifting onto a parallel leg after a spike', () => {
  const matcher = createRouteMatcher(), roads = parallelRoads();
  let previous;
  for (let sample = 0; sample < 80; sample++) {
    const east = 40 + sample * 1.4, north = sample === 0 ? 0 : [8, 12, 9, 13][sample % 4];
    const measurement = { ...fix(sample === 40 ? 350 : east, north, 0), timestamp: baseTime + sample * 1000 };
    const result = matcher.resolve(measurement, roads, measurement.timestamp);
    onRoad(result.point, 0);
    if (sample === 40) { assert.equal(result.status, 'jump'); assert.equal(result.point, previous); }
    else {
      assert.equal(result.status, 'matched');
      assert.ok(Math.abs(result.point.longitude - point(east, 0).longitude) < 0.00000001);
    }
    previous = result.point;
  }
});
