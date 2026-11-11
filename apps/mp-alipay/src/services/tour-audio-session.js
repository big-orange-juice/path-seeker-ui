const auth = require('./auth');
const http = require('./http');
const audio = require('./audio');
const config = require('../config');
const { diag } = require('./diag');
let session = null, pending = null, generation = 0, foreground = true, timer = null, request = null, controls = Promise.resolve();
let lastNativeControl = '', lastAckAt = 0, failure = '', playbackFailure = '';
const listeners = new Set();
const validId = value => typeof value === 'string' && value.length > 0;
const supported = () => !!(config.serverTourAudio && config.background && config.backgroundAudio && /^https:\/\//i.test(config.apiBase) && typeof my.getBackgroundAudioManager === 'function');
const currentUser = () => auth.current() && auth.current().userId;
const active = () => !!session || !!pending;
const activeForRoom = roomId => !!(session && session.options.roomId === roomId || pending && pending.options.roomId === roomId);
const path = id => '/TourAudioSessions/' + encodeURIComponent(id);
const cancelled = () => Object.assign(Error('讲解会话已变更'), { cancelled: true });
function api(owner, endpoint, options = {}) {
  let activeRequest, aborted = false;
  const result = (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (aborted) throw cancelled();
      if (owner.userId === currentUser() && owner.authVersion === auth.version()) owner.token = auth.current().accessToken;
      activeRequest = http.request(endpoint, Object.assign({}, options, { public: true, headers: { Authorization: 'Bearer ' + owner.token } }));
      try { return await activeRequest; }
      catch (error) {
        if (attempt || !(error.status === 401 || error.code === 10002) || owner.userId !== currentUser() || owner.authVersion !== auth.version()) throw error;
        await auth.refresh();
      }
    }
  })();
  result.abort = () => { aborted = true; if (activeRequest) activeRequest.abort(); };
  return result;
}
function snapshot() { return { active: active(), creating: !!pending, sessionId: session && session.id || '', roomId: session && session.options.roomId || pending && pending.options.roomId || '', state: session && session.state || null, stalled: !!(session && session.stalled), error: playbackFailure || failure }; }
function diagnostics() {
  const value = snapshot(), state = value.state, playback = audio.snapshot();
  return { version: 'tour-audio-recovery-20261111', capturedAt: new Date().toISOString(),
    active: value.active, creating: value.creating, foreground, sessionId: value.sessionId, roomId: value.roomId,
    stalled: value.stalled, hasPlaybackError: !!playbackFailure,
    server: state ? { status: state.status, streamId: state.streamId, stageId: state.stageId, itemId: state.itemId,
      paused: state.paused, held: state.held, roomAudioPlaying: state.roomAudioPlaying,
      sentBytes: state.sentBytes, mediaTimeSeconds: state.mediaTimeSeconds, driverSampledAt: state.driverSampledAt,
      itemTimeSeconds: state.itemTimeSeconds, itemDurationSeconds: state.itemDurationSeconds, hasError: !!state.error,
      queue: (state.queue || []).slice(-12).map(item => ({ stageId: item.stageId, status: item.status })) } : null,
    player: { owner: playback.owner, live: playback.live, playing: playback.playing, requested: playback.requested,
      failed: playback.failed, nativePaused: playback.nativePaused, nativeControl: playback.nativeControl, time: playback.time, duration: playback.duration } };
}
function publish() { const value = snapshot(); listeners.forEach(listener => listener(value)); }
function subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); }
function owns(owner) { return session === owner && owner.generation === generation && owner.userId === currentUser() && owner.authVersion === auth.version(); }
function revoke(owner) { return api(owner, path(owner.id), { method: 'DELETE' }).catch(() => {}); }
function schedule() {
  clearTimeout(timer); timer = null;
  if (!foreground || !session) return;
  timer = setTimeout(() => { timer = null; refresh().catch(() => {}); }, 2000);
  if (timer && timer.unref) timer.unref();
}
function accept(owner, value) {
  if (!owns(owner) || !value || value.sessionId !== owner.id) return false;
  if (owner.state && Number(value.revision) < Number(owner.state.revision)) return false;
  owner.state = value;
  failure = value.error || '';
  checkProgress(owner);
  audio.updateLive({ title: value.itemTitle || '寻迹 · 城市漫游' });
  if (['closed', 'ended', 'expired'].includes(value.status)) { publish(); stop(); return false; }
  publish(); return true;
}
function mediaUrl(value) {
  if (typeof value !== 'string') throw Error('持续讲解地址无效');
  const result = /^https:\/\//i.test(value) ? value : value.startsWith('/TourAudioSessions/') ? config.apiBase.replace(/\/$/, '') + value : '';
  if (!/^https:\/\//i.test(result)) throw Error('持续讲解需要 HTTPS 音频地址');
  return result;
}
function play(owner) {
  if (!owns(owner)) return;
  const previous = audio.snapshot();
  if (previous.live && previous.item && previous.item.id === owner.id) audio.stop('tour');
  playbackFailure = '';
  owner.stalled = false; owner.progressAt = Date.now(); owner.mediaTime = 0;
  lastNativeControl = '';
  audio.playLive('tour', { id: owner.id, url: owner.url + '&connection=' + Date.now(), title: owner.state && owner.state.itemTitle || '寻迹 · 城市漫游' }, {
    change(value) {
      if (!owns(owner)) return;
      checkProgress(owner);
      if (value.nativeControl && value.nativeControl !== lastNativeControl) {
        lastNativeControl = value.nativeControl;
        (value.nativeControl === 'pause' ? control('pause') : setPaused(false)).catch(() => {});
      } else if (!value.nativeControl) lastNativeControl = '';
      publish();
    },
    error(error) { if (owns(owner)) { playbackFailure = error.message; diag('tour-audio-error', diagnostics()); publish(); } },
    interrupted() { if (owns(owner)) control('hold').catch(() => {}); }
  }, { paused: !!(owner.state && (owner.state.paused || owner.state.held)) });
  diag('tour-audio-start', diagnostics());
}
function checkProgress(owner) {
  const playback = audio.snapshot(), now = Date.now();
  if (!foreground || owner.reconnecting || !playback.live || !playback.item || playback.item.id !== owner.id
    || !playback.requested || playback.failed || owner.state.paused || owner.state.held) { owner.progressAt = now; return; }
  if (Number.isFinite(playback.time) && playback.time > owner.mediaTime) {
    owner.mediaTime = playback.time; owner.progressAt = now;
    if (owner.stalled) { owner.stalled = false; playbackFailure = ''; }
  } else if (now - owner.progressAt >= 20000 && !owner.stalled) {
    owner.stalled = true;
    playbackFailure = '音频连接未开始播放或已卡住，请点击重试；仍无声时请复制诊断记录';
    diag('tour-audio-stalled', diagnostics());
  }
}
async function start(options) {
  if (!supported()) throw Error('当前支付宝版本不支持后台持续讲解，请更新客户端');
  if (!['roomId', 'visitId', 'routeId'].every(key => validId(options[key]))) throw Error('请先加入房间并开始行程');
  const key = [options.roomId, options.visitId, options.routeId, options.guideId || '', options.language].join('|');
  if (session && session.key === key && owns(session)) return session.state;
  if (pending && pending.key === key) return pending.promise;
  stop();
  const account = auth.current();
  if (!account) throw Error('请先登录');
  const owner = { generation, userId: account.userId, authVersion: auth.version(), token: account.accessToken, options: Object.assign({}, options), key };
  pending = owner; failure = ''; publish();
  owner.promise = (async () => {
    try {
      const result = await api(owner, '/TourAudioSessions', { method: 'POST', data: options });
      if (!result || !validId(result.sessionId)) throw Error('持续讲解会话返回无效');
      owner.id = result.sessionId;
      if (pending !== owner || owner.generation !== generation || owner.userId !== currentUser() || owner.authVersion !== auth.version()) throw cancelled();
      owner.url = mediaUrl(result.mediaUrl); owner.state = result.state;
      if (!owner.state || owner.state.sessionId !== owner.id) throw Error('持续讲解状态返回无效');
      pending = null; session = owner;
      play(owner); publish(); schedule();
      return owner.state;
    } catch (error) {
      if (session === owner) { stop(); failure = error.message; publish(); }
      if (owner.id && session !== owner) revoke(owner);
      if (pending === owner) { pending = null; failure = error.message; publish(); }
      throw error;
    }
  })();
  return owner.promise;
}
function control(command, values = {}) {
  const owner = session;
  if (!owner || !owns(owner)) return Promise.resolve(null);
  const input = Object.assign({}, values, { command, requestId: 'mp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12) });
  const run = async () => {
    if (!owns(owner)) throw cancelled();
    const state = await api(owner, path(owner.id) + '/control', { method: 'POST', data: input });
    accept(owner, state); return state;
  };
  const result = controls.catch(() => {}).then(run);
  controls = result;
  result.catch(error => { if (owns(owner) && !error.cancelled) { failure = error.message; publish(); } });
  return result;
}
async function refresh() {
  const owner = session;
  if (!owner || !owns(owner) || request) { schedule(); return null; }
  const pendingRequest = request = api(owner, path(owner.id));
  try {
    const state = await pendingRequest;
    accept(owner, state);
    const playback = audio.snapshot(), now = Date.now();
    if (owns(owner) && foreground && playback.live && playback.item && playback.item.id === owner.id && !playback.failed && now - lastAckAt >= 2000 && Number.isFinite(playback.time) && playback.time > 0) {
      lastAckAt = now;
      if (validId(state.streamId)) await control('ack', { mediaTimeSeconds: playback.time, streamId: state.streamId });
    }
    return state;
  } catch (error) { if (owns(owner) && !error.cancelled) { failure = error.message; publish(); } throw error; }
  finally { if (request === pendingRequest) request = null; schedule(); }
}
function setForeground(value) { foreground = !!value; if (session) session.progressAt = Date.now(); if (foreground) refresh().catch(() => {}); else { clearTimeout(timer); timer = null; } }
async function setPaused(value) {
  if (!session) return;
  if (value) audio.pause();
  const owner = session;
  const wasPaused = !!(owner.state && owner.state.paused) || !audio.snapshot().playing;
  if (!value && owner.state && owner.state.held) await control('release');
  if (!owns(owner)) return;
  const state = await control(value ? 'pause' : 'resume');
  if (!value && owns(owner)) {
    const playback = audio.snapshot();
    if (!wasPaused && !owner.stalled && playback.live && playback.item && playback.item.id === owner.id && !playback.failed && state.status !== 'disconnected') audio.resume('tour');
    else await reconnect(owner);
  }
  return state;
}
async function release() {
  const owner = session;
  if (!owner || !owns(owner)) return;
  const state = await control('release');
  if (!owns(owner) || state && state.paused) return;
  const playback = audio.snapshot();
  if (playback.playing && !owner.stalled && playback.live && playback.item && playback.item.id === owner.id && !playback.failed && state.status !== 'disconnected') { if (!playback.nativePaused) audio.resume('tour'); }
  else await reconnect(owner);
}
function reconnect(owner) {
  if (owner.reconnecting) return owner.reconnecting;
  owner.reconnecting = (async () => {
    try { await control('reconnect'); if (owns(owner)) play(owner); }
    finally { owner.reconnecting = null; }
  })();
  return owner.reconnecting;
}
function stop() {
  const owner = session;
  generation++; session = null; pending = null; controls = Promise.resolve(); failure = ''; playbackFailure = ''; lastAckAt = 0; lastNativeControl = '';
  clearTimeout(timer); timer = null;
  if (request) request.abort(); request = null;
  const playback = audio.snapshot();
  if (playback.live && owner && playback.item && playback.item.id === owner.id) audio.stop('tour');
  if (owner && playback.owner === 'tour-extra') audio.stop('tour-extra');
  publish();
  return owner ? revoke(owner) : Promise.resolve();
}
auth.subscribe(() => { if (session && !owns(session) || pending && (pending.userId !== currentUser() || pending.authVersion !== auth.version())) stop(); });
module.exports = { supported, active, activeForRoom, snapshot, diagnostics, subscribe, start, control, refresh, setForeground, setPaused, release, stop };
