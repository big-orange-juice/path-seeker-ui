const { appId, locales } = require('../config');
function read(query = {}) {
  return query && typeof query.roomCode === 'string' && /^\d{8}$/.test(query.roomCode) && query.autoJoin === '1' ? query.roomCode : '';
}
function target(query = {}) {
  const result = {};
  for (const key of ['routeId', 'routeCode']) {
    if (typeof query[key] === 'string' && query[key].trim() && query[key].length <= 128) result[key] = query[key];
  }
  if (locales.some(language => language.value === query.lang)) result.lang = query.lang;
  return result;
}
function entry(query = {}) {
  const code = read(query);
  return code ? Object.assign({ roomCode: code, autoJoin: '1' }, target(query)) : null;
}
function queryString(code, query = {}) {
  const values = Object.assign({ roomCode: code, autoJoin: '1' }, target(query));
  return Object.keys(values).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(values[key])).join('&');
}
function url(code, query = {}) { return '/pages/translation-room/index?' + queryString(code, query); }
function authUrl(query) { return '/pages/auth/index?' + queryString(query.roomCode, query); }
function destination(query, language) {
  const values = target(query);
  if (!values.lang) values.lang = language === 'zh-CN' ? 'zh' : locales.some(locale => locale.value === language) ? language : 'zh';
  return '/pages/tour/index?view=routes&' + Object.keys(values).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(values[key])).join('&');
}
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
function scanEntry(value) {
  if (typeof value !== 'string') return null;
  if (/^\d{8}$/.test(value)) return entry({ roomCode: value, autoJoin: '1' });
  try {
    if (value.indexOf('https://ds.alipay.com/?') === 0) value = parameters(value).scheme || '';
    if (value.indexOf('alipays://platformapi/startapp?') === 0) {
      const target = parameters(value);
      if (target.appId !== appId || target.page !== 'pages/translation-room/index') return null;
      return entry(parameters(target.query || ''));
    }
    const query = parameters(value);
    return /^https?:\/\//.test(value) ? entry(Object.assign({}, query, { autoJoin: '1' })) : null;
  } catch (_) { return null; }
}
function scan(value) { const invitation = scanEntry(value); return invitation ? invitation.roomCode : ''; }
module.exports = { read, entry, url, authUrl, destination, scan, scanEntry };
