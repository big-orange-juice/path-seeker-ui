const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick } = require('./harness.cjs');
const roomId = '9223372036854775805';
function setup(t, room = { roomId, isHost: false, status: 'live' }) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  const h = harness(), listeners = new Set(), fixes = [], errors = [];
  let state = { room, disconnected: false }, nativeCalls = 0;
  h.my.getLocation = () => nativeCalls++;
  const translation = h.load('services/translation-session');
  translation.subscribe = callback => { listeners.add(callback); callback(state); return () => listeners.delete(callback); };
  const stop = h.load('services/location').watch(fix => fixes.push(fix), error => errors.push(error));
  return { h, fixes, errors, stop, nativeCalls: () => nativeCalls, update(value) { state = value; listeners.forEach(callback => callback(state)); } };
}
function result(values = {}) { return { roomId, status: 'online', coordinateSystem: 'GCJ-02', longitude: 116.4, latitude: 39.9, accuracy: 8, sampledAt: new Date(Date.now()).toISOString(), serverTime: new Date(Date.now()).toISOString(), ...values }; }

test('only a connected guest room starts driver polling and never calls native location', t => {
  const fixture = setup(t, null);
  assert.equal(fixture.h.requests.length, 0);
  assert.equal(fixture.errors[0].reason, 'driverRoomRequired');
  fixture.update({ room: { roomId, isHost: false, status: 'live' }, disconnected: false });
  assert.match(fixture.h.requests[0].options.url, new RegExp('/TranslationRooms/' + roomId + '/location$'));
  assert.equal(fixture.nativeCalls(), 0); fixture.stop();
});

test('fresh GCJ driver fixes preserve server sample time, convert for arrival and deduplicate polling', async t => {
  const fixture = setup(t), first = result();
  fixture.h.requests[0].ok(first); await tick();
  assert.equal(fixture.fixes.length, 1);
  assert.equal(fixture.fixes[0].source, 'driver'); assert.equal(fixture.fixes[0].roomId, roomId);
  assert.equal(fixture.fixes[0].gcj.longitude, 116.4); assert.notEqual(fixture.fixes[0].longitude, 116.4);
  const timestamp = fixture.fixes[0].timestamp;
  t.mock.timers.tick(1000); fixture.h.requests[1].ok({ ...first, serverTime: new Date(Date.now()).toISOString() }); await tick();
  assert.equal(fixture.fixes.length, 1); assert.equal(fixture.fixes[0].timestamp, timestamp);
  t.mock.timers.tick(14000); assert.equal(fixture.errors.at(-1).reason, 'driverWaiting');
  fixture.stop(); assert.equal(fixture.nativeCalls(), 0);
});

test('old, malformed and stopped coordinates cannot become arrival fixes', async t => {
  const fixture = setup(t);
  for (const change of [{ sampledAt: new Date(Date.now() - 16000).toISOString() }, { longitude: null }, { roomId: 'another' }, { accuracy: null }, { status: 'stopped' }]) {
    fixture.h.requests.at(-1).ok(result(change)); await tick();
    assert.equal(fixture.fixes.length, 0); t.mock.timers.tick(1000);
  }
  fixture.stop(); assert.equal(fixture.nativeCalls(), 0);
});

test('leaving or changing rooms aborts requests and discards late responses', async t => {
  const fixture = setup(t), old = fixture.h.requests[0];
  fixture.update({ room: { roomId: '9223372036854775804', isHost: false, status: 'live' }, disconnected: false });
  assert.equal(old.aborted, true); old.ok(result()); await tick(); assert.equal(fixture.fixes.length, 0);
  fixture.update({ room: null }); assert.equal(fixture.h.requests[1].aborted, true);
  t.mock.timers.tick(30000); assert.equal(fixture.h.requests.length, 2); fixture.stop();
});

test('foreground refresh discards an in-flight response and fetches a fresh room fix', async t => {
  const fixture = setup(t), old = fixture.h.requests[0];
  fixture.stop.refresh(); assert.equal(old.aborted, true); assert.equal(fixture.h.requests.length, 2);
  old.ok(result()); fixture.h.requests[1].ok(result()); await tick();
  assert.equal(fixture.fixes.length, 1); fixture.stop();
});
