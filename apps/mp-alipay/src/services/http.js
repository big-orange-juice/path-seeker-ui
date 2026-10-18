const config = require('../config');
const { createUtf8Decoder } = require('../core/utf8');
const { diag } = require('./diag');
let authHooks = null;
function configureAuth(hooks) { authHooks = hooks; }
function raw(path, options = {}) {
  let task;
  let settled = false;
  let streamOpen = false;
  let rejectRequest;
  const decoder = createUtf8Decoder();
  let chunkError = null;
  const started = Date.now();
  let chunks = 0;
  if (options.onChunk) {
    let info = {};
    try { info = my.getSystemInfoSync ? my.getSystemInfoSync() : {}; } catch (_) {}
    const canIUse = key => typeof my.canIUse === 'function' && my.canIUse(key);
    diag('client', { version: info.version, sdk: info.SDKVersion, platform: info.platform, model: info.model });
    diag('chunked', { enable: canIUse('request.object.enableChunked'), chunk: canIUse('request.return.onChunkReceived') });
  }
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
        // 支付宝分块模式可能先回调一次“响应头到达”（data 为空），body 仍从 onChunkReceived 流入；
        // 此时不能结束解码器，也不能把空响应当成整轮结束。只有 2xx 才按流继续等待。
        const streaming = !!options.onChunk
          && (!response || response.status === undefined || (response.status >= 200 && response.status < 300))
          && (!response || response.data === undefined || response.data === null);
        streamOpen = streaming;
        if (options.onChunk) diag('success', { ms: Date.now() - started, status: response && response.status, keys: response && Object.keys(response), type: response && typeof response.data, size: response && typeof response.data === 'string' ? response.data.length : response && response.data && response.data.byteLength, chunks, streaming });
        if (streaming) { resolve(response); return; }
        try { decoder.finish(); if (chunkError) reject(chunkError); else resolve(response); }
        catch (error) { reject(error); }
      },
      fail(error) {
        if (settled) return;
        settled = true;
        streamOpen = false;
        if (options.onChunk) diag('fail', { ms: Date.now() - started, status: error && error.status, code: error && error.error, message: error && error.errorMessage });
        if (error.status) resolve(error);
        else reject(Object.assign(new Error(error.errorMessage || '网络连接失败，请稍后重试'), { cause: error }));
      }
    });
    if (options.onChunk) {
      if (task && typeof task.onChunkReceived === 'function') {
        diag('chunk-api', 'attached');
        task.onChunkReceived(chunk => {
          if (chunkError || (settled && !streamOpen)) return;
          chunks++;
          if (chunks <= 3 || chunks % 20 === 0) diag('chunk', { n: chunks, ms: Date.now() - started, type: typeof chunk, data: chunk && typeof chunk.data, size: chunk && (typeof chunk === 'string' ? chunk.length : chunk.data && (chunk.data.byteLength || chunk.data.length)) });
          try { options.onChunk(decoder.decode(typeof chunk === 'string' ? chunk : chunk && chunk.data)); }
          catch (error) { diag('chunk-error', error.message); chunkError = error; streamOpen = false; settled = true; reject(error); if (task.abort) task.abort(); }
        });
      } else diag('chunk-api', 'missing');
    }
  });
  promise.streamOpen = () => streamOpen;
  promise.finishStream = () => {
    if (!streamOpen) return;
    streamOpen = false;
    decoder.finish();
  };
  promise.abort = () => {
    streamOpen = false;
    if (!settled) {
      settled = true;
      rejectRequest(Object.assign(new Error('请求已取消'), { cancelled: true }));
    }
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
  promise.streamOpen = () => !!(active && active.streamOpen && active.streamOpen());
  promise.finishStream = () => { if (active && active.finishStream) active.finishStream(); };
  return promise;
}
function post(path, data, options = {}) { return request(path, Object.assign({}, options, { method: 'POST', data })); }
function query(path, params) {
  return path + '?' + Object.keys(params).filter(k => params[k] !== null && params[k] !== undefined).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]))).join('&');
}
module.exports = { request, post, raw, decode, query, configureAuth };
