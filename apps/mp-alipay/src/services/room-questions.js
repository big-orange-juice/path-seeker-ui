const auth = require('./auth');
const http = require('./http');
const speech = require('./speech');
const audio = require('./audio');
const { RoomQuestionFeed, questionMessages } = require('../shared/translation-room-questions');

// 音频留在会话内；页面 setData 只接收字幕和状态，避免大段 hex 跨越原生渲染桥。
function createQuestions(options) {
  const feed = new RoomQuestionFeed();
  let version = 0, recorder = null, request = null, recording = false, uploading = false;
  let enabledAudio = false, activeId = '', files = [], preparing = false, playbackVersion = 0;
  let expiryTimer = null;
  let mutedForQuestion = false;
  function restoreListening() {
    if (!mutedForQuestion) return;
    mutedForQuestion = false;
    if (options.connection()) options.connection().muteForQuestion(false);
  }
  const labels = () => questionMessages(options.state().language);
  const sync = values => options.update(Object.assign({ questions: feed.items.slice() }, values));
  function stopPlayback() {
    playbackVersion++;
    enabledAudio = false;
    const id = activeId; activeId = ''; preparing = false;
    audio.stop('translation-question');
    speech.cleanup(files.splice(0));
    if (id) feed.mark(id, 'ready');
    sync({ questionPlaying: false });
  }
  async function drain() {
    feed.expire(); sync();
    const state = options.state();
    if (!enabledAudio || activeId || preparing || state.speaking || state.disconnected || !state.room || !state.room.isHost) return;
    const next = feed.items.find(item => item.status === 'ready' && feed.playable(item.id));
    if (!next) return;
    const current = version, playback = playbackVersion;
    const id = next.id;
    preparing = true; activeId = id;
    try {
      const paths = await speech.audioFiles(feed.playable(id), 'question-' + id);
      if (current !== version || playback !== playbackVersion || activeId !== id || !enabledAudio || options.state().speaking) { speech.cleanup(paths); return; }
      files.push.apply(files, paths);
      preparing = false; feed.mark(id, 'playing'); sync({ questionPlaying: true });
      audio.playQueue('translation-question', paths.map((url, index) => ({ id: id + '-' + index, url, kind: 'answer' })), {
        interrupted() { if (current === version && playback === playbackVersion && activeId === id) stopPlayback(); },
        finished() {
          if (current !== version || activeId !== id) return;
          speech.cleanup(files.splice(0)); activeId = ''; feed.mark(id, 'played'); sync({ questionPlaying: false });
          drain().catch(() => { stopPlayback(); sync({ questionError: labels().textOnly }); });
        },
        error() { if (current === version) { stopPlayback(); sync({ questionError: labels().textOnly }); } }
      });
    } catch (_) { if (current === version) { stopPlayback(); sync({ questionError: labels().textOnly }); } }
  }
  function event(message) {
    if (!feed.accept(message)) return false;
    if (!expiryTimer) expiryTimer = setInterval(() => { feed.expire(); sync(); }, 10000);
    sync();
    drain().catch(() => { stopPlayback(); sync({ questionError: labels().textOnly }); });
    return true;
  }
  async function listen() {
    const state = options.state(), current = version;
    if (!state.room || !state.room.isHost || state.disconnected || !options.connection()) return;
    sync({ questionError: '' });
    await options.connection().pauseInput();
    if (current !== version) return;
    options.update({ speaking: false });
    enabledAudio = true;
    await drain();
  }
  function start() {
    const state = options.state();
    if (!state.room || state.room.isHost || !state.room.guestSpeechEnabled || state.disconnected || ['closed', 'draining'].includes(state.room.status) || recorder || uploading) return;
    const current = version, roomId = state.room.roomId;
    const userVersion = auth.version();
    sync({ questionError: '' });
    try {
      recorder = speech.recorder((active, processing) => { recording = active; uploading = processing; if (!active) restoreListening(); sync({ questionRecording: active, questionUploading: processing }); }, () => {}, error => {
        if (current === version) { finishRecording(); sync({ questionError: labels().microphone }); }
      }, { duration: 30000, async submit(filePath, active) {
        try {
          const file = await new Promise((resolve, reject) => my.getFileSystemManager().readFile({ filePath, success: resolve, fail: reject }));
          if (!active() || current !== version || userVersion !== auth.version()) return;
          const boundary = 'RoomQuestion' + Date.now();
          const base = new Uint8Array(speech.multipartWav(file.data, boundary));
          const id = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
          const field = '--' + boundary + '\r\nContent-Disposition: form-data; name="requestId"\r\n\r\n' + id + '\r\n';
          const bytes = new Uint8Array(field.length + base.length);
          bytes.set(Array.from(field).map(char => char.charCodeAt(0))); bytes.set(base, field.length);
          request = http.post('/TranslationRooms/' + encodeURIComponent(roomId) + '/questions', bytes.buffer, { headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary }, timeout: 20000 });
          await request;
        } catch (_) { if (current === version) sync({ questionError: labels().failed }); }
        finally { if (current === version) finishRecording(); }
      } });
      recording = true;
      audio.pause();
      mutedForQuestion = true;
      options.connection().muteForQuestion(true);
      sync({ questionRecording: true });
      recorder.start();
    } catch (_) { finishRecording(); sync({ questionError: labels().microphone }); }
  }
  function finishRecording() {
    if (recorder) recorder.destroy();
    recorder = null; recording = false; uploading = false; request = null;
    restoreListening();
    sync({ questionRecording: false, questionUploading: false });
  }
  function stop(cancel = false) {
    if (!recorder) return;
    recorder.stop(cancel);
    if (cancel) { if (request) request.abort(); finishRecording(); }
  }
  function reset(clear = true) {
    version++;
    clearInterval(expiryTimer); expiryTimer = null;
    stop(true); stopPlayback();
    if (clear) feed.clear(); else feed.discardAudio();
    sync({ questionError: '' });
  }
  return { event, listen, start, stop, reset, stopPlayback };
}
module.exports = { createQuestions };
