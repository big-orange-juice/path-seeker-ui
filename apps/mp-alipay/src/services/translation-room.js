const http = require('./http');
const auth = require('./auth');
const config = require('../config');
const speech = require('./speech');
const audio = require('./audio');
const { wavPcm, base64 } = require('../core/room-pcm');
const { RoomEventCursor } = require('../shared/translation-room');
const api = (path, data) => data === undefined ? http.request('/TranslationRooms' + path) : http.post('/TranslationRooms' + path, data);
let socketOwner = null;

function connect(room, hooks) {
  if (socketOwner) throw Error('已有讲解连接，请先退出房间');
  const owner = {}, session = auth.current();
  if (!session) throw Error('请先登录');
  socketOwner = owner;
  const cursor = new RoomEventCursor();
  let closed = false, opened = false, paused = false, heartbeat, hex = '', format = 'mp3', writes = Promise.resolve(), fileIndex = 0;
  let recorder = null, recording = false, stopping = null, stopped = null, uploads = Promise.resolve(), pendingUploads = 0;
  const paths = [];
  const token = room.isHost ? null : audio.beginStream('translation-room', { error: hooks.error, finished: () => speech.cleanup(paths.splice(0)) });
  const active = () => !closed && socketOwner === owner && auth.current() && auth.current().userId === session.userId;
  const send = (data, binary = false) => new Promise((resolve, reject) => {
    if (!active() || !opened) { reject(Error('讲解连接已断开')); return; }
    my.sendSocketMessage({ data: binary ? base64(data) : JSON.stringify(data), isBuffer: binary, success: resolve, fail: () => reject(Error('讲解上传失败，请重新连接')) });
  });
  function flushAudio() {
    if (!hex) return;
    const sentence = { hex, format }, index = fileIndex++; hex = '';
    writes = writes.then(async () => {
      if (!active()) return;
      const files = await speech.audioFiles([sentence], 'room-' + Date.now() + '-' + index);
      if (!active()) { speech.cleanup(files); return; }
      paths.push(files[0]);
      if (paths.length > 240) throw Error('收听积压过多，请退出后重新接入');
      audio.appendStream(token, { id: String(index), url: files[0], kind: 'answer' });
      if (paused) audio.pause();
    }).catch(error => { hooks.error(error); close(true); });
  }
  function onMessage(message) {
    if (!active()) return;
    try {
      const event = JSON.parse(message.data);
      if (!cursor.accept(event)) return;
      const payload = event.payload || {};
      if (event.type === 'audio.started') format = payload.format || 'mp3';
      if (event.type === 'audio.delta' && !room.isHost) {
        if (payload.encoding && payload.encoding !== 'hex' || payload.audio && !/^(?:[0-9a-fA-F]{2})*$/.test(payload.audio)) throw Error('语音格式无效');
        hex += payload.audio || ''; format = payload.format || format;
        if (hex.length > 16 * 1024 * 1024) throw Error('语音积压过多，请重新收听');
        if (payload.isFinal) flushAudio();
      }
      if (event.type === 'audio.done') flushAudio();
      if (event.type === 'audio.error' || event.type === 'language.error') hex = '';
      hooks.event(event);
      if (event.type === 'room.closed') {
        if (payload.mode === 'immediate') close(true);
        else writes.then(() => { if (token !== null) audio.finishStream(token); close(false); });
      }
    } catch (error) { hooks.error(error); }
  }
  function onOpen() {
    if (!active()) return;
    opened = true;
    heartbeat = setInterval(() => send({ type: 'ping' }).catch(hooks.error), 15000);
    if (hooks.open) hooks.open();
  }
  function onClose() { if (active()) { close(false); hooks.disconnected(); } }
  function onError() { if (active()) { hooks.error(Error('讲解连接失败，请检查网络')); onClose(); } }
  my.onSocketOpen(onOpen); my.onSocketMessage(onMessage); my.onSocketClose(onClose); my.onSocketError(onError);
  my.connectSocket({ url: config.apiBase.replace(/^http/, 'ws') + '/TranslationRooms/' + encodeURIComponent(room.roomId) + '/events', protocols: ['translation', 'bearer.' + session.accessToken], fail: onError });

  function detachRecorder() {
    if (!recorder) return;
    recorder.offStart(onRecordStart); recorder.offStop(onRecordStop); recorder.offError(onRecordError);
    speech.releaseRecorder(owner); recorder = null;
  }
  function onRecordStart() { if (recorder && (!recording || closed)) recorder.stop(); }
  function onRecordStop(result) {
    if (recording && active()) recorder.start({ format: 'wav', sampleRate: 16000, numberOfChannels: 1, duration: 4000 });
    pendingUploads++;
    uploads = uploads.then(async () => {
      if (!active()) return;
      const file = await new Promise((resolve, reject) => my.getFileSystemManager().readFile({ filePath: result.tempFilePath, success: resolve, fail: reject }));
      const pcm = wavPcm(file.data);
      for (let offset = 0; offset < pcm.byteLength; offset += 16000) await send(pcm.slice(offset, offset + 16000), true);
    }).catch(error => { hooks.error(error instanceof Error ? error : Error('录音上传失败')); close(true); }).finally(() => { pendingUploads--; speech.cleanup([result.tempFilePath]); });
    if (pendingUploads > 3) { hooks.error(Error('上传积压，请检查网络后重新开始讲解')); close(true); }
    if (!recording) {
      detachRecorder();
      uploads.finally(() => { if (stopped) { stopped(); stopped = null; } });
    }
  }
  function onRecordError(result) {
    recording = false;
    hooks.error(Error(result.errorMessage || '录音失败，请允许麦克风权限后重试'));
    detachRecorder();
    if (stopped) { stopped(); stopped = null; }
    close(true);
  }
  async function startRecording() {
    if (!room.isHost || recording || recorder) return;
    if (!my.getRecorderManager || !my.getFileSystemManager) throw Error('请更新支付宝后使用讲解功能');
    if (!speech.reserveRecorder(owner)) throw Error('麦克风正在使用中，请稍后重试');
    try {
      recorder = my.getRecorderManager();
      recorder.onStart(onRecordStart); recorder.onStop(onRecordStop); recorder.onError(onRecordError);
      await send({ type: 'input.start' });
      recording = true;
      recorder.start({ format: 'wav', sampleRate: 16000, numberOfChannels: 1, duration: 4000 });
    } catch (error) { recording = false; detachRecorder(); throw error; }
  }
  async function stopRecording() {
    if (!recorder) return;
    if (stopping) return stopping;
    recording = false;
    stopping = new Promise(resolve => { stopped = resolve; recorder.stop(); });
    return stopping;
  }
  function close(stopAudio = true) {
    if (closed) {
      if (stopAudio && token !== null) {
        audio.stop('translation-room');
        writes.finally(() => speech.cleanup(paths.splice(0)));
      }
      return;
    }
    closed = true;
    clearInterval(heartbeat);
    if (recorder) { recording = false; recorder.stop(); }
    if (stopAudio && token !== null) audio.stop('translation-room');
    if (!stopAudio && token !== null) audio.finishStream(token);
    if (stopAudio) writes.finally(() => speech.cleanup(paths.splice(0)));
    ['Open', 'Message', 'Close', 'Error'].forEach((name, index) => { if (my['offSocket' + name]) my['offSocket' + name]([onOpen, onMessage, onClose, onError][index]); });
    my.closeSocket({}); socketOwner = null;
  }
  return {
    close, startRecording,
    pause(value) { paused = value; if (value) audio.pause(); else audio.resume('translation-room'); },
    async end(immediate) {
      if (!immediate && recorder) { await stopRecording(); await send({ type: 'input.end' }); }
      else { if (immediate) close(true); await api('/' + room.roomId + '/' + (immediate ? 'close' : 'end'), {}); }
    }
  };
}
module.exports = { api, connect };
