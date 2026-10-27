const auth = require('./auth');
const rooms = require('./translation-room');
const { RoomTextFeed } = require('../shared/translation-room');
const { localizeRoomNotice, roomLocale, roomMessages } = require('../shared/translation-room-messages');
const listeners = new Set();
const feed = new RoomTextFeed();
const empty = (language = 'zh-CN') => ({ language, room: null, source: '', translated: '', feed: [], speaking: false, paused: false, audioPlaying: false, audioReceived: false, audioError: '', disconnected: false, notice: '', error: '' });
let state = empty(), connection = null, userId = '', userVersion = 0, version = 0;
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
function setLanguage(language) { update({ language: roomLocale(language) }); }
function prepareEntry(language) { if (!state.room) setLanguage(language); }
function disconnect() {
  version++;
  const previous = connection; connection = null;
  if (previous) previous.close(true);
  if (state.room) update({ disconnected: true, speaking: false });
}
function reset(preserveLanguage = false) { disconnect(); feed.clear(); userId = ''; state = empty(preserveLanguage ? state.language : 'zh-CN'); update({}); }
auth.subscribe(session => { if (userId && (!session || session.userId !== userId || userVersion !== auth.version())) reset(true); });
function event(message) {
  const payload = message.payload || {}, values = { feed: feed.accept(message) };
  if (message.type === 'subscription.ready' || message.type === 'subscription.changed') {
    values.room = payload.room; values.notice = '已加入，等待下一段讲解';
    if (payload.room && !payload.room.isHost && message.targetLanguage) values.language = roomLocale(message.targetLanguage);
  }
  if (message.type === 'room.snapshot' || message.type === 'room.members.changed') values.room = payload;
  if (message.type === 'transcript.final') values.source = payload.text || '';
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
  if (message.type === 'room.paused') values.notice = '车夫暂时离线，讲解暂停';
  if (message.type === 'room.started') values.notice = '讲解中';
  if (message.type === 'room.draining') values.notice = '讲解即将结束，正在接收剩余语音';
  if (message.type === 'room.closed') { values.room = Object.assign({}, state.room, { status: 'closed' }); values.speaking = false; values.notice = payload.mode === 'immediate' ? '房间已关闭' : '讲解已结束，剩余语音将继续播放'; }
  update(values);
}
function attach(room, language) {
  disconnect();
  const session = auth.current();
  if (!session) throw Error('请先登录');
  const selectedLanguage = roomLocale(language || (room.isHost ? room.sourceLanguage : '') || state.language);
  if (!state.room || state.room.roomId !== room.roomId) { feed.clear(); state = empty(selectedLanguage); }
  userId = session.userId;
  userVersion = auth.version();
  const current = version;
  update({ room, language: selectedLanguage, speaking: false, paused: false, disconnected: false, error: '', notice: room.isHost ? '房间已创建，可返回导航；开始讲解后保持麦克风开启' : '正在连接…' });
  try {
    connection = rooms.connect(room, {
      event: message => { if (current === version) event(message); },
      error: error => { if (current === version) update({ error: error.message }); },
      playback: value => { if (current === version && state.audioPlaying !== value.playing) update({ audioPlaying: value.playing }); },
      playbackError: error => { if (current === version) update({ audioPlaying: false, audioError: '译音播放失败：' + error.message }); },
      interrupted: () => { if (current === version) update({ paused: true, notice: '其他内容正在播放，回到房间可恢复收听' }); },
      disconnected: () => { if (current === version) { connection = null; update({ disconnected: true, speaking: false, notice: '连接已断开，请重新收听或返回讲解房间' }); } },
    });
  } catch (error) { update({ disconnected: true }); throw error; }
}
async function startSpeaking() {
  if (!connection || !state.room || !state.room.isHost) throw Error('请先返回讲解房间');
  const current = version;
  await connection.startRecording();
  if (current === version) update({ speaking: true, notice: '正在讲解，可返回导航继续游览' });
}
function togglePause() {
  if (!connection || !state.room || state.room.isHost) return;
  const paused = state.audioError ? false : !state.paused;
  connection.pause(paused); update({ paused, audioError: '' });
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
  disconnect(); feed.clear();
  update({ feed: [], translated: '', notice: '当前语音已停止，请选择语言并重新收听' });
  if (state.room && !state.room.isHost) await rooms.api('/' + state.room.roomId + '/leave', {}).catch(() => {});
}
async function leave() {
  const previous = state.room;
  reset(true);
  if (previous && !previous.isHost) await rooms.api('/' + previous.roomId + '/leave', {}).catch(() => {});
}
function suspend() { if (state.room) { disconnect(); update({ notice: '讲解已暂停，请返回房间重新连接' }); } }
module.exports = { snapshot, subscribe, attach, event, prepareEntry, setLanguage, disconnect, startSpeaking, togglePause, end, changeLanguage, leave, suspend };
