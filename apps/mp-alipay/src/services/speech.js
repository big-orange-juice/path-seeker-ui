const http = require('./http');
const auth = require('./auth');
function fileCall(method, params) {
  return new Promise((resolve, reject) => {
    if (!my.getFileSystemManager) { reject(Error('当前支付宝版本不支持文件处理，请更新客户端')); return; }
    my.getFileSystemManager()[method](Object.assign({}, params, { success: resolve, fail: e => reject(Error(e.errorMessage || '文件处理失败')) }));
  });
}
async function audioFiles(sentences, tag) {
  const paths = [];
  try {
    for (let i = 0; i < sentences.length; i++) {
      const item = sentences[i];
      if (!['mp3', 'wav'].includes(item.format)) throw Error('暂不支持此语音格式');
      const filePath = my.env.USER_DATA_PATH + '/ps-chat-' + tag + '-' + i + '.' + item.format;
      await fileCall('writeFile', { filePath, data: item.hex, encoding: 'hex' });
      paths.push(filePath);
    }
    return paths;
  } catch (error) { cleanup(paths); throw error; }
}
function cleanup(paths) { (paths || []).forEach(filePath => { fileCall('unlink', { filePath }).catch(() => {}); }); }
function asciiBytes(text) { return Array.from(text).map(c => c.charCodeAt(0)); }
function multipartWav(buffer, boundary) {
  const head = asciiBytes('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="question.wav"\r\nContent-Type: audio/wav\r\n\r\n');
  const tail = asciiBytes('\r\n--' + boundary + '--\r\n');
  const wav = new Uint8Array(buffer);
  if (wav.length > 10 * 1024 * 1024) throw Error('录音过大，请缩短问题');
  if (wav.length < 12 || String.fromCharCode.apply(null, wav.slice(0, 4)) !== 'RIFF' || String.fromCharCode.apply(null, wav.slice(8, 12)) !== 'WAVE') throw Error('录音不是 WAV 格式，请更新支付宝至 10.6.36 或以上，或改用文字提问');
  const body = new Uint8Array(head.length + wav.length + tail.length);
  body.set(head); body.set(wav, head.length); body.set(tail, head.length + wav.length);
  return body.buffer;
}
async function transcribe(filePath, active = () => true) {
  const user = (await auth.ensure()).userId;
  const result = await fileCall('readFile', { filePath });
  if (!active()) throw Error('录音已取消');
  if (!auth.current() || auth.current().userId !== user) throw Error('账号已切换');
  const boundary = 'PathSeeker' + Date.now();
  // 临时录音扩展名是 .audio，手工写 multipart 的 MIME，避免后端把 WAV 当普通文件拒绝。
  return http.post('/ExhibitChat/transcribe', multipartWav(result.data, boundary), { headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary }, timeout: 120000 });
}
let recorderOwner = null;
function recorder(onState, onResult, onError) {
  if (!my.getRecorderManager) throw Error('当前支付宝版本不支持录音，请使用文字提问');
  const manager = my.getRecorderManager();
  const owner = {};
  let cancelled = false, closed = false, held = false, processing = false, state = 'idle';
  const detach = () => { manager.offStart(start); manager.offStop(stop); manager.offError(error); };
  const release = () => { if (recorderOwner === owner) recorderOwner = null; };
  const start = () => { if (recorderOwner !== owner || state !== 'starting') return; state = 'recording'; if (!held || closed) manager.stop(); else onState(true, false); };
  const stop = async result => {
    if (recorderOwner !== owner || state === 'idle') return;
    state = 'idle'; held = false; release();
    if (closed) { cleanup([result.tempFilePath]); detach(); return; }
    onState(false, !cancelled);
    if (cancelled) { cleanup([result.tempFilePath]); return; }
    processing = true;
    try { const response = await transcribe(result.tempFilePath, () => !closed); if (!closed) onResult(response.text || ''); }
    catch (failure) { if (!closed) onError(failure); }
    finally { processing = false; cleanup([result.tempFilePath]); }
  };
  const error = result => {
    if (recorderOwner !== owner || state === 'idle') return;
    held = false; state = 'idle'; release();
    if (closed) { detach(); return; }
    onState(false, false);
    if (!cancelled) onError(Object.assign(Error(Number(result.error) === 7 ? '录音太短，请按住至少一秒' : Number(result.error) === 10 ? '麦克风权限未开启，请允许后重试' : result.errorMessage || '录音失败，请使用文字提问'), { denied: Number(result.error) === 10 }));
  };
  manager.onStart(start); manager.onStop(stop); manager.onError(error);
  return {
    start() {
      if (closed || processing || state !== 'idle' || recorderOwner) throw Error('录音尚未结束，请稍后重试');
      recorderOwner = owner; cancelled = false; held = true; state = 'starting';
      try { manager.start({ format: 'wav', sampleRate: 16000, numberOfChannels: 1, duration: 60000 }); }
      catch (failure) { state = 'idle'; held = false; release(); throw failure; }
    },
    stop(cancel = false) { cancelled = cancel; held = false; if (state === 'recording') manager.stop(); },
    // 启动回调可能晚于页面隐藏；等待原生停止事件后再卸载，保证麦克风关闭。
    destroy() { closed = true; cancelled = true; held = false; if (state === 'recording') manager.stop(); if (state === 'idle') { release(); detach(); } }
  };
}
module.exports = { audioFiles, cleanup, multipartWav, transcribe, recorder };
