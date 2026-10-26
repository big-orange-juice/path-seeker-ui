const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, plain, session, userId } = require('./harness.cjs');

test('optional login entries default off and their handlers do not authenticate', async () => {
  const h = harness(), page = h.page('auth'); let attempts = 0;
  h.auth.login = async () => { attempts++; };
  h.auth.ensure = async () => { attempts++; };
  assert.equal(page.data.guestLoginEnabled, false);
  assert.equal(page.data.passwordLoginEnabled, false);
  page.setData({ agreed: true, account: 'account', password: 'password' });
  page.mode(); await page.submit(); await page.guest();
  assert.equal(page.data.register, false); assert.equal(attempts, 0);
});

test('guest and password login can be enabled independently', async () => {
  for (const guestLogin of [false, true]) for (const passwordLogin of [false, true]) {
    const h = harness(); Object.assign(h.load('config').authOptions, { guestLogin, passwordLogin });
    const page = h.page('auth'); let guests = 0, passwords = 0;
    h.auth.ensure = async () => { guests++; };
    h.auth.login = async () => { passwords++; };
    assert.equal(page.data.guestLoginEnabled, guestLogin);
    assert.equal(page.data.passwordLoginEnabled, passwordLogin);
    page.setData({ agreed: true, account: 'account', password: 'password' });
    await page.submit(); await page.guest(); page.mode();
    assert.equal(guests, Number(guestLogin)); assert.equal(passwords, Number(passwordLogin));
    assert.equal(page.data.register, passwordLogin);
  }
});

test('authorization is requested only by an explicit agreed tap and duplicate taps are blocked', async () => {
  const h = harness(), page = h.page('auth'), authorizations = [];
  h.my.getAuthCode = options => authorizations.push(options);
  page.onShow(); assert.equal(authorizations.length, 0);
  await page.alipay(); assert.equal(authorizations.length, 0); assert.ok(page.data.error);
  page.setData({ agreed: true });
  const login = page.alipay(); await page.alipay();
  assert.equal(authorizations.length, 1);
  assert.deepEqual(plain(authorizations[0].scopes), ['auth_user']);
  authorizations[0].success({ authCode: 'one-use-code' }); await tick();
  const request = h.requests[0].options;
  assert.match(request.url, /AppUser\/MiniProgramLogin$/);
  assert.equal(request.headers.Authorization, undefined);
  assert.deepEqual(plain(request.data), {
    provider: 'alipay', code: 'one-use-code', guestAccessToken: 'access',
    device: 'Alipay/Android/test', langCode: 'zh'
  });
  h.requests[0].ok({ ...session(), isGuest: false }); await login;
  assert.equal(h.auth.current().userId, userId); assert.equal(h.auth.current().isGuest, false);
  assert.equal(page.data.busy, false);
});

test('cancelled authorization keeps the guest session and never calls login API', async () => {
  const h = harness(); h.my.getAuthCode = options => options.fail({ error: 11 });
  await assert.rejects(h.auth.loginAlipay(), /未完成支付宝授权/);
  assert.equal(h.requests.length, 0); assert.equal(h.auth.current().userId, userId);
});

test('startup during native authorization waits for formal login without creating a guest', async () => {
  const h = harness(null); let authorization;
  h.my.getAuthCode = options => { authorization = options; };
  const login = h.auth.loginAlipay(), guest = h.auth.ensure();
  assert.equal(h.requests.length, 0);
  authorization.success({ authCode: 'code' }); await tick();
  assert.equal(h.requests.length, 1);
  assert.match(h.requests[0].options.url, /MiniProgramLogin$/);
  h.requests[0].ok({ ...session(), isGuest: false }); await login;
  assert.equal((await guest).isGuest, false);
  assert.equal(h.auth.current().userId, userId); assert.equal(h.auth.current().isGuest, false);
});

test('missing auth code is rejected without passing any client identity', async () => {
  const h = harness(); h.my.getAuthCode = options => options.success({ userId: userId });
  await assert.rejects(h.auth.loginAlipay(), /未取得支付宝授权码/);
  assert.equal(h.requests.length, 0);
});

test('late native authorization and login response cannot undo logout', async () => {
  for (const duringNative of [true, false]) {
    const h = harness(); let authorization;
    h.my.getAuthCode = options => { authorization = options; };
    const login = h.auth.loginAlipay(), rejected = assert.rejects(login, /账号已切换/);
    if (duringNative) h.auth.logout();
    authorization.success({ authCode: 'code' }); await tick();
    if (!duringNative) { h.auth.logout(); h.requests[0].ok({ ...session(), isGuest: false }); }
    await rejected; assert.equal(h.auth.current(), null);
    assert.equal(h.requests.length, duringNative ? 0 : 1);
  }
});

test('failed platform login never replaces the guest or replays one-use code', async () => {
  const h = harness(); h.my.getAuthCode = options => options.success({ authCode: 'code' });
  const login = h.auth.loginAlipay(), rejected = assert.rejects(login, /授权码过期/); await tick();
  h.requests[0].text({ code: 11004, message: '授权码过期' }); await rejected;
  assert.equal(h.requests.length, 1); assert.equal(h.auth.current().isGuest, true);
});

test('expired guest session refreshes but requires a new explicit authorization', async () => {
  const h = harness(); let authorizations = 0;
  h.my.getAuthCode = options => { authorizations++; options.success({ authCode: 'code' }); };
  const login = h.auth.loginAlipay(), rejected = assert.rejects(login, /游客会话已更新/); await tick();
  h.requests[0].ok({ message: 'expired' }, 401); await tick();
  assert.match(h.requests[1].options.url, /RefreshToken$/);
  h.requests[1].ok({ ...session(), accessToken: 'fresh' }); await rejected;
  assert.equal(authorizations, 1); assert.equal(h.requests.length, 2);
  assert.equal(h.auth.current().accessToken, 'fresh');
});

test('platform login does not attach a registered account as guest and rejects numeric user IDs', async () => {
  const h = harness({ ...session(), isGuest: false });
  h.my.getAuthCode = options => options.success({ authCode: 'code' });
  const login = h.auth.loginAlipay(), rejected = assert.rejects(login, /账号数据格式错误/); await tick();
  assert.equal(h.requests[0].options.data.guestAccessToken, null);
  h.requests[0].ok({ ...session(), userId: 123, isGuest: false }); await rejected;
  assert.equal(h.auth.current().userId, userId);
});
