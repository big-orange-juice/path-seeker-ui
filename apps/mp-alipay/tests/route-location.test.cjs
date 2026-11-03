const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness.cjs');
const { mapLocation, arrivalLocation } = require('../dist/core/route-location');
const { gcj02ToWgs84 } = require('../dist/shared/map-coordinates');

const road = [{ points: [{ longitude: 116.38, latitude: 39.94 }, { longitude: 116.39, latitude: 39.94 }] }];
function fixAt(longitude = 116.385, latitude = 39.94012, accuracy = 20) {
  const gcj = { longitude, latitude };
  return { ...gcj02ToWgs84(gcj), gcj, accuracy, heading: 90, timestamp: Date.now() };
}

test('nearby fixes project onto a route segment without changing the original measurement', () => {
  const fix = fixAt(), before = plain(fix);
  const point = mapLocation(fix, road);
  assert.equal(point.longitude, fix.gcj.longitude);
  assert.equal(point.latitude, 39.94);
  assert.deepEqual(fix, before);
  assert.deepEqual(mapLocation({ ...fix, gcj: undefined }, road), point);
  assert.deepEqual(mapLocation(fixAt(116.37995, 39.94002), road), road[0].points[0]);
});

test('distant, weak, stale and invalid geometry inputs never force a fix onto a route', () => {
  for (const fix of [fixAt(116.385, 39.941), fixAt(116.385, 39.9407, 65), fixAt(116.385, 39.94012, 66), { ...fixAt(), timestamp: Date.now() - 16000 }]) {
    assert.deepEqual(mapLocation(fix, road), fix.gcj);
  }
  const fix = fixAt();
  for (const lines of [null, [], [null], [{ points: [null, road[0].points[0]] }], [{ points: [road[0].points[0], road[0].points[0]] }]]) assert.deepEqual(mapLocation(fix, lines), fix.gcj);
  assert.equal(mapLocation(null, road), null);
  assert.equal(mapLocation({ ...fix, gcj: { longitude: NaN, latitude: 40 } }, road), null);
});

test('disconnected route parts do not create a synthetic connecting road', () => {
  const fix = fixAt(116.385, 39.94);
  const parts = [{ points: [{ longitude: 116.38, latitude: 39.94 }, { longitude: 116.381, latitude: 39.94 }] }, { points: [{ longitude: 116.389, latitude: 39.94 }, { longitude: 116.39, latitude: 39.94 }] }];
  assert.deepEqual(mapLocation(fix, parts), fix.gcj);
});

test('arrival coordinates convert the matched GCJ point to WGS84 while retaining raw quality and data', () => {
  const fix = fixAt(), before = plain(fix), point = mapLocation(fix, road);
  const evaluated = arrivalLocation(fix, point);
  assert.deepEqual({ longitude: evaluated.longitude, latitude: evaluated.latitude }, gcj02ToWgs84(point));
  assert.equal(evaluated.gcj, point);
  assert.equal(evaluated.accuracy, fix.accuracy);
  assert.equal(evaluated.timestamp, fix.timestamp);
  assert.equal(evaluated.heading, fix.heading);
  assert.deepEqual(fix, before);
  assert.notEqual(evaluated.latitude, fix.latitude);
});

test('a matched coordinate never upgrades weak, unknown or expired original measurements', () => {
  const fix = fixAt(), point = mapLocation(fix, road), now = Date.now();
  for (const invalid of [null, { ...fix, accuracy: 66 }, { ...fix, accuracy: NaN }, { ...fix, accuracy: undefined }, { ...fix, accuracy: -1 }, { ...fix, timestamp: undefined }, { ...fix, timestamp: now - 16000 }, { ...fix, timestamp: now + 2000 }]) {
    assert.equal(arrivalLocation(invalid, point, now), null);
  }
});

test('unmatched and excessive corrections retain the original arrival position', () => {
  const fix = fixAt();
  for (const point of [fix.gcj, null, { longitude: NaN, latitude: 40 }, { longitude: 116.385, latitude: 39.95 }]) assert.equal(arrivalLocation(fix, point), fix);
});

test('marker and camera use the same corrected point while retaining the original measurement', () => {
  const h = harness(), page = h.page('tour'), fix = fixAt();
  h.load('config').routeCorrection = true;
  let deliver;
  h.load('services/location').watch = callback => { deliver = callback; return () => {}; };
  page._visible = true;
  page.setData({ locationEnabled: true, following: true, 'map.routeLines': road, showRoute: false });
  page.watchLocation(); deliver(fix);
  const marker = page.data.map.markers.find(item => item.id === 0);
  assert.equal(marker.latitude, 39.94);
  assert.equal(page.data.map.latitude, marker.latitude);
  assert.equal(page._fix, fix);
  assert.equal(page._fix.gcj.latitude, 39.94012);
  page.recenter(); assert.equal(page.data.map.latitude, marker.latitude);
  page.onUnload();
});

test('returning to the foreground refreshes the driver watch and clears old arrival state', t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  const h = harness(), page = h.page('tour'); let refreshes = 0, watches = 0;
  h.load('services/location').watch = () => { watches++; const stop = () => {}; stop.refresh = () => refreshes++; return stop; };
  page._visible = true;
  page.setData({ locationEnabled: true });
  page.watchLocation();
  page._fix = fixAt(); page._dwell = { updatedAt: Date.now() };
  page.onHide(); assert.equal(watches, 1);
  t.mock.timers.tick(3000);
  page.onShow(); assert.equal(watches, 1); assert.equal(refreshes, 1);
  assert.equal(page._fix, null); assert.equal(page._dwell, null);
  page.onUnload();
});
