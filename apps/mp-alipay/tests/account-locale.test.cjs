const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, session, userId } = require('./harness.cjs');

test('navigation startup waits for password login instead of returning the old guest', async () => {
  const h = harness();
  const login = h.auth.login({ account: 'host', password: 'secret' });
  let initialized = false;
  const startup = h.auth.ensure().then(value => { initialized = true; return value; });
  await tick();
  assert.equal(initialized, false);
  assert.equal(h.requests.length, 1);
  h.requests[0].ok({ ...session(userId, 'host-token'), isGuest: false });
  await login;
  assert.equal((await startup).isGuest, false);
  assert.equal(h.auth.restore().accessToken, 'host-token');
});

test('cancelled native login lets waiting navigation retain its existing guest', async () => {
  const h = harness(); let authorization;
  h.my.getAuthCode = options => { authorization = options; };
  const login = h.auth.loginAlipay();
  const rejected = assert.rejects(login, /未完成支付宝授权/);
  let initialized = false;
  const startup = h.auth.ensure().then(value => { initialized = true; return value; });
  await tick();
  assert.equal(initialized, false);
  authorization.fail({}); await rejected;
  assert.equal((await startup).isGuest, true);
  assert.equal(h.requests.length, 0);
});

test('same-ID account upgrade clears the old room while token refresh preserves it and its language', async () => {
  const h = harness(); let closed = 0;
  h.load('services/translation-room').connect = () => ({ close() { closed++; } });
  const roomSession = h.load('services/translation-session');
  roomSession.attach({ roomId: '9223372036854775805', isHost: false }, 'en');
  const refresh = h.auth.refresh();
  h.requests[0].ok({ accessToken: 'refreshed', refreshToken: 'new-refresh' }); await refresh;
  assert.equal(roomSession.snapshot().room.roomId, '9223372036854775805');
  const login = h.auth.login({ account: 'host', password: 'secret' });
  h.requests[1].ok({ ...session(userId, 'host-token'), isGuest: false }); await login;
  assert.equal(roomSession.snapshot().room, null);
  assert.equal(roomSession.snapshot().language, 'en');
  assert.equal(closed, 1);
});

test('returning room page refreshes host permission after same-ID login', async () => {
  const h = harness(), page = h.page('translation-room');
  page.onLoad(); page.onShow(); await tick();
  assert.equal(h.requests.length, 1);
  h.requests[0].ok({ canHost: false }); await tick(); page.onHide();
  const login = h.auth.login({ account: 'host', password: 'secret' });
  h.requests[1].ok({ ...session(userId, 'host-token'), isGuest: false }); await login;
  page.onShow(); await tick();
  assert.equal(h.requests.length, 3);
  assert.match(h.requests[2].options.url, /host-permission$/);
  h.requests[2].ok({ canHost: true }); await tick();
  assert.equal(page.data.canHost, true);
  assert.equal(page.data.permissionPending, false); page.onUnload();
});

test('returning navigation reinitializes for a same-ID account upgrade', async () => {
  const h = harness(), page = h.page('tour');
  h.load('services/storage').write('locale', 'en');
  page.onLoad(); await tick(); h.requests[0].ok({ routes: [], places: [], destinations: [] }); await tick();
  page.onHide();
  const login = h.auth.login({ account: 'host', password: 'secret' });
  h.requests[1].ok({ ...session(userId, 'host-token'), isGuest: false }); await login;
  page.onShow(); await tick();
  assert.equal(h.requests.length, 3);
  assert.match(h.requests[2].options.url, /ClientCatalog\/Catalog$/);
  h.requests[2].ok({ routes: [], places: [], destinations: [] }); await tick(); page.onUnload();
});

test('My language preference takes precedence over an older tour preference on relaunch', async () => {
  const h = harness(), storage = h.load('services/storage'), titles = [];
  h.my.setNavigationBar = value => titles.push(value.title);
  storage.write('tour-locale', 'zh');
  h.page('me').locale({ detail: { value: 1 } });
  const page = h.page('tour'); page.onLoad(); await tick();
  assert.equal(h.requests[0].options.data.locale, 'en');
  h.requests[0].ok({ routes: [], places: [], destinations: [] }); await tick();
  assert.equal(page.data.locale, 'en');
  assert.equal(storage.read('tour-locale'), 'en');
  assert.equal(page.data.destinations[0].name, 'All destinations');
  assert.equal(page.data.locationNote, page.data.messages.locationHint);
  assert.equal(titles.at(-1), 'Path Seeker · Tour'); page.onUnload();
});

test('direct room entry inherits saved language while an active subscription keeps its own language', async () => {
  const h = harness(), storage = h.load('services/storage');
  storage.write('locale', 'en');
  const page = h.page('translation-room'); page.onLoad({ roomCode: '12345678' }); await tick();
  assert.equal(page.data.language, 'en');
  assert.equal(page.data.messages.joinTitle, 'Join a commentary room');
  h.requests[0].ok({ canHost: false }); await tick(); page.onUnload();
  h.load('services/translation-room').connect = () => ({ close() {} });
  const roomSession = h.load('services/translation-session');
  roomSession.attach({ roomId: '9223372036854775805', isHost: false }, 'ja');
  const reopened = h.page('translation-room'); reopened.onLoad(); await tick();
  assert.equal(reopened.data.language, 'ja'); reopened.onUnload(); h.auth.logout();
});

test('navigation confirmation content and native buttons follow the selected language', async () => {
  const h = harness(), page = h.page('tour');
  const messages = h.load('shared/tourMessages').tourMessages('en');
  page._rev = 0; page._user = userId;
  page.setData({ messages, locale: 'en', visit: { visitId: '9223372036854775805' } });
  const ending = page.endVisit();
  assert.equal(h.confirms[0].title, 'End journey');
  assert.equal(h.confirms[0].content, 'End this journey and keep completed stops?');
  assert.equal(h.confirms[0].confirmButtonText, 'Confirm');
  assert.equal(h.confirms[0].cancelButtonText, 'Cancel');
  h.confirms[0].success({ confirm: false }); await ending;
});
