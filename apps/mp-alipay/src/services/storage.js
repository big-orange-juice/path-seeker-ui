const prefix = 'path-seeker:alipay:v1:';
function read(key, fallback = null) {
  try { const result = my.getStorageSync({ key: prefix + key }); return result.data === undefined || result.data === null || result.data === '' ? fallback : result.data; } catch (_) { return fallback; }
}
function write(key, data) { my.setStorageSync({ key: prefix + key, data }); }
function remove(key) { my.removeStorageSync({ key: prefix + key }); }
// 用户维度的缓存不可在游客升级、退出或切换账号后串用。
function scoped(userId, key) { return 'user:' + String(userId) + ':' + key; }
module.exports = { read, write, remove, scoped };
