const storage = require('./storage');
const http = require('./http');
let session = null, refreshing = null, guestPending = null, epoch = 0;
function valid(value) { return value && typeof value.userId === 'string' && value.userId && typeof value.accessToken === 'string' && value.accessToken && typeof value.refreshToken === 'string' && value.refreshToken; }
function restore() { const stored = storage.read('session'); session = valid(stored) ? stored : null; if (!session) storage.remove('session'); return session; }
function current() { return session; }
function save(value) {
  if (!valid(value)) throw Error('账号数据格式错误，请重新登录');
  session = value; storage.write('session', value); return value;
}
function logout() { epoch++; session = null; storage.remove('session'); }
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
module.exports = { restore, current, ensure, login, logout, refresh };
