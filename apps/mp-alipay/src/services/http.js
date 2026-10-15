const config = require('../config');
const { createUtf8Decoder } = require('../core/utf8');
let authHooks = null;
function configureAuth(hooks) { authHooks = hooks; }
function raw(path, options = {}) {
  let task;
  let settled = false;
  let rejectRequest;
  const decoder = createUtf8Decoder();
  let chunkError = null;
  const promise = new Promise((resolve, reject) => {
    rejectRequest = reject;
    task = my.request({
      url: config.apiBase + path, method: options.method || 'GET', data: options.data,
      headers: Object.assign({ 'Content-Type': 'application/json' }, options.headers),
      dataType: options.dataType || 'json', timeout: options.timeout || 30000,
      ...(options.onChunk ? { enableChunked: true } : {}),
      success(response) {
        if (settled) return;
        settled = true;
        try { decoder.finish(); if (chunkError) reject(chunkError); else resolve(response); }
        catch (error) { reject(error); }
      },
      fail(error) {
        if (settled) return;
        settled = true;
        if (error.status) resolve(error);
        else reject(Object.assign(new Error(error.errorMessage || '网络连接失败，请稍后重试'), { cause: error }));
      }
    });
    if (options.onChunk && task && typeof task.onChunkReceived === 'function') task.onChunkReceived(chunk => {
      if (settled || chunkError) return;
      try { options.onChunk(decoder.decode(typeof chunk === 'string' ? chunk : chunk && chunk.data)); }
      catch (error) { chunkError = error; settled = true; reject(error); if (task.abort) task.abort(); }
    });
  });
  promise.abort = () => {
    if (settled) return;
    settled = true;
    rejectRequest(Object.assign(new Error('请求已取消'), { cancelled: true }));
    if (task && task.abort) task.abort();
  };
  return promise;
}
function decode(response, text = false) {
  let body = response.data;
  if (typeof body === 'string' && (!text || /^\s*\{/.test(body))) { try { body = JSON.parse(body); } catch (_) { if (!text) throw Error('服务返回了无法识别的数据'); } }
  if (response.status < 200 || response.status >= 300 || (body && body.code !== undefined && body.code !== 0)) {
    throw Object.assign(new Error(body && body.message || '服务暂不可用，请重试'), { status: response.status, code: body && body.code });
  }
  return text ? body : body && body.data;
}
function request(path, options = {}) {
  let active, cancelled = false;
  const version = authHooks && authHooks.version();
  const run = async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (cancelled) throw Object.assign(Error('请求已取消'), { cancelled: true });
      if (!options.public && authHooks && version !== authHooks.version()) throw Error('账号已切换，请重试');
      const token = options.public ? '' : authHooks && authHooks.token();
      active = raw(path, Object.assign({}, options, { onChunk: options.onChunk ? chunk => { if (!cancelled && (!authHooks || version === authHooks.version())) options.onChunk(chunk); } : undefined, headers: Object.assign({}, options.headers, token ? { Authorization: 'Bearer ' + token } : {}) }));
      try {
        const response = await active;
        if (!options.public && authHooks && version !== authHooks.version()) throw Error('账号已切换，请重试');
        return decode(response, options.dataType === 'text');
      }
      catch (error) {
        // 只在明确鉴权失败时重放；网络超时不自动重试写请求。
        if (!options.public && !attempt && authHooks && (error.status === 401 || error.code === 10002)) {
          await authHooks.refresh();
        } else throw error;
      }
    }
  };
  const promise = run();
  promise.abort = () => { cancelled = true; if (active) active.abort(); };
  return promise;
}
function post(path, data, options = {}) { return request(path, Object.assign({}, options, { method: 'POST', data })); }
function query(path, params) {
  return path + '?' + Object.keys(params).filter(k => params[k] !== null && params[k] !== undefined).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]))).join('&');
}
module.exports = { request, post, raw, decode, query, configureAuth };
