const { appId } = require('../config');
function read(query = {}) {
  return query && typeof query.roomCode === 'string' && /^\d{8}$/.test(query.roomCode) && query.autoJoin === '1' ? query.roomCode : '';
}
function url(code) { return '/pages/translation-room/index?roomCode=' + encodeURIComponent(code) + '&autoJoin=1'; }
function parameters(value) {
  const result = {};
  for (const part of value.slice(value.indexOf('?') + 1).split('#')[0].split('&')) {
    const split = part.indexOf('=');
    if (split < 0) continue;
    const key = decodeURIComponent(part.slice(0, split));
    if (Object.prototype.hasOwnProperty.call(result, key)) throw Error('重复扫码参数');
    result[key] = decodeURIComponent(part.slice(split + 1));
  }
  return result;
}
function scan(value) {
  if (typeof value !== 'string') return '';
  if (/^\d{8}$/.test(value)) return value;
  try {
    if (value.indexOf('https://ds.alipay.com/?') === 0) value = parameters(value).scheme || '';
    if (value.indexOf('alipays://platformapi/startapp?') === 0) {
      const target = parameters(value);
      if (target.appId !== appId || target.page !== 'pages/translation-room/index') return '';
      return read(parameters(target.query || ''));
    }
    const query = parameters(value);
    return /^https?:\/\//.test(value) && typeof query.roomCode === 'string' && /^\d{8}$/.test(query.roomCode) ? query.roomCode : '';
  } catch (_) { return ''; }
}
module.exports = { read, url, scan };
