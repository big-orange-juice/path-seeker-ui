const speech = require('./speech');
function supported() {
  if (!my.getRecorderManager) return false;
  const manager = my.getRecorderManager();
  return typeof manager.onFrameRecorded === 'function' && typeof manager.offFrameRecorded === 'function';
}
function createDetector() {
  let noise = 0.006, hot = 0, elapsed = 0;
  return buffer => {
    const bytes = new Uint8Array(buffer);
    let energy = 0;
    for (let offset = 0; offset + 1 < bytes.length; offset += 2) {
      let sample = bytes[offset] | bytes[offset + 1] << 8;
      if (sample & 32768) sample -= 65536;
      energy += (sample / 32768) ** 2;
    }
    const samples = Math.floor(bytes.length / 2), duration = samples / 16;
    if (!samples) return false;
    const rms = Math.sqrt(energy / samples);
    elapsed += duration;
    if (elapsed < 250) { noise = Math.min(0.02, noise * 0.9 + rms * 0.1); return false; }
    if (rms > Math.max(0.03, noise * 3)) hot += duration;
    else { hot = 0; noise = Math.min(0.02, noise * 0.97 + rms * 0.03); }
    return hot >= 220;
  };
}
function monitor(onVoice, onError) {
  if (!supported()) { onError(Error('当前支付宝版本未提供实时收音，请按住说话打断')); return null; }
  const manager = my.getRecorderManager(), owner = {};
  if (!speech.reserveRecorder(owner)) return null;
  let closed = false, started = false, released = false, resolveStopped;
  const stopped = new Promise(resolve => { resolveStopped = resolve; });
  const detect = createDetector();
  const detach = result => {
    if (released) return;
    released = true;
    manager.offStart(start); manager.offStop(stop); manager.offError(error); manager.offFrameRecorded(frame);
    speech.releaseRecorder(owner);
    resolveStopped();
    if (result && result.tempFilePath) speech.cleanup([result.tempFilePath]);
  };
  const start = () => { if (released) return; started = true; if (closed) manager.stop(); };
  const stop = result => { detach(result); };
  const error = reason => { detach(); if (!closed) { closed = true; onError(Error(reason.errorMessage || '当前设备无法边播放边检测人声，请按住说话打断')); } };
  const close = () => { if (!closed) { closed = true; if (started && !released) manager.stop(); } return stopped; };
  const frame = result => {
    if (closed || released || !result.frameBuffer) return;
    if (detect(result.frameBuffer)) { close(); onVoice(); }
  };
  manager.onStart(start); manager.onStop(stop); manager.onError(error); manager.onFrameRecorded(frame);
  try { manager.start({ format: 'pcm', sampleRate: 16000, numberOfChannels: 1, frameSize: 2, duration: 60000 }); }
  catch (reason) { detach(); closed = true; onError(Error(reason.message || '实时收音不可用，请按住说话打断')); }
  return { stop: close };
}
module.exports = { supported, createDetector, monitor };
