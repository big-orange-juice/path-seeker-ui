const auth = require('./auth');
const http = require('./http');
const audio = require('./audio');
const config = require('../config');
const { diag } = require('./diag');
const { createCommandQueue } = require('./audio-command-queue');
const { audibleAt } = require('./tour-audio-timeline');
let session = null, pending = null, creation = null, generation = 0, foreground = true, timer = null, request = null;
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
function snapshot() { const owner = session || pending, state = session && session.state || null, playback = audio.snapshot(); return { active: active(), creating: !!pending, sessionId: session && session.id || '', roomId: owner && owner.options.roomId || '', state,
  context: owner ? { visitId: owner.options.visitId, routeId: owner.options.routeId, guideId: owner.options.guideId, language: owner.options.language } : null,
  audible: audibleAt(state, playback, !!session && !session.reconnecting && state.streamId !== session.previousStreamId),
  recovering: !!(session && session.recovering), lagSeconds: state && playback.live ? Math.max(0, state.mediaTimeSeconds - playback.time) : 0,
  pausedIntent: !!(owner && owner.pausedIntent), heldIntent: !!(owner && owner.heldIntent), stalled: !!(session && session.stalled), error: playbackFailure || owner && owner.controlFailure && owner.controlFailure.message || failure }; }
function diagnostics() {
  const value = snapshot(), state = value.state, playback = audio.snapshot();
  return { version: 'tour-audio-follow-lifecycle-20261112', capturedAt: new Date().toISOString(),
    active: value.active, creating: value.creating, foreground, sessionId: value.sessionId, roomId: value.roomId,
    stalled: value.stalled, hasPlaybackError: !!playbackFailure,
    lagSeconds: value.lagSeconds, audible: value.audible, recovering: value.recovering,
    recoveryAttempts: session && session.recoveryAttempts || 0,
    lifecycle: session && session.lifecycle ? session.lifecycle.slice() : [],
    nativeError: playback.lastError ? { code: playback.lastError.code, at: playback.lastError.at, message: String(playback.lastError.message).replace(/https?:\/\/[^\s]+/g, '[media-url]').replace(/(?:Authorization:\s*)?Bearer\s+\S+/gi, '[credential]').slice(0, 240) } : null,
    server: state ? { status: state.status, streamId: state.streamId, stageId: state.stageId, itemId: state.itemId,
      paused: state.paused, held: state.held, roomAudioPlaying: state.roomAudioPlaying,
      sentBytes: state.sentBytes, mediaTimeSeconds: state.mediaTimeSeconds, driverSampledAt: state.driverSampledAt,
      itemTimeSeconds: state.itemTimeSeconds, itemDurationSeconds: state.itemDurationSeconds, hasError: !!state.error,
      schedulerStatus: state.schedulerStatus || '', arrival: state.arrival || null, stageTimings: state.stageTimings || [],
      transport: state.transport || null,
      completedStageIds: state.visit && state.visit.completedStageIds || [],
      queue: (state.queue || []).slice(-12).map(item => ({ stageId: item.stageId, status: item.status })) } : null,
    player: { owner: playback.owner, live: playback.live, playing: playback.playing, requested: playback.requested,
      failed: playback.failed, nativePaused: playback.nativePaused, nativeControl: playback.nativeControl, time: playback.time, duration: playback.duration } };
}
function recordLifecycle(owner, event) {
  const playback = audio.snapshot(), state = owner.state;
  if (!owner.lifecycle) owner.lifecycle = [];
  owner.lifecycle.push({ event, at: new Date().toISOString(), streamId: state && state.streamId || '',
    lastKnownServerStatus: state && state.status || '', lastKnownServerMediaSeconds: state && state.mediaTimeSeconds || 0,
    playerTime: playback.time, playing: playback.playing, failed: playback.failed, nativePaused: playback.nativePaused,
    pausedIntent: !!owner.pausedIntent, heldIntent: !!owner.heldIntent });
  if (owner.lifecycle.length > 12) owner.lifecycle.shift();
}
function publish() { const value = snapshot(); listeners.forEach(listener => listener(value)); }
function subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); }
function owns(owner) { return session === owner && owner.generation === generation && owner.userId === currentUser() && owner.authVersion === auth.version(); }
function current(owner) { return (session || pending) === owner && owner.generation === generation && owner.userId === currentUser() && owner.authVersion === auth.version(); }
function captureIntent() {
  const owner = session || pending, intent = owner && owner.intent;
  return () => !!owner && current(owner) && owner.intent === intent;
}
function revoke(owner) { return api(owner, path(owner.id), { method: 'DELETE' }).catch(() => {}); }
function invalidSession(owner, error) {
  if (!owns(owner) || !(error.status === 404 || error.code === 10004)) return false;
  stop('讲解连接已失效，请点击重试重新连接');
  return true;
}
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
  audio.updateLive({ title: snapshot().audible && snapshot().audible.title || '寻迹 · 城市漫游' });
  if (['closed', 'ended', 'expired'].includes(value.status)) { publish(); if (owns(owner)) stop(value.error || ''); return false; }
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
  owner.previousStreamId = owner.playbackGeneration === undefined ? '' : owner.state.streamId;
  owner.stalled = false; owner.progressAt = Date.now(); owner.mediaTime = 0;
  owner.connectionVersion = (owner.connectionVersion || 0) + 1;
  lastNativeControl = '';
  audio.playLive('tour', { id: owner.id, url: owner.url + '&connection=' + Date.now() + '-' + owner.connectionVersion, title: owner.state && owner.state.itemTitle || '寻迹 · 城市漫游' }, {
    change(value) {
      if (!owns(owner)) return;
      if (value.playing && !value.failed && value.time > 0 && !owner.stalled) playbackFailure = '';
      checkProgress(owner);
      const audible = snapshot().audible;
      if (audible && audible.title) audio.updateLive({ title: audible.title });
      if (value.nativeControl && value.nativeControl !== lastNativeControl) {
        lastNativeControl = value.nativeControl;
        (value.nativeControl === 'pause' ? control('pause') : setPaused(false)).catch(() => {});
      } else if (!value.nativeControl) lastNativeControl = '';
      publish();
    },
    error(error) { if (owns(owner) && (!owner.reconnecting || audio.snapshot().generation !== owner.reconnectingGeneration)) { playbackFailure = error.message; diag('tour-audio-error', diagnostics()); publish(); } },
    interrupted() { if (owns(owner) && !owner.heldIntent) control('hold').catch(() => {}); }
  }, { paused: owner.pausedIntent || owner.heldIntent });
  owner.playbackGeneration = audio.snapshot().generation;
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
  const owner = { generation, userId: account.userId, authVersion: auth.version(), token: account.accessToken, options: Object.assign({}, options), key,
    intent: 0, pausedIntent: !!options.paused, heldIntent: false, controls: createCommandQueue(cancelled) };
  const previousCreation = creation;
  pending = owner; failure = '';
  owner.promise = (async () => {
    try {
      if (previousCreation) await previousCreation.catch(() => {});
      if (pending !== owner || owner.generation !== generation || owner.userId !== currentUser() || owner.authVersion !== auth.version()) throw cancelled();
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
      const obsolete = !current(owner);
      if (session === owner) { stop(); failure = error.message; publish(); }
      if (owner.id && session !== owner) revoke(owner);
      if (pending === owner) { pending = null; failure = error.message; publish(); }
      throw obsolete ? cancelled() : error;
    }
  })();
  creation = owner.promise;
  const settled = () => { if (creation === owner.promise) creation = null; };
  owner.promise.then(settled, settled);
  publish();
  return owner.promise;
}
function recordIntent(owner, command) {
  const previous = owner.pausedIntent + ':' + owner.heldIntent;
  if (command === 'pause') owner.pausedIntent = true;
  if (command === 'resume') owner.pausedIntent = false;
  if (command === 'hold') owner.heldIntent = true;
  if (command === 'release') owner.heldIntent = false;
  const selecting = ['select', 'preview', 'replay', 'realign'].includes(command);
  if (selecting) { owner.pausedIntent = false; owner.heldIntent = false; }
  if (selecting || previous !== owner.pausedIntent + ':' + owner.heldIntent) owner.intent++;
  const playback = audio.snapshot();
  if (['pause', 'hold'].includes(command) && playback.live && playback.item && playback.item.id === owner.id && !(command === 'pause' && playback.nativePaused)) audio.pause();
}
function control(command, values = {}, expectedSessionId = '') {
  const owner = session || pending;
  if (expectedSessionId && (!owner || owner.id !== expectedSessionId)) return Promise.reject(cancelled());
  if (!owner || !current(owner)) return Promise.resolve(null);
  recordIntent(owner, command);
  const intent = owner.intent, playbackGeneration = audio.snapshot().generation;
  const input = Object.assign({}, values, { command, requestId: 'mp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12) });
  const run = async () => {
    if (pending === owner) await owner.promise;
    if (!owns(owner)) throw cancelled();
    if (command === 'ack' && (owner.reconnecting || audio.snapshot().generation !== playbackGeneration || owner.state.streamId !== input.streamId)) throw cancelled();
    let state;
    try { state = await api(owner, path(owner.id) + '/control', { method: 'POST', data: input }); }
    catch (error) { if (invalidSession(owner, error)) throw error; throw owns(owner) ? error : cancelled(); }
    if (!owns(owner)) throw cancelled();
    if (owner.controlFailure && (owner.controlFailure.command === command || !['ack', 'preferences'].includes(command))) owner.controlFailure = null;
    accept(owner, state);
    if (['select', 'preview', 'replay', 'realign', 'seek'].includes(command)) owner.needsReconnect = true;
    if (command === 'preferences') Object.assign(owner.options, values);
    if (!owns(owner) || ['select', 'preview', 'replay', 'realign', 'hold'].includes(command) && owner.intent !== intent) throw cancelled();
    return owner.state;
  };
  const result = owner.controls.enqueue(run);
  result.catch(error => { if (current(owner) && !error.cancelled) { owner.controlFailure = { command, message: error.message }; publish(); } });
  return result;
}
async function refresh() {
  const owner = session;
  if (!owner || !owns(owner) || request) { schedule(); return null; }
  const pendingRequest = request = api(owner, path(owner.id));
  const playbackGeneration = audio.snapshot().generation;
  try {
    const state = await pendingRequest;
    if (!accept(owner, state)) return owns(owner) ? owner.state : null;
    const playback = audio.snapshot(), now = Date.now();
    if (foreground && owner.options.following && !owner.pausedIntent && !owner.heldIntent && !playback.nativePaused && !owner.recovering
      && (playback.failed || owner.stalled || state.status === 'disconnected') && (owner.recoveryAttempts || 0) < 3 && now >= (owner.nextRecoveryAt || 0)) {
      recordLifecycle(owner, 'foreground-recovery');
      owner.recoveryAttempts = (owner.recoveryAttempts || 0) + 1; owner.nextRecoveryAt = now + 10000 * owner.recoveryAttempts;
      owner.recovering = true; publish();
      try { await setPaused(false, owner.id); } finally { owner.recovering = false; if (owns(owner)) publish(); }
      return owner.state;
    }
    if (owns(owner) && foreground && !owner.reconnecting && state.status === 'streaming' && state.streamId !== owner.previousStreamId
      && playback.generation === playbackGeneration && playback.generation === owner.playbackGeneration
      && playback.live && playback.item && playback.item.id === owner.id && !playback.failed && now - lastAckAt >= 2000 && Number.isFinite(playback.time) && playback.time > 0) {
      lastAckAt = now;
      if (validId(state.streamId)) await control('ack', { mediaTimeSeconds: playback.time, streamId: state.streamId });
    }
    return state;
  } catch (error) { if (!invalidSession(owner, error) && owns(owner) && !error.cancelled) { failure = error.message; publish(); } throw error; }
  finally { if (request === pendingRequest) request = null; schedule(); }
}
function setForeground(value) {
  const next = !!value;
  if (session && foreground !== next) recordLifecycle(session, next ? 'foreground-before-refresh' : 'background');
  foreground = next;
  if (session) session.progressAt = Date.now();
  if (foreground) refresh().catch(() => {}); else { clearTimeout(timer); timer = null; }
}
async function setPaused(value, expectedSessionId = '') {
  const owner = session || pending;
  if (expectedSessionId && (!owner || owner.id !== expectedSessionId)) throw cancelled();
  if (!owner || !current(owner)) return;
  const wasPaused = !!(owner.state && owner.state.paused) || !audio.snapshot().playing;
  if (!value && (owner.heldIntent || owner.state && owner.state.held)) {
    const released = control('release'), releaseIntent = owner.intent;
    await released;
    if (!owns(owner) || owner.intent !== releaseIntent) return;
  }
  if (!current(owner)) return;
  const controlled = control(value ? 'pause' : 'resume'), intent = owner.intent;
  const state = await controlled;
  if (!value && owns(owner) && owner.intent === intent && !owner.pausedIntent && !owner.heldIntent) {
    const playback = audio.snapshot();
    if (!wasPaused && !owner.needsReconnect && !owner.stalled && playback.live && playback.item && playback.item.id === owner.id && !playback.failed && state.status !== 'disconnected') audio.resume('tour');
    else await reconnect(owner);
  }
  return state;
}
async function release(expectedSessionId = '') {
  const owner = session || pending;
  if (expectedSessionId && (!owner || owner.id !== expectedSessionId)) throw cancelled();
  if (!owner || !current(owner)) return;
  const controlled = control('release'), intent = owner.intent;
  const state = await controlled;
  if (!owns(owner) || owner.intent !== intent || owner.pausedIntent || owner.heldIntent) return;
  const playback = audio.snapshot();
  if (playback.playing && !owner.stalled && playback.live && playback.item && playback.item.id === owner.id && !playback.failed && state.status !== 'disconnected') { if (!playback.nativePaused) audio.resume('tour'); }
  else await reconnect(owner);
}
function reconnect(owner) {
  owner.reconnectIntent = owner.intent;
  if (owner.reconnecting) return owner.reconnecting;
  owner.reconnectingGeneration = audio.snapshot().generation;
  owner.reconnecting = (async () => {
    try { await control('reconnect'); if (owns(owner) && owner.intent === owner.reconnectIntent && !owner.pausedIntent && !owner.heldIntent) { owner.needsReconnect = false; play(owner); } }
    finally { owner.reconnecting = null; }
  })();
  return owner.reconnecting;
}
function stop(error = '') {
  const owner = session;
  if (session) session.controls.close();
  if (pending) pending.controls.close();
  generation++; session = null; pending = null; failure = error; playbackFailure = ''; lastAckAt = 0; lastNativeControl = '';
  clearTimeout(timer); timer = null;
  if (request) request.abort(); request = null;
  const playback = audio.snapshot();
  if (playback.live && owner && playback.item && playback.item.id === owner.id) audio.stop('tour');
  if (owner && playback.owner === 'tour-extra') audio.stop('tour-extra');
  publish();
  return owner ? revoke(owner) : Promise.resolve();
}
auth.subscribe(() => { if (session && !owns(session) || pending && (pending.userId !== currentUser() || pending.authVersion !== auth.version())) stop(); });
module.exports = { supported, active, activeForRoom, snapshot, diagnostics, captureIntent, subscribe, start, control, refresh, setForeground, setPaused, release, stop };
