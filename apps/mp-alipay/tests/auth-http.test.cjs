const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, session, userId } = require('./harness.cjs');
test('long string IDs survive query, request body and account-scoped visit storage', async () => {
  const h = harness(), http = h.load('services/http'), visits = h.load('services/visits');
  assert.equal(http.query('/test', { routeId: userId, stageId: userId, absent: null }), '/test?routeId=' + userId + '&stageId=' + userId);
  const route = { id: userId, title: 'Route' }, visit = { visitId: '9223372036854775805', routeId: userId, completedStageIds: [], status: 1 };
  const start = visits.start(route, 'zh'); assert.equal(h.requests[0].options.data.routeId, userId); h.requests[0].ok(visit); await start;
  const update = visits.update(visit, '9223372036854775804', 'complete', route, 2);
  assert.equal(h.requests[1].options.data.visitId, visit.visitId); assert.equal(h.requests[1].options.data.stageId, '9223372036854775804');
  h.requests[1].ok(visit); await update;
  assert.equal(visits.list()[0].routeId, userId);
  assert.ok(h.storage.has('path-seeker:alipay:v1:user:' + userId + ':visits'));
});
test('concurrent expired requests share one refresh and replay with new token', async () => {
  const h = harness(), http = h.load('services/http');
  const a = http.request('/a'), b = http.request('/b');
  h.requests[0].text({ code: 10002, message: 'Expired' }); h.requests[1].text({ code: 10002, message: 'Expired' }); await tick();
  assert.equal(h.requests.length, 3); assert.match(h.requests[2].options.url, /RefreshToken$/);
  h.requests[2].ok({ accessToken: 'new', refreshToken: 'new-refresh' }); await tick();
  assert.equal(h.requests.length, 5);
  for (const task of h.requests.slice(3)) { assert.equal(task.options.headers.Authorization, 'Bearer new'); task.ok(task.options.url); }
  await Promise.all([a, b]); assert.equal(h.auth.current().userId, userId);
});
test('guest creation is deduplicated and late response cannot undo logout', async () => {
  const h = harness(null), a = h.auth.ensure(), b = h.auth.ensure();
  assert.equal(a, b); assert.equal(h.requests.length, 1);
  h.auth.logout(); const rejected = assert.rejects(a, /账号已切换/); h.requests[0].ok(session()); await rejected;
  assert.equal(h.auth.current(), null);
});
test('late refresh cannot overwrite a newly logged-in account', async () => {
  const h = harness(), old = h.auth.refresh(), rejected = assert.rejects(old, /账号已切换/);
  const login = h.auth.login({ account: 'new', password: 'secret' });
  h.requests[1].ok(session('9223372036854775803', 'new-user')); await login;
  h.requests[0].ok({ accessToken: 'old-user', refreshToken: 'old-refresh' }); await rejected;
  assert.equal(h.auth.current().accessToken, 'new-user');
});
test('timeout POST is never replayed and buffered JSON errors remain readable', async () => {
  const h = harness(), http = h.load('services/http');
  const post = http.post('/write', {}), rejected = assert.rejects(post, /timeout/);
  h.requests[0].reject({ errorMessage: 'timeout' }); await rejected; assert.equal(h.requests.length, 1);
  const text = http.request('/sse', { dataType: 'text' }), business = assert.rejects(text, /quota exceeded/);
  h.requests[1].text('{"code":123,"message":"quota exceeded"}'); await business;
});
test('stale visit response cannot write records after switching accounts', async () => {
  const h = harness(), visits = h.load('services/visits');
  const start = visits.start({ id: userId }, 'zh'), rejected = assert.rejects(start, /账号已切换/);
  h.auth.logout(); h.requests[0].ok({ visitId: userId, routeId: userId }); await rejected;
  assert.equal([...h.storage.keys()].filter(k => k.endsWith(':visits')).length, 0);
});
test('abort settles a native request even when the platform sends no callback', async () => {
  const h = harness(), task = h.load('services/http').request('/slow'), rejected = assert.rejects(task, /请求已取消/);
  task.abort(); await rejected; assert.equal(h.requests[0].aborted, true);
});
test('numeric cached identity is discarded instead of losing int64 precision', () => {
  const h = harness({ userId: 9223372036854775806, accessToken: 'a', refreshToken: 'r' });
  assert.equal(h.auth.current(), null); assert.equal(h.storage.size, 0);
});
