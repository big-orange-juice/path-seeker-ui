const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { harness, tick, userId, session: account } = require('./harness.cjs');
const room = { roomId: '9223372036854775805', code: '12345678', isHost: false, status: 'live',
  sourceLanguage: 'zh-CN', expiresAt: '2099-01-01T00:00:00Z' };
const cacheKey = 'path-seeker:alipay:v1:user:' + userId + ':commentary-room';

function setup(context, initial = account()) {
  context.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: Date.now() });
  const fixture = harness(initial), handlers = {}, sockets = [];
  for (const name of ['Open', 'Message', 'Close', 'Error']) {
    fixture.my['onSocket' + name] = callback => { handlers[name] = callback; };
    fixture.my['offSocket' + name] = callback => { if (handlers[name] === callback) delete handlers[name]; };
  }
  fixture.my.connectSocket = options => sockets.push(options);
  fixture.my.closeSocket = () => {};
  fixture.my.sendSocketMessage = options => options.success({});
  const session = fixture.load('services/translation-session');
  const emit = value => handlers.Message({ data: JSON.stringify(value) });
  const ready = (value = room) => {
    handlers.Open();
    emit({ type: 'subscription.ready', targetLanguage: 'en', subscriptionVersion: 1, payload: { room: value, startSequence: 1 } });
  };
  const join = () => { session.attach(room, 'en'); ready(); };
  context.after(() => session.disconnect());
  return { fixture, session, handlers, sockets, emit, ready, join };
}

test('background and foreground rejoin the cached room once and wait for subscription acknowledgement', async context => {
  const { fixture, session, sockets, join, ready } = setup(context);
  join(); session.setFollowing(false); session.togglePause();
  session.suspend();
  assert.equal(fixture.storage.get(cacheKey).roomId, room.roomId);
  assert.equal(fixture.storage.get(cacheKey).language, 'en');
  assert.equal(fixture.storage.get(cacheKey).paused, true);
  assert.equal(fixture.storage.get(cacheKey).following, false);
  context.mock.timers.tick(60000);
  assert.equal(fixture.requests.length, 0);
  const recovering = session.resume();
  session.resume();
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0].options.data.code, room.code);
  fixture.requests[0].ok(room); await recovering;
  assert.equal(sockets.length, 2);
  assert.equal(session.snapshot().disconnected, true);
  ready();
  assert.equal(session.snapshot().disconnected, false);
  assert.equal(session.snapshot().reconnecting, false);
  assert.equal(session.snapshot().paused, true);
  assert.equal(session.snapshot().following, false);
});

test('cold launch restores only the same account and endpoint, without caching tokens or audio', async context => {
  const { fixture, session, join } = setup(context);
  join(); session.suspend();
  const cached = fixture.storage.get(cacheKey);
  assert.deepEqual(Object.keys(cached).sort(), ['apiBase', 'code', 'expiresAt', 'following', 'language', 'paused', 'roomId', 'userId'].sort());
  const fresh = harness(), connections = [];
  const transport = fresh.load('services/translation-room');
  transport.connect = (value, hooks) => { connections.push(value); hooks.event({ type: 'subscription.ready', payload: { room: value } }); return { close() {}, pause() {} }; };
  fresh.storage.set(cacheKey, cached);
  const restored = fresh.load('services/translation-session');
  const pending = restored.resume();
  assert.equal(fresh.requests[0].options.data.code, room.code);
  fresh.requests[0].ok(room); await pending;
  assert.equal(restored.snapshot().room.roomId, room.roomId);
  restored.disconnect();
  const other = harness(account('9223372036854775804'));
  other.storage.set(cacheKey, cached);
  await other.load('services/translation-session').resume();
  assert.equal(other.requests.length, 0);
  const endpoint = harness(); endpoint.storage.set(cacheKey, { ...cached, apiBase: 'https://other.invalid/api' });
  await endpoint.load('services/translation-session').resume();
  assert.equal(endpoint.requests.length, 0);
});

test('socket failure retries with backoff and joins before opening a replacement socket', async context => {
  const { fixture, session, handlers, sockets, join, ready } = setup(context);
  join();
  handlers.Error();
  context.mock.timers.tick(999); assert.equal(fixture.requests.length, 0);
  context.mock.timers.tick(1); assert.equal(fixture.requests.length, 1);
  fixture.requests[0].reject({ errorMessage: 'offline' }); await tick();
  context.mock.timers.tick(1999); assert.equal(fixture.requests.length, 1);
  context.mock.timers.tick(1); assert.equal(fixture.requests.length, 2);
  fixture.requests[1].ok(room); await tick();
  assert.equal(sockets.length, 2); ready();
  assert.equal(session.snapshot().disconnected, false);
  assert.equal(session.snapshot().reconnecting, false);
});

test('logout, explicit leave and replacement rooms invalidate pending recovery and cached room', async context => {
  for (const action of ['leave', 'logout', 'replace']) {
    const audit = setupWithoutTimers();
    audit.session.attach(room, 'en'); audit.session.suspend();
    const restoring = audit.session.resume(), pending = audit.fixture.requests[0];
    if (action === 'logout') audit.fixture.auth.logout();
    else if (action === 'replace') audit.session.attach({ ...room, roomId: '9223372036854775803', code: '87654321' }, 'ja');
    else {
      const leaving = audit.session.leave();
      audit.fixture.requests.at(-1).ok({});
      await leaving;
    }
    assert.equal(pending.aborted, true);
    pending.ok(room); await restoring;
    assert.equal(audit.sockets.length, action === 'replace' ? 2 : 1);
    if (action !== 'replace') assert.equal(audit.fixture.storage.has(cacheKey), false);
    else assert.equal(audit.fixture.storage.get(cacheKey).roomId, '9223372036854775803');
    audit.session.disconnect();
  }
  function setupWithoutTimers() {
    const fixture = harness(), sockets = [];
    fixture.load('services/translation-room').connect = value => { sockets.push(value); return { close() {}, pause() {} }; };
    return { fixture, sockets, session: fixture.load('services/translation-session') };
  }
});

test('closed or reassigned room codes stop recovery and never connect to the wrong room', async context => {
  const { fixture, session, join, sockets } = setup(context);
  join(); session.suspend();
  const pending = session.resume();
  fixture.requests[0].ok({ ...room, roomId: '9223372036854775804' }); await pending;
  assert.equal(sockets.length, 1);
  assert.equal(fixture.storage.has(cacheKey), false);
  context.mock.timers.tick(60000); assert.equal(fixture.requests.length, 1);
  session.suspend(); await session.resume();
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.storage.has(cacheKey), false);
  session.attach(room, 'en'); session.suspend();
  const unavailable = session.resume();
  fixture.requests[1].ok(null, 400); await unavailable;
  context.mock.timers.tick(60000); assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.storage.has(cacheKey), false);
});

test('a second background transition aborts a pending rejoin without losing its cache', async context => {
  const { fixture, session, join, sockets, ready } = setup(context);
  join(); session.suspend();
  const previous = session.resume();
  session.suspend();
  assert.equal(fixture.requests[0].aborted, true);
  assert.ok(fixture.storage.has(cacheKey));
  fixture.requests[0].ok(room); await previous;
  assert.equal(sockets.length, 1);
  const next = session.resume();
  fixture.requests[1].ok(room); await next; ready();
  assert.equal(sockets.length, 2);
});

test('foreground recovery of a dissolved room clears errors and cache without retrying', async context => {
  const { fixture, session, join } = setup(context);
  join(); session.suspend();
  const pending = session.resume();
  fixture.requests[0].options.success({ status: 400, data: { code: 10001, message: '房间已结束，不能继续加入或输入' } });
  await pending;
  const state = session.snapshot();
  assert.equal(state.room.status, 'closed');
  assert.equal(state.following, false);
  assert.equal(state.reconnecting, false);
  assert.equal(state.error, '');
  assert.equal(state.notice, '车夫已解散房间');
  assert.equal(fixture.storage.has(cacheKey), false);
  session.suspend();
  context.mock.timers.tick(60000); await session.resume();
  assert.equal(fixture.requests.length, 1);
  assert.equal(session.snapshot().notice, '车夫已解散房间');
});

test('handshake timeout and missing business pong both lead to guest recovery', async context => {
  const { fixture, session, join, ready } = setup(context);
  join();
  context.mock.timers.tick(60000); await tick();
  assert.equal(session.snapshot().reconnecting, true);
  context.mock.timers.tick(1000);
  assert.match(fixture.requests[0].options.url, /join$/);
  fixture.requests[0].ok(room); await tick();
  context.mock.timers.tick(15000);
  assert.equal(session.snapshot().disconnected, true);
  context.mock.timers.tick(2000);
  fixture.requests[1].ok(room); await tick(); ready();
  assert.equal(session.snapshot().disconnected, false);
});

test('app lifecycle preserves the live connection in background mode', async context => {
  const { fixture, session, join, ready, sockets } = setup(context);
  join();
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../dist/app.js'), 'utf8'), {
    require: name => fixture.load(name.replace(/^\.\//, '')), App: definition => Object.assign(fixture.app, definition)
  });
  fixture.app.onHide(); fixture.app.onShow(); fixture.app.onShow();
  assert.equal(fixture.requests.length, 0);
  assert.equal(sockets.length, 1);
  assert.equal(session.snapshot().disconnected, false);
  assert.equal(session.snapshot().reconnecting, false);
});

test('explicit session suspend still disconnects when background retention is not requested', context => {
  const { fixture, session, join, sockets } = setup(context);
  join();
  session.suspend();
  assert.equal(sockets.length, 1);
  assert.equal(session.snapshot().disconnected, true);
  assert.equal(fixture.storage.has(cacheKey), true);
});

test('background retention keeps driver polling alive and a background disconnect waits for foreground recovery', async context => {
  const { fixture, session, handlers, join, ready, sockets } = setup(context);
  join();
  const fixes = [];
  const stop = fixture.load('services/location').watch(fix => fixes.push(fix), () => {});
  context.after(stop);
  const result = () => ({ roomId: room.roomId, status: 'online', coordinateSystem: 'GCJ-02', longitude: 116.4, latitude: 39.9, accuracy: 8, sampledAt: new Date(Date.now()).toISOString(), serverTime: new Date(Date.now()).toISOString() });
  session.suspend({ preserveConnection: true });
  assert.equal(fixture.requests[0].aborted, false);
  fixture.requests[0].ok(result()); await tick();
  context.mock.timers.tick(1000);
  fixture.requests[1].ok(result()); await tick();
  assert.equal(fixes.length, 2);
  handlers.Error();
  context.mock.timers.tick(60000); await tick();
  assert.equal(fixture.requests.length, 2);
  assert.equal(session.snapshot().disconnected, true);
  const recovery = session.resume();
  assert.match(fixture.requests[2].options.url, /join$/);
  fixture.requests[2].ok(room); await recovery; ready();
  assert.equal(sockets.length, 2);
  assert.equal(session.snapshot().disconnected, false);
});

test('hiding during a pending rejoin cancels it even when background retention is enabled', async context => {
  const { fixture, session, join, sockets } = setup(context);
  join(); session.suspend();
  const recovery = session.resume(), request = fixture.requests[0];
  session.suspend({ preserveConnection: true });
  assert.equal(request.aborted, true);
  request.ok(room); await recovery;
  assert.equal(sockets.length, 1);
  assert.equal(session.snapshot().disconnected, true);
});

test('foreground resume replaces a retained socket that has missed its business pong deadline', async context => {
  const { fixture, session, join, ready, sockets } = setup(context);
  join(); session.suspend({ preserveConnection: true });
  const beforeSleep = Date.now;
  Date.now = () => beforeSleep() + 60000;
  try {
    const recovery = session.resume();
    assert.equal(fixture.requests.length, 1);
    assert.match(fixture.requests[0].options.url, /join$/);
    fixture.requests[0].ok(room); await recovery; ready();
    assert.equal(sockets.length, 2);
    assert.equal(session.snapshot().disconnected, false);
  } finally { Date.now = beforeSleep; }
});

test('expired and malformed cached identities cannot start recovery', async context => {
  const { fixture, session } = setup(context);
  for (const changes of [{ roomId: 9223372036854775805 }, { expiresAt: '2000-01-01T00:00:00Z' }, { code: '123' }]) {
    fixture.storage.set(cacheKey, { ...room, userId, apiBase: fixture.load('config').apiBase, language: 'en', ...changes });
    await session.resume();
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.storage.has(cacheKey), false);
  }
});

test('synchronous socket connection failures do not leave a stale owner blocking recovery', async context => {
  const { fixture, session, sockets, ready } = setup(context);
  fixture.my.connectSocket = options => options.fail();
  session.attach(room, 'en');
  assert.equal(session.snapshot().reconnecting, true);
  fixture.my.connectSocket = options => sockets.push(options);
  context.mock.timers.tick(1000);
  fixture.requests[0].ok(room); await tick(); ready();
  assert.equal(sockets.length, 1);
  assert.equal(session.snapshot().disconnected, false);
});

test('manual following preference changes during a pending recovery are retained', async context => {
  const { fixture, session, join, ready } = setup(context);
  join(); session.suspend();
  const pending = session.resume();
  session.setFollowing(false);
  fixture.requests[0].ok(room); await pending; ready();
  assert.equal(session.snapshot().following, false);
  assert.equal(fixture.storage.get(cacheKey).following, false);
});
