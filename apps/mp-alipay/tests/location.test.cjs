const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { harness, plain } = require('./harness.cjs');

function locationHarness() {
  const calls = [], timers = new Map(), fixes = [], errors = [];
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../dist/services/location.js'), 'utf8'), {
    module, require: () => require('../dist/shared/map-coordinates.js'),
    my: { getLocation: options => calls.push(options) },
    setTimeout(fn, delay) { const id = {}; timers.set(id, { fn, delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const stop = module.exports.watch(fix => fixes.push(fix), error => errors.push(error));
  return { calls, timers, fixes, errors, stop };
}

test('native GCJ-02 fixes convert to WGS84 and retain map coordinates, accuracy and heading', () => {
  const h = locationHarness(), request = h.calls[0];
  assert.equal(request.type, 0); assert.equal(request.cacheTimeout, 0);
  request.success({ longitude: '116.389', latitude: '39.938', accuracy: '12', direction: 90 });
  const fix = h.fixes[0];
  assert.deepEqual(plain(fix.gcj), { longitude: 116.389, latitude: 39.938 });
  assert.ok(Math.abs(fix.longitude - 116.389) > 0.001);
  assert.equal(fix.accuracy, 12); assert.equal(fix.heading, 90);
  assert.ok(Math.abs(Date.now() - fix.timestamp) < 1000);
  assert.equal(h.timers.size, 0);
  request.complete();
  const [id, timer] = [...h.timers][0]; assert.equal(timer.delay, 3000);
  h.timers.delete(id); timer.fn(); assert.equal(h.calls.length, 2);
  h.stop(); h.calls[1].success({ longitude: 116, latitude: 40, accuracy: 1 }); h.calls[1].complete();
  assert.equal(h.fixes.length, 1); assert.equal(h.timers.size, 0);
});

test('invalid coordinates never become a fix and absent or invalid accuracy stays unknown', () => {
  const h = locationHarness(), request = h.calls[0];
  for (const value of [null, undefined, '', ' ', true, 'NaN', 181, -181]) {
    request.success({ longitude: value, latitude: 39.938, accuracy: 1 });
  }
  request.success({ longitude: 116, latitude: 91, accuracy: 1 });
  assert.equal(h.errors.length, 9); assert.equal(h.fixes.length, 0);
  for (const value of [null, undefined, '', ' ', true, -1, 'bad']) {
    request.success({ longitude: 116, latitude: 40, accuracy: value });
    assert.equal(h.fixes.at(-1).accuracy, 999);
  }
  request.success({ longitude: 116, latitude: 40, horizontalAccuracy: 0, accuracy: 90 });
  assert.equal(h.fixes.at(-1).accuracy, 0);
  request.success({ longitude: 116, latitude: 40, horizontalAccuracy: -1, accuracy: 8 });
  assert.equal(h.fixes.at(-1).accuracy, 8);
  h.stop();
});

test('permission denial stops polling while transient failures retry and cancellation clears timers', () => {
  const denied = locationHarness(); denied.calls[0].fail({ error: 11 }); denied.calls[0].complete();
  assert.equal(denied.errors[0].denied, true); assert.equal(denied.timers.size, 0);
  denied.calls[0].success({ longitude: 116, latitude: 40, accuracy: 1 });
  assert.equal(denied.fixes.length, 0);
  const temporary = locationHarness(); temporary.calls[0].fail({ error: 13 }); temporary.calls[0].complete();
  assert.equal(temporary.errors[0].denied, false); assert.equal(temporary.timers.size, 1);
  temporary.stop(); assert.equal(temporary.timers.size, 0);
});

test('nearby geometry rejects weak and stale fixes and matches native coordinates to either route system', () => {
  const h = locationHarness(), tour = harness().load('core/tour');
  h.calls[0].success({ longitude: 116.389, latitude: 39.938, accuracy: 10 });
  const fix = h.fixes[0], id = '9223372036854775806';
  const stop = { id, name: '附近站点', ...fix.gcj };
  assert.equal(tour.candidates([stop], [], fix, [], 2)[0].id, id);
  assert.equal(tour.candidates([{ ...stop, longitude: fix.longitude, latitude: fix.latitude }], [], fix, [], 1)[0].id, id);
  assert.equal(tour.candidates([stop], [], { ...fix, accuracy: 66 }, [], 2).length, 0);
  assert.equal(tour.candidates([stop], [], { ...fix, accuracy: 999 }, [], 2).length, 0);
  assert.equal(tour.candidates([stop], [], { ...fix, timestamp: Date.now() - 16000 }, [], 2).length, 0);
  assert.equal(tour.candidates([stop], [], fix, [id], 2).length, 0);
  assert.equal(tour.candidates([{ ...stop, longitude: 117 }], [], fix, [], 2).length, 0);
  h.stop();
});
