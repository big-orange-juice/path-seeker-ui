const http = require('./http');
const auth = require('./auth');
const config = require('../config');
const speech = require('./speech');
const audio = require('./audio');
const tourAudio = require('./tour-audio-session');
const { wavPcm, base64 } = require('../core/room-pcm');
const { RoomEventCursor } = require('../shared/translation-room');
const api = (path, data) => data === undefined ? http.request('/TranslationRooms' + path) : http.post('/TranslationRooms' + path, data);
let socketOwner = null;

function connect(room, hooks) {
  if (socketOwner) throw Error('已有讲解连接，请先退出房间');
  const owner = {}, session = auth.current();
  if (!session) throw Error('请先登录');
  socketOwner = owner;
  const cursor = new RoomEventCursor(room.isHost);
  let closed = false, opened = false, paused = false, heartbeat, hex = '', format = 'mp3', writes = Promise.resolve(), fileIndex = 0;
  let recorder = null, recording = false, stopping = null, stopped = null, uploads = Promise.resolve(), pendingUploads = 0;
  let guestCapture = false, awaitSegment = false, pauseAck = null, pendingWrites = 0, yielded = false, receivingAudio = false, readyTimer, lastPong = Date.now();
  const paths = [];
  function publishPlayback() {
    if (!hooks.playback) return;
    if (tourAudio.activeForRoom(room.roomId)) { hooks.playback({ playing: false, pending: false }); return; }
    const value = audio.snapshot(), ownsAudio = value.owner === 'translation-room' && value.generation === token;
    hooks.playback({ playing: ownsAudio && value.playing,
      pending: !paused && !guestCapture && (receivingAudio || !yielded && (!!hex || pendingWrites > 0 || ownsAudio && !!value.item)) });
  }
  const playbackHooks = {
    error: error => { if (hooks.playbackError) hooks.playbackError(error); else hooks.error(error); },
    change: publishPlayback,
    interrupted: () => { if (!yielded && active()) { paused = true; hex = ''; if (hooks.interrupted) hooks.interrupted(); publishPlayback(); } },
    itemEnded: item => {
      const index = paths.indexOf(item.url);
      if (index >= 0) { paths.splice(index, 1); speech.cleanup([item.url]); }
    },
    finished: () => speech.cleanup(paths.splice(0))
  };
  let token = null;
  const active = () => !closed && socketOwner === owner && auth.current() && auth.current().userId === session.userId;
  if (!room.isHost && !tourAudio.activeForRoom(room.roomId)) {
    if (audio.snapshot().owner) yielded = true;
    else token = audio.beginStream('translation-room', playbackHooks);
  }
  function claimAudio() {
    if (!active() || room.isHost || paused || guestCapture || tourAudio.activeForRoom(room.roomId)) return;
    const current = audio.snapshot();
    if (current.owner === 'translation-room' && current.generation === token) return;
    if (!yielded && current.owner) return;
    if (current.owner && !['tour', 'translation-room'].includes(current.owner)) { paused = true; if (hooks.interrupted) hooks.interrupted(); return; }
    yielded = false; token = audio.beginStream('translation-room', playbackHooks); publishPlayback();
  }
  const send = (data, binary = false) => new Promise((resolve, reject) => {
    if (!active() || !opened) { reject(Error('讲解连接已断开')); return; }
    my.sendSocketMessage({ data: binary ? base64(data) : JSON.stringify(data), isBuffer: binary, success: resolve, fail: () => reject(Error('讲解上传失败，请重新连接')) });
  });
  function flushAudio() {
    if (tourAudio.activeForRoom(room.roomId)) { hex = ''; return; }
    if (!hex) return;
    const sentence = { hex, format }, index = fileIndex++; hex = '';
    pendingWrites++; publishPlayback();
    writes = writes.then(async () => {
      if (!active() || guestCapture || awaitSegment) return;
      if (audio.snapshot().owner !== 'translation-room') { paused = true; if (hooks.interrupted) hooks.interrupted(); return; }
      const playbackToken = token;
      const files = await speech.audioFiles([sentence], 'room-' + Date.now() + '-' + index);
      if (!active() || token !== playbackToken || audio.snapshot().generation !== playbackToken) { speech.cleanup(files); return; }
      paths.push(files[0]);
      if (paths.length > 240) throw Error('收听积压过多，请退出后重新接入');
      audio.appendStream(token, { id: String(index), url: files[0], kind: 'answer' });
      if (paused) audio.pause();
    }).catch(error => { if (active()) { hooks.error(error); close(true); hooks.disconnected(); } })
      .finally(() => { pendingWrites--; publishPlayback(); });
  }
  function onMessage(message) {
    if (!active()) return;
    try {
      const event = JSON.parse(message.data);
      if (!cursor.accept(event)) return;
      const payload = event.payload || {};
      if (event.type === 'pong') lastPong = Date.now();
      if (event.type === 'subscription.ready' || event.type === 'room.snapshot') clearTimeout(readyTimer);
      if (event.type === 'input.paused' && pauseAck) { pauseAck.resolve(); pauseAck = null; }
      if (event.type === 'audio.started') { hex = ''; receivingAudio = !tourAudio.activeForRoom(room.roomId); format = payload.format || 'mp3'; if (!guestCapture) awaitSegment = false; publishPlayback(); claimAudio(); }
      if (event.type === 'audio.delta' && !room.isHost && !guestCapture && !awaitSegment && !tourAudio.activeForRoom(room.roomId)) {
        if (payload.encoding && payload.encoding !== 'hex' || payload.audio && !/^(?:[0-9a-fA-F]{2})*$/.test(payload.audio)) throw Error('语音格式无效');
        hex += payload.audio || ''; format = payload.format || format;
        if (hex.length > 16 * 1024 * 1024) throw Error('语音积压过多，请重新收听');
        if (payload.isFinal) { receivingAudio = false; flushAudio(); }
      }
      if (event.type === 'audio.done') { receivingAudio = false; flushAudio(); }
      if (event.type === 'audio.error' || event.type === 'language.error') { receivingAudio = false; hex = ''; }
      hooks.event(event);
      const currentRoom = event.type === 'room.snapshot' ? payload : payload.room;
      if (event.type === 'room.started' || ['subscription.ready', 'room.snapshot'].includes(event.type) && currentRoom && currentRoom.status === 'live') claimAudio();
      publishPlayback();
      if (event.type === 'segment.error' && payload.code === 'asr_capacity_exceeded' && room.isHost) {
        close(false);
        hooks.disconnected();
      }
      if (event.type === 'room.closed') {
        if (payload.mode === 'immediate') close(true);
        else writes.then(() => { if (token !== null) audio.finishStream(token); close(false); });
      }
    } catch (error) { hooks.error(error); }
  }
  function onOpen() {
    if (!active()) return;
    opened = true;
    lastPong = Date.now();
    heartbeat = setInterval(() => { if (!room.isHost && Date.now() - lastPong > 45000) onError(); else send({ type: 'ping' }).catch(onError); }, 15000);
    if (hooks.open) hooks.open();
  }
  function onClose() { if (active()) { close(false); hooks.disconnected(); } }
  function onError() { if (active()) { hooks.error(Error('讲解连接失败，请检查网络')); onClose(); } }
  my.onSocketOpen(onOpen); my.onSocketMessage(onMessage); my.onSocketClose(onClose); my.onSocketError(onError);
  readyTimer = setTimeout(onError, 15000);
  if (readyTimer && readyTimer.unref) readyTimer.unref();
  try { my.connectSocket({ url: config.apiBase.replace(/^http/, 'ws') + '/TranslationRooms/' + encodeURIComponent(room.roomId) + '/events', protocols: ['translation', 'bearer.' + session.accessToken], fail: onError }); }
  catch (error) { close(true); throw error; }

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
    if (pauseAck) { pauseAck.reject(Error('讲解连接已断开')); pauseAck = null; }
    if (closed) {
      if (stopAudio && token !== null && audio.snapshot().generation === token) {
        audio.stop('translation-room');
        writes.finally(() => speech.cleanup(paths.splice(0)));
      }
      return;
    }
    closed = true;
    receivingAudio = false; hex = '';
    clearInterval(heartbeat); clearTimeout(readyTimer);
    if (recorder) { recording = false; recorder.stop(); }
    if (stopAudio && token !== null && audio.snapshot().generation === token) audio.stop('translation-room');
    if (stopAudio && hooks.playback) hooks.playback({ playing: false, pending: false });
    if (!stopAudio && token !== null) audio.finishStream(token);
    if (stopAudio) writes.finally(() => speech.cleanup(paths.splice(0)));
    ['Open', 'Message', 'Close', 'Error'].forEach((name, index) => { if (my['offSocket' + name]) my['offSocket' + name]([onOpen, onMessage, onClose, onError][index]); });
    my.closeSocket({}); socketOwner = null;
  }
  return {
    close, startRecording,
    refresh() {
      if (!active() || room.isHost) return;
      if (Date.now() - lastPong > 45000) onError();
      else if (opened) send({ type: 'ping' }).catch(onError);
    },
    yieldToTour() {
      if (room.isHost || paused || guestCapture || receivingAudio || hex || pendingWrites) return;
      const current = audio.snapshot();
      if (current.owner === 'translation-room' && (current.item || current.playing)) return;
      yielded = true;
      if (current.owner === 'translation-room') audio.stop('translation-room');
      speech.cleanup(paths.splice(0)); publishPlayback();
    },
    async pauseInput() {
      if (!recorder) return;
      let timer;
      const acknowledged = new Promise((resolve, reject) => { pauseAck = { resolve, reject }; timer = setTimeout(() => { pauseAck = null; reject(Error('暂停讲解超时')); }, 45000); });
      acknowledged.catch(() => {});
      try { await stopRecording(); await send({ type: 'input.pause' }); await acknowledged; }
      finally { clearTimeout(timer); pauseAck = null; stopping = null; }
    },
    muteForQuestion(value) {
      guestCapture = value; awaitSegment = true; hex = '';
      if (tourAudio.activeForRoom(room.roomId)) {
        if (value) { audio.pause(); tourAudio.control('hold').catch(error => { if (hooks.error) hooks.error(error); }); }
        else tourAudio.release().catch(error => { if (hooks.error) hooks.error(error); });
      }
      if (value) { audio.stop('translation-room'); speech.cleanup(paths.splice(0)); }
      else if (active() && !room.isHost && !audio.snapshot().owner && !tourAudio.activeForRoom(room.roomId)) { token = audio.beginStream('translation-room', playbackHooks); if (paused) audio.pause(); }
    },
    pause(value) {
      paused = value;
      if (tourAudio.activeForRoom(room.roomId)) { tourAudio.control('room-mute', { roomMuted: value }).catch(error => { if (hooks.error) hooks.error(error); }); publishPlayback(); return; }
      if (value) { if (audio.snapshot().owner === 'translation-room') audio.pause(); }
      else if (audio.snapshot().owner !== 'translation-room') { hex = ''; yielded = false; speech.cleanup(paths.splice(0)); token = audio.beginStream('translation-room', playbackHooks); }
      else audio.resume('translation-room');
      publishPlayback();
    },
    async end(immediate) {
      if (!immediate && recorder) { await stopRecording(); await send({ type: 'input.end' }); }
      else { if (immediate) close(true); await api('/' + room.roomId + '/' + (immediate ? 'close' : 'end'), {}); }
    }
  };
}
module.exports = { api, connect };
