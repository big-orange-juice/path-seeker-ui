const storage = require('./storage');
const http = require('./http');
let session = null, refreshing = null, guestPending = null, epoch = 0;
const listeners = new Set();
function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function valid(value) { return value && typeof value.userId === 'string' && value.userId && typeof value.accessToken === 'string' && value.accessToken && typeof value.refreshToken === 'string' && value.refreshToken; }
function restore() { const stored = storage.read('session'); session = valid(stored) ? stored : null; if (!session) storage.remove('session'); return session; }
function current() { return session; }
function save(value) {
  if (!valid(value)) throw Error('账号数据格式错误，请重新登录');
  session = value; storage.write('session', value); listeners.forEach(listener => listener(session)); return value;
}
function logout() { epoch++; session = null; storage.remove('session'); listeners.forEach(listener => listener(null)); }
function device() {
  try { const info = my.getSystemInfoSync(); return 'Alipay/' + (info.platform || '') + '/' + (info.model || ''); } catch (_) { return 'Alipay'; }
}
async function refresh() {
  if (refreshing && refreshing.epoch === epoch) return refreshing.promise;
  if (!session || !session.refreshToken) { logout(); throw Error('登录已过期，请重新登录'); }
  const captured = epoch;
  const pending = { epoch: captured };
  pending.promise = http.post('/AppUser/RefreshToken', { refreshToken: session.refreshToken }, { public: true }).then(result => {
    if (captured !== epoch) throw Error('账号已切换');
    return save(Object.assign({}, session, result));
  }).catch(error => { if (captured === epoch) logout(); throw error; }).finally(() => { if (refreshing === pending) refreshing = null; });
  refreshing = pending; return pending.promise;
}
async function login(data, register = false) {
  const captured = ++epoch;
  const result = await http.post(register ? '/AppUser/Register' : '/AppUser/Login', Object.assign({ platform: 4, device: device(), langCode: storage.read('locale', 'zh') }, data), { public: true });
  if (captured !== epoch) throw Error('账号已切换');
  epoch++;
  return save(result);
}
async function loginAlipay() {
  const captured = ++epoch;
  const guestAccessToken = session && session.isGuest ? session.accessToken : null;
  const authorization = await new Promise((resolve, reject) => my.getAuthCode({
    scopes: ['auth_user'],
    success: resolve,
    fail: () => reject(Error('未完成支付宝授权，可重试或继续游客浏览'))
  }));
  if (captured !== epoch) throw Error('账号已切换');
  if (!authorization || typeof authorization.authCode !== 'string' || !authorization.authCode.trim()) throw Error('未取得支付宝授权码，请重新授权');
  let result;
  try {
    result = await http.post('/AppUser/MiniProgramLogin', {
      provider: 'alipay', code: authorization.authCode, guestAccessToken,
      device: device(), langCode: storage.read('locale', 'zh')
    }, { public: true });
  } catch (error) {
    if (captured === epoch && guestAccessToken && (error.status === 401 || error.code === 10002)) {
      await refresh();
      throw Error('游客会话已更新，请再次点击授权登录');
    }
    throw error;
  }
  if (captured !== epoch) throw Error('账号已切换');
  if (!result || result.isGuest !== false) throw Error('支付宝登录未完成，请重试');
  epoch++;
  return save(result);
}
function ensure() {
  if (session) return Promise.resolve(session);
  if (guestPending && guestPending.epoch === epoch) return guestPending.promise;
  const captured = epoch;
  const pending = { epoch: captured };
  pending.promise = http.post('/AppUser/GuestLogin', { platform: 4, device: device(), langCode: storage.read('locale', 'zh') }, { public: true })
    .then(result => { if (captured !== epoch) throw Error('账号已切换'); return save(result); }).finally(() => { if (guestPending === pending) guestPending = null; });
  guestPending = pending; return pending.promise;
}
http.configureAuth({ token: () => session && session.accessToken, version: () => epoch, refresh });
module.exports = { restore, current, ensure, login, loginAlipay, logout, refresh, subscribe };
