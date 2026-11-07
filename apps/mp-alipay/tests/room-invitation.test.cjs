const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, session } = require('./harness.cjs');
const query = { roomCode: '12345678', autoJoin: '1' };
const invitationUrl = '/pages/translation-room/index?roomCode=12345678&autoJoin=1';
const signedIn = () => ({ ...session(), isGuest: false });

test('scans decode the APP link and reject malformed, ambiguous and foreign mini program codes', () => {
  const fixture = harness(), invitation = fixture.load('services/room-invitation');
  const scheme = 'alipays://platformapi/startapp?appId=' + fixture.load('config').appId
    + '&page=' + encodeURIComponent('pages/translation-room/index') + '&query=' + encodeURIComponent('roomCode=12345678&autoJoin=1');
  assert.equal(invitation.scan('https://ds.alipay.com/?scheme=' + encodeURIComponent(scheme)), query.roomCode);
  assert.equal(invitation.scan(scheme), query.roomCode);
  assert.equal(invitation.scan('12345678'), query.roomCode);
  assert.equal(invitation.scan('https://example.com/room?roomCode=12345678'), query.roomCode);
  for (const invalid of [scheme.replace(fixture.load('config').appId, '1111111111111111'), scheme.replace('index', 'other'),
    'https://ds.alipay.com/?scheme=%', 'https://example.com/?roomCode=12345678&roomCode=87654321', null, 'javascript:?roomCode=12345678']) {
    assert.equal(invitation.scan(invalid), '');
  }
  assert.equal(invitation.read({ roomCode: 12345678, autoJoin: '1' }), '');
  assert.equal(invitation.read({ roomCode: '12345678' }), '');
  assert.equal(invitation.read(null), '');
});

test('signed-in invite automatically joins once using saved language and stays in the room', async () => {
  const fixture = harness(signedIn());
  fixture.load('services/storage').write('locale', 'en');
  const page = fixture.page('translation-room');
  let attached, backCount = 0;
  page.attach = room => { attached = room; }; page.back = () => { backCount++; };
  page.onLoad(query); page.onShow(); await tick();
  assert.equal(fixture.requests.length, 1);
  fixture.requests[0].ok({ canHost: false }); await tick();
  assert.match(fixture.requests[1].options.url, /TranslationRooms\/join$/);
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.requests[1].options.data)), { code: '12345678', targetLanguage: 'en' });
  fixture.requests[1].ok({ roomId: '9223372036854775805', code: '12345678', isHost: false }); await tick();
  page.onShow(); await tick();
  assert.equal(attached.roomId, '9223372036854775805');
  assert.equal(fixture.requests.length, 2); assert.equal(backCount, 0);
  page.onUnload();
});

test('invitation preserves required authorization and returns to the original room after login', async () => {
  const fixture = harness();
  const navigation = []; fixture.my.navigateTo = options => navigation.push(options.url);
  const page = fixture.page('translation-room'); page.onLoad(query); await tick();
  assert.deepEqual(navigation, ['/pages/auth/index?roomCode=12345678&autoJoin=1']);
  assert.equal(fixture.requests.length, 0);
  page.onHide();
  const authPage = fixture.page('auth'); authPage.onLoad(query); authPage.onShow();
  fixture.my.getAuthCode = options => options.success({ authCode: 'code' });
  fixture.my.reLaunch = options => navigation.push(options.url);
  authPage.setData({ agreed: true });
  const login = authPage.alipay(); await tick();
  fixture.requests[0].ok(signedIn()); await login;
  assert.equal(navigation.at(-1), invitationUrl);
  page.onUnload();
});

test('invalid and manual room entries never automatically join', async () => {
  for (const entry of [{ roomCode: '12345678' }, { roomCode: 'bad', autoJoin: '1' }]) {
    const fixture = harness(signedIn()), page = fixture.page('translation-room');
    page.onLoad(entry); await tick(); fixture.requests[0].ok({ canHost: false }); await tick();
    assert.equal(fixture.requests.length, 1); page.onUnload();
  }
});

test('expired invitation shows the service error without a repeated join or navigation', async () => {
  const fixture = harness(signedIn()), page = fixture.page('translation-room');
  page.onLoad(query); await tick(); fixture.requests[0].ok({ canHost: false }); await tick();
  fixture.requests[1].options.success({ status: 400, data: { code: 400, message: '房间已结束，请重新加入' } }); await tick();
  assert.match(page.data.error, /房间已结束/); assert.equal(page.data.busy, false);
  page.onShow(); await tick(); assert.equal(fixture.requests.length, 2); page.onUnload();
});

test('late invitation response cannot attach after the page is hidden or the account changes', async () => {
  for (const change of ['hide', 'account']) {
    const fixture = harness(signedIn()), page = fixture.page('translation-room'); let attached = false;
    page.attach = () => { attached = true; };
    page.onLoad(query); await tick(); fixture.requests[0].ok({ canHost: false }); await tick();
    if (change === 'hide') page.onHide(); else fixture.auth.logout();
    fixture.requests[1].ok({ roomId: '9223372036854775805', code: '12345678', isHost: false }); await tick();
    assert.equal(attached, false); page.onUnload();
  }
});

test('cold launch uses the requested page and a warm scan opens the new invitation', () => {
  const fixture = harness(signedIn()), navigation = [];
  fixture.my.reLaunch = options => navigation.push(options.url);
  fixture.load('app'); fixture.app.onLaunch();
  fixture.app.onShow({ query }); assert.deepEqual(navigation, []);
  fixture.app.onHide(); fixture.app.onShow({ query });
  assert.deepEqual(navigation, []);
  fixture.app.onHide(); fixture.app.onShow({ query: { roomCode: '87654321', autoJoin: '1' } });
  assert.deepEqual(navigation, ['/pages/translation-room/index?roomCode=87654321&autoJoin=1']);
  fixture.app.onShow({ query: { roomCode: '87654321', autoJoin: '1' } });
  assert.equal(navigation.length, 1);
});

test('scanning a different room stops the old session and joins the newly encoded room', async () => {
  const fixture = harness(signedIn());
  fixture.load('services/translation-room').connect = () => ({ close() {} });
  const rooms = fixture.load('services/translation-session');
  rooms.attach({ roomId: '9223372036854775804', code: '87654321', isHost: false }, 'en');
  const page = fixture.page('translation-room'); page.onLoad(query); await tick();
  assert.equal(rooms.snapshot().room, null);
  const leaving = fixture.requests.find(request => /\/leave$/.test(request.options.url));
  assert.match(leaving.options.url, /9223372036854775804\/leave$/); leaving.ok({});
  fixture.requests.find(request => /host-permission$/.test(request.options.url)).ok({ canHost: false }); await tick();
  const joining = fixture.requests.find(request => /\/join$/.test(request.options.url));
  assert.equal(joining.options.data.code, '12345678');
  joining.ok({ roomId: '9223372036854775805', code: '12345678', isHost: false }); await tick();
  assert.equal(rooms.snapshot().room.code, '12345678');
  page.onUnload();
  const leave = rooms.leave(); await tick(); fixture.requests.at(-1).ok({}); await leave;
});

test('a driver scanning their own invitation cannot take over the APP host connection', async () => {
  const fixture = harness(signedIn()), page = fixture.page('translation-room');
  page.onLoad(query); await tick(); fixture.requests[0].ok({ canHost: true }); await tick();
  fixture.requests[1].ok({ roomId: '9223372036854775805', code: '12345678', isHost: true }); await tick();
  assert.equal(fixture.load('services/translation-session').snapshot().room, null);
  assert.match(page.data.error, /房主/); page.onUnload();
});
