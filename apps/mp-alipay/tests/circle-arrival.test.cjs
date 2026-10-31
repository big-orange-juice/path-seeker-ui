const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId, plain } = require('./harness.cjs');
const { wgs84ToGcj02 } = require('../dist/shared/map-coordinates');
const { evaluateApproach } = require('../dist/shared/geo-range');

const center = { longitude: 116.3856068, latitude: 39.9377928 };
const stageId = '9223372036854775804', placeId = '9223372036854775803';
const range = { type: 'circle', radiusMeters: 12.5, proximityDistanceMeters: 5, releaseDistanceMeters: 15, rangeVersion: 2 };
const place = { id: placeId, name: '后海酒吧街', coordinateSystem: 1, ...center, range };
const stop = { id: stageId, placeId, name: place.name, order: 5, ...center, images: [], guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'chapter', audioUrl: '/bar.mp3' }] }] };

function destination(meters, bearing = 0) {
  const distance = meters / 6371008.8, angle = bearing * Math.PI / 180;
  const latitude = center.latitude * Math.PI / 180, longitude = center.longitude * Math.PI / 180;
  const targetLatitude = Math.asin(Math.sin(latitude) * Math.cos(distance) + Math.cos(latitude) * Math.sin(distance) * Math.cos(angle));
  const targetLongitude = longitude + Math.atan2(Math.sin(angle) * Math.sin(distance) * Math.cos(latitude), Math.cos(distance) - Math.sin(latitude) * Math.sin(targetLatitude));
  return { longitude: targetLongitude * 180 / Math.PI, latitude: targetLatitude * 180 / Math.PI };
}

test('Houhai circle uses distance to the circumference in every direction, including both sides of the 17.5m trigger', () => {
  const tour = harness().load('core/tour');
  for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
    for (const meters of [0, 5, 12.49, 12.51, 16, 17.49, 17.51, 18, 35, 100]) {
      const point = destination(meters, bearing), result = evaluateApproach(point, range, center);
      assert.ok(Math.abs(result.distanceMeters - Math.max(0, meters - 12.5)) < 0.00001, `${bearing}° ${meters}m: ${result.distanceMeters}`);
      assert.equal(result.withinRange, meters < 12.5);
      assert.equal(result.approaching, meters < 17.5);
      const fix = { ...point, accuracy: 35, timestamp: Date.now() };
      assert.equal(tour.candidates([stop], [place], fix, [], 1).length, meters < 17.5 ? 1 : 0);
      const gcjStop = { ...stop, ...wgs84ToGcj02(center) };
      assert.equal(tour.candidates([gcjStop], [place], fix, [], 2).length, meters < 17.5 ? 1 : 0);
    }
  }
});

test('native GCJ fixes reach a circular place, show the countdown and start narration after stable arrival', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  const h = harness(), page = h.page('tour'), nativeRequests = [];
  h.my.getLocation = options => nativeRequests.push(options);
  page._rev = 0; page._visible = true; page._user = userId;
  page._places = [place]; page._detail = { coordinateSystem: 1 };
  page.setData({
    tourStage: 'navigation', route: { id: 'route', title: '导游路线-A线' }, stops: [stop],
    visit: { visitId: 'visit', routeId: 'route', status: 1, currentStageId: null, completedStageIds: [] },
  });
  page.showStop(0, true); page.toggleTracking();
  const gcj = wgs84ToGcj02(destination(16));
  const deliver = request => {
    request.success({ longitude: String(gcj.longitude), latitude: String(gcj.latitude), horizontalAccuracy: '35' });
    request.complete();
  };
  deliver(nativeRequests[0]);
  assert.equal(page.data.arrivalCandidate, null); assert.equal(h.requests.length, 0);
  t.mock.timers.tick(3000); deliver(nativeRequests[1]);
  assert.equal(page.data.arrivalCandidate.id, stageId);
  assert.ok(Math.abs(page.data.arrivalCandidate.distance - 3.5) < 0.01);
  assert.match(page.data.arrivalCountdown, /3/);
  t.mock.timers.tick(3000);
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].options.data.stageId, stageId);
  assert.equal(h.requests[0].options.data.action, 'start');
  h.requests[0].ok({ ...page.data.visit, currentStageId: stageId }); await tick();
  assert.equal(h.load('services/audio').snapshot().playing, true);
  assert.deepEqual(plain(page.data.sequence.map(item => ({ id: item.id, status: item.status }))), [{ id: stageId, status: 'playing' }]);
  page.onUnload();
});

test('reported 35m precision does not cause a point 35m from the center to match a 12.5m circle plus 5m approach', t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  const h = harness(), page = h.page('tour'); let fix;
  h.load('services/location').watch = callback => { fix = callback; return () => {}; };
  page._rev = 0; page._visible = true; page._user = userId; page._places = [place]; page._detail = { coordinateSystem: 1 };
  page.setData({ tourStage: 'navigation', route: { id: 'route' }, stops: [stop], visit: { visitId: 'visit', status: 1, currentStageId: null, completedStageIds: [] } });
  page.showStop(0, true); page.toggleTracking();
  for (let index = 0; index < 4; index++) {
    fix({ ...destination(35), accuracy: 35, timestamp: Date.now() }); t.mock.timers.tick(3000);
  }
  assert.equal(page.data.arrivalCandidate, null); assert.equal(h.requests.length, 0);
  assert.deepEqual(plain(page.data.sequence), []); page.onUnload();
});
