const auth = require('./auth');
const rooms = require('./translation-room');
const tourAudio = require('./tour-audio-session');
const recovery = require('./room-recovery');
const { createQuestions } = require('./room-questions');
const { RoomTextFeed } = require('../shared/translation-room');
const { localizeRoomNotice, roomLocale, roomMessages } = require('../shared/translation-room-messages');
const listeners = new Set();
const feed = new RoomTextFeed();
const empty = (language = 'zh-CN') => ({ language, room: null, source: '', translated: '', feed: [], questions: [], questionRecording: false, questionUploading: false, questionPlaying: false, questionError: '', speaking: false, paused: false, audioPlaying: false, audioPending: false, inputDraining: false, translationPending: false, following: true, reconnecting: false, audioReceived: false, audioError: '', disconnected: false, notice: '', error: '' });
let state = empty(), connection = null, userId = '', userVersion = 0, version = 0;
let foreground = true, desired = null, retryTimer = null, retryCount = 0, pendingJoin = null, recoveryEnabled = false;
const pendingTranslations = new Set();
function usesDoubaoTranslation(source, target) {
  const normalize = value => typeof value === 'string' ? /^zh/i.test(value) ? 'zh' : value : '';
  const from = normalize(source), to = normalize(target);
  return !!from && !!to && from !== 'yue' && to !== 'yue' && from !== to
    && (['zh', 'en'].includes(from) || ['zh', 'en'].includes(to));
}
function remember() {
  if (!recoveryEnabled) return;
  const saved = recovery.write(state.room, state.language, state.paused, state.following);
  if (saved) desired = saved;
}
function cancelRecovery() {
  clearTimeout(retryTimer); retryTimer = null;
  const previous = pendingJoin; pendingJoin = null;
  if (previous && previous.abort) previous.abort();
}
function forget() { recoveryEnabled = false; desired = null; retryCount = 0; cancelRecovery(); recovery.remove(userId || (auth.current() || {}).userId); }
function scheduleRecovery() {
  if (!foreground || !desired || retryTimer || pendingJoin) return;
  const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(retryCount++, 5)));
  retryTimer = setTimeout(() => { retryTimer = null; resume(false); }, delay);
  if (retryTimer && retryTimer.unref) retryTimer.unref();
}
async function resume(immediate = true) {
  foreground = true;
  if (connection && connection.refresh) connection.refresh();
  if (connection || pendingJoin) return;
  if (!desired) desired = recovery.read();
  const session = auth.current(), saved = desired;
  if (!saved || !session || saved.userId !== session.userId) return;
  recoveryEnabled = true;
  clearTimeout(retryTimer); retryTimer = null;
  if (immediate) retryCount = 0;
  if (saved.expiresAt && !(Date.parse(saved.expiresAt) > Date.now())) {
    forget(); update({ reconnecting: false, disconnected: true, notice: '房间已结束，请重新加入' }); return;
  }
  userId = session.userId; userVersion = auth.version();
  const current = version, accountVersion = userVersion;
  update({ reconnecting: true, disconnected: true, following: saved.following, notice: '正在恢复讲解连接…' });
  const request = rooms.api('/join', { code: saved.code, targetLanguage: saved.language });
  pendingJoin = request;
  try {
    const room = await request;
    if (pendingJoin !== request || current !== version || accountVersion !== auth.version() || !foreground || !desired || desired.roomId !== saved.roomId) return;
    pendingJoin = null;
    if (!room || room.roomId !== saved.roomId || room.isHost || ['closed', 'draining'].includes(room.status)) {
      forget(); update({ reconnecting: false, disconnected: true, notice: '原讲解房间已结束，请重新加入' }); return;
    }
    attach(room, desired.language, desired);
  } catch (error) {
    if (pendingJoin !== request || current !== version || accountVersion !== auth.version() || error.cancelled) return;
    pendingJoin = null;
    if ([400, 401, 403, 404].includes(error.status)) {
      forget(); update({ reconnecting: false, disconnected: true, error: error.message });
    } else {
      update({ reconnecting: true, disconnected: true, notice: '连接中断，正在重连；这段时间的讲话不会补传' }); scheduleRecovery();
    }
  }
}
function snapshot() {
  const messages = roomMessages(state.language);
  const audioNotice = state.audioError ? localizeRoomNotice(state.audioError, state.language, 'unavailableAudio') : state.paused ? messages.muted : state.audioPlaying ? messages.playing : state.audioReceived ? messages.received : messages.waitingAudio;
  return Object.assign({}, state, { messages, audioNotice, displayNotice: localizeRoomNotice(state.notice, state.language), displayError: localizeRoomNotice(state.error, state.language) });
}
function update(values) {
  const keys = Object.keys(values);
  if (keys.length && keys.every(key => state[key] === values[key])) return;
  state = Object.assign({}, state, values);
  listeners.forEach(listener => listener(snapshot()));
}
function subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); }
const questions = createQuestions({ state: () => state, update, connection: () => connection });
function setLanguage(language) { update({ language: roomLocale(language) }); }
function prepareEntry(language) { if (!state.room) setLanguage(language); }
function disconnect(preserveRecovery = false) {
  if (!preserveRecovery) forget();
  cancelRecovery();
  version++;
  questions.reset(false);
  const previous = connection; connection = null;
  if (previous) previous.close(true);
  pendingTranslations.clear();
  if (state.room) update({ disconnected: true, reconnecting: !!desired, speaking: false, audioPlaying: false, audioPending: false, inputDraining: false, translationPending: false });
}
function reset(preserveLanguage = false) { disconnect(); questions.reset(); feed.clear(); userId = ''; state = empty(preserveLanguage ? state.language : 'zh-CN'); update({}); }
auth.subscribe(session => { if (userId && (!session || session.userId !== userId || userVersion !== auth.version())) reset(true); });
function event(message) {
  if (message.roomId && state.room && message.roomId !== state.room.roomId) return;
  if (questions.event(message)) return;
  const payload = message.payload || {}, values = { feed: feed.accept(message) };
  if (message.type === 'subscription.ready' || message.type === 'subscription.changed') {
    values.room = payload.room; values.notice = '已加入，等待下一段讲解'; values.disconnected = false; values.reconnecting = false;
    values.inputDraining = !!(payload.room && payload.room.inputDraining);
    retryCount = 0;
    if (payload.room && !payload.room.isHost && message.targetLanguage) values.language = roomLocale(message.targetLanguage);
  }
  if (message.type === 'room.snapshot' || message.type === 'room.members.changed') { values.room = payload; values.inputDraining = !!payload.inputDraining; }
  const segment = (message.epochId || '') + ':' + (message.sequence || 0);
  if (message.type === 'transcript.final') {
    values.source = payload.text || '';
    // 仅豆包支持的翻译方向使用独立译文序号；同语种、粤语等回退任务仍从原文开始等待。
    if (payload.provider !== 'doubao' || !usesDoubaoTranslation(state.room && state.room.sourceLanguage, state.language)) pendingTranslations.add(segment);
  }
  if (message.type === 'translation.committed') pendingTranslations.add(segment);
  if (message.type === 'translation.final' || message.type === 'language.error') pendingTranslations.delete(segment);
  values.translationPending = pendingTranslations.size > 0;
  if (message.type === 'translation.committed') { values.translated = ''; values.audioReceived = false; }
  if (message.type === 'text.delta') values.translated = state.translated + (payload.content || '');
  if (message.type === 'translation.final') {
    values.translated = payload.text || '';
    if (state.room && !state.room.isHost && values.translated.trim() && !state.audioReceived && !state.audioError) values.audioError = '本段只收到译文，未收到语音，请等待下一段讲解';
  }
  if (message.type === 'audio.started') values.audioError = '';
  if (message.type === 'audio.delta' && payload.audio) { values.audioReceived = true; values.audioError = ''; }
  if (message.type === 'language.error' || message.type === 'audio.error' || message.type === 'segment.error') values.error = payload.message || '本段语音不可用，请阅读字幕';
  if (message.type === 'audio.error' || message.type === 'language.error') values.audioError = values.error;
  if (message.type === 'room.paused') { values.inputDraining = true; values.notice = payload.reason === 'host_paused' ? '等待讲解' : '车夫暂时离线，讲解暂停'; values.room = Object.assign({}, state.room, { status: 'paused' }); }
  if (message.type === 'room.input.drained' && (!message.epochId || !state.room || !state.room.epochId || message.epochId === state.room.epochId)) values.inputDraining = false;
  if (message.type === 'room.started') { values.inputDraining = false; values.notice = '讲解中'; values.room = Object.assign({}, state.room, { status: 'live', epochId: message.epochId || (state.room || {}).epochId }); }
  if (message.type === 'room.draining') { questions.reset(false); values.room = Object.assign({}, state.room, { status: 'draining' }); values.notice = '讲解即将结束，正在接收剩余语音'; }
  if (message.type === 'room.closed') { if (payload.mode === 'immediate') tourAudio.stop(); forget(); questions.reset(false); values.reconnecting = false; values.inputDraining = false; values.translationPending = false; pendingTranslations.clear(); values.room = Object.assign({}, state.room, { status: 'closed' }); values.speaking = false; values.notice = payload.mode === 'immediate' ? '房间已关闭' : '讲解已结束，剩余语音将继续播放'; }
  if (message.type === 'room.draining') forget();
  update(values);
  if (['subscription.ready', 'subscription.changed', 'room.snapshot'].includes(message.type)) remember();
}
function attach(room, language, restored = null) {
  if (tourAudio.active() && (!tourAudio.activeForRoom(room.roomId) || room.isHost)) tourAudio.stop();
  disconnect(true);
  const session = auth.current();
  if (!session) throw Error('请先登录');
  const selectedLanguage = roomLocale(language || (room.isHost ? room.sourceLanguage : '') || state.language);
  if (!state.room || state.room.roomId !== room.roomId) { questions.reset(); feed.clear(); state = empty(selectedLanguage); }
  userId = session.userId;
  userVersion = auth.version();
  foreground = true;
  recoveryEnabled = !room.isHost;
  recovery.remove(userId);
  const current = version;
  desired = null;
  update({ room, language: selectedLanguage, speaking: false, paused: restored ? restored.paused : false, following: restored ? restored.following : true,
    audioPlaying: false, audioPending: false, inputDraining: false, translationPending: false, reconnecting: !!restored, disconnected: !room.isHost, error: '', notice: room.isHost ? '房间已创建，可返回导航；开始讲解后保持麦克风开启' : '正在连接…' });
  remember();
  let disconnectedDuringConnect = false;
  try {
    const next = rooms.connect(room, {
      open: () => { if (current === version && !restored) update({ disconnected: false }); },
      event: message => { if (current === version) event(message); },
      error: error => { if (current === version) update({ error: error.message }); },
      playback: value => { if (current === version) update({ audioPlaying: value.playing, audioPending: value.pending === undefined ? !!value.requested : value.pending }); },
      playbackError: error => { if (current === version) update({ audioPlaying: false, audioError: '译音播放失败：' + error.message }); },
      interrupted: () => { if (current === version) { update({ paused: true, audioPending: false, audioPlaying: false, notice: '其他内容正在播放，回到房间可恢复收听' }); remember(); } },
      disconnected: () => { if (current === version) { disconnectedDuringConnect = true; questions.reset(false); connection = null; pendingTranslations.clear(); update({ disconnected: true, reconnecting: !!desired, speaking: false, inputDraining: false, translationPending: false, notice: '连接中断，正在重连；这段时间的讲话不会补传' }); scheduleRecovery(); } },
    });
    if (current !== version || disconnectedDuringConnect) { next.close(true); return; }
    connection = next;
    if (state.paused) connection.pause(true);
  } catch (error) { update({ disconnected: true, reconnecting: !!desired }); scheduleRecovery(); throw error; }
}
async function startSpeaking() {
  if (!connection || !state.room || !state.room.isHost) throw Error('请先返回讲解房间');
  const current = version;
  questions.stopPlayback();
  await connection.startRecording();
  if (current === version) update({ speaking: true, notice: '正在讲解，可返回导航继续游览' });
}
function togglePause() {
  if (!connection || !state.room || state.room.isHost) return;
  const paused = state.audioError ? false : !state.paused;
  connection.pause(paused); update({ paused, audioError: '' }); remember();
}
async function end(immediate) {
  if (!state.room || !state.room.isHost) return;
  const current = version;
  if (connection) await connection.end(immediate);
  else await rooms.api('/' + state.room.roomId + '/' + (immediate ? 'close' : 'end'), {});
  if (current !== version) return;
  update({ speaking: false });
  if (immediate) update({ room: Object.assign({}, state.room, { status: 'closed' }), disconnected: true, notice: '房间已关闭' });
}
async function changeLanguage() {
  tourAudio.stop();
  disconnect(); feed.clear();
  update({ feed: [], translated: '', notice: '当前语音已停止，请选择语言并重新收听' });
  if (state.room && !state.room.isHost) await rooms.api('/' + state.room.roomId + '/leave', {}).catch(() => {});
}
async function leave() {
  const previous = state.room;
  tourAudio.stop();
  reset(true);
  if (previous && !previous.isHost) await rooms.api('/' + previous.roomId + '/leave', {}).catch(() => {});
}
function suspend({ preserveConnection = false } = {}) {
  foreground = false;
  if (!state.room) return;
  remember();
  cancelRecovery();
  questions.stop(true);
  if (preserveConnection && connection && !state.disconnected && !state.room.isHost) return;
  disconnect(true);
  update({ notice: '讲解已暂停，返回前台将恢复连接' });
}
function setFollowing(value) { if (state.following === !!value) return; update({ following: !!value }); remember(); }
function yieldToTour() { if (connection) connection.yieldToTour(); }
module.exports = { snapshot, subscribe, attach, event, prepareEntry, setLanguage, disconnect, startSpeaking, togglePause, end, changeLanguage, leave, suspend, resume, setFollowing, yieldToTour,
  startQuestion: questions.start, stopQuestion: () => questions.stop(), cancelQuestion: () => questions.stop(true), listenQuestions: questions.listen, stopQuestions: questions.stopPlayback };
