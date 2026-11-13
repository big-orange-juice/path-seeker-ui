const auth = require('../../services/auth');
const postcards = require('../../services/postcards');
const http = require('../../services/http');
const storage = require('../../services/storage');
const visits = require('../../services/visits');
const audio = require('../../services/audio');
const speech = require('../../services/speech');
const location = require('../../services/location');
const { createRouteMatcher } = require('../../core/route-location');
const { progressUpdate } = require('../../core/playback-progress');
const { diag } = require('../../services/diag');
const tour = require('../../core/tour');
const ui = require('../../core/ui');
const config = require('../../config');
const backgroundListening = require('../../services/background-listening');
const interruption = require('../../services/audio-interruption');
const translation = require('../../services/translation-session');
const tourAudio = require('../../services/tour-audio-session');
const { locales } = config;
const { tourMessages } = require('../../shared/tourMessages');
const { formatRoomMessage } = require('../../shared/translation-room-messages');
const { DEFAULT_APPROACH_POLICY, isUsableLocation, metersBetween } = require('../../shared/geo-range');
const arrivalMessages = require('../../core/arrival-messages');
const driverMessages = require('../../core/driver-messages');
const routeLocationKeys = { 'off-route': 'locationRouteEstimate', jump: 'locationRouteEstimate', ambiguous: 'locationRouteAmbiguous' };
const ARRIVAL_GAP_MS = 6000;
const ARRIVAL_MAX_MISSED_FRAMES = 2;
const serverQueueLabels = {
  zh: ['待确认进度', '未能播放'], en: ['Awaiting confirmation', 'Playback failed'],
  ru: ['Ожидает подтверждения', 'Ошибка воспроизведения'], es: ['Pendiente de confirmar', 'Error de reproducción'],
  fr: ['Confirmation en attente', 'Échec de lecture'], ja: ['進捗の確認待ち', '再生できませんでした'],
  ko: ['진행 확인 대기', '재생 실패'], yue: ['等候確認進度', '未能播放']
};
function finiteCoordinate(value) {
  if (!value || value.longitude === null || value.latitude === null || value.longitude === undefined || value.latitude === undefined || value.longitude === '' || value.latitude === '') return null;
  const longitude = Number(value && value.longitude), latitude = Number(value && value.latitude);
  return Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90 ? { longitude, latitude } : null;
}
function sanitizeMap(map) {
  const markers = (map && Array.isArray(map.markers) ? map.markers : []).map(marker => {
    const point = finiteCoordinate(marker); return point ? Object.assign({}, marker, point) : null;
  }).filter(Boolean);
  const sanitizeLines = lines => (Array.isArray(lines) ? lines : []).map(line => {
    const points = (line && Array.isArray(line.points) ? line.points : []).map(finiteCoordinate).filter(Boolean);
    return points.length > 1 ? Object.assign({}, line, { points }) : null;
  }).filter(Boolean);
  const polyline = sanitizeLines(map && map.polyline);
  const routeLines = sanitizeLines(map && map.routeLines);
  const boundaryLines = sanitizeLines(map && map.boundaryLines);
  const center = finiteCoordinate(map) || (markers[0] && finiteCoordinate(markers[0])) || { longitude: 116.383, latitude: 39.937 };
  return Object.assign({}, map, center, { markers, polyline, routeLines, boundaryLines, includePoints: markers.map(finiteCoordinate) });
}
Page({
  videoPlay(event) { const d = ui.dataset(event), video = this.data.videoItem; if (video && Number(d.generation) === video.generation && d.id === video.id) { if (this._asking || this.roomAudioActive() || !this._visible) { audio.pause(); return; } this._userPaused = false; } audio.videoEvent('play', d.generation, d.id); },
  videoPause(event) { const d = ui.dataset(event); audio.videoEvent('pause', d.generation, d.id); },
  videoEnded(event) { const d = ui.dataset(event); audio.videoEvent('ended', d.generation, d.id); },
  videoError(event) { const d = ui.dataset(event); audio.videoEvent('error', d.generation, d.id); },
  videoTime(event) { const d = ui.dataset(event); audio.videoEvent('time', d.generation, d.id, event.detail); },
  fullscreenVideo() {
    if (!this.data.videoItem) return;
    const failed = () => my.showToast({ content: this.data.messages.videoFullscreenUnavailable, type: 'none' });
    try {
      const context = my.createVideoContext('tour-interlude-video');
      if (context && typeof context.requestFullScreen === 'function') context.requestFullScreen({ direction: 90, fail: failed });
      else failed();
    } catch (_) { failed(); }
  },
  videoFullscreenChange(event) {
    const d = ui.dataset(event), video = this.data.videoItem;
    if (!video || Number(d.generation) !== video.generation || d.id !== video.id) return;
    this._videoFullscreen = !!(event.detail && event.detail.fullScreen);
  },
  updateSequenceVideo(item, generation) {
    if (this._videoFullscreen) {
      this._videoFullscreen = false;
      try { const context = my.createVideoContext('tour-interlude-video'); if (context && typeof context.exitFullScreen === 'function') context.exitFullScreen(); } catch (_) {}
    }
    const hold = item && (!this._visible || this._asking || this.roomAudioActive());
    this.setData(Object.assign({ videoItem: item ? Object.assign({}, item, { generation }, hold ? { paused: true } : {}) : null }, item ? { queueOpen: false } : {}), () => {
      const state = audio.snapshot();
      if (hold && state.owner === 'tour' && state.generation === generation && state.item && state.item.id === item.id) audio.pause();
    });
  },
  skipVideo() { const video = this.data.videoItem; if (video) audio.videoEvent('skip', video.generation, video.id); },
  serverAudioReadiness() {
    const roomState = translation.snapshot(), room = roomState.room, visit = this.data.visit, route = this.data.route;
    if (!auth.current()) return { code: 'login-required', message: '请先登录，再连接讲解' };
    if (!tourAudio.supported()) return { code: 'unsupported', message: '当前环境暂不支持持续讲解，请检查支付宝版本及服务配置' };
    if (!room || typeof room.roomId !== 'string' || !room.roomId) return { code: 'room-required', message: '请先加入房间，再连接讲解' };
    if (room.isHost) return { code: 'host', message: '请使用游客身份加入房间收听讲解' };
    if (['closed', 'draining'].includes(room.status)) return { code: 'room-ended', message: roomState.displayNotice || '车夫已解散房间' };
    if (roomState.reconnecting && !tourAudio.activeForRoom(room.roomId)) return { code: 'room-reconnecting', message: '正在恢复讲解连接，请稍候' };
    if (!route || typeof route.id !== 'string' || !route.id) return { code: 'route-required', message: '请先选择讲解路线' };
    if (!visit || visit.status !== 1 || typeof visit.visitId !== 'string' || !visit.visitId) return { code: 'visit-required', message: '请先开始当前路线的游览，再连接讲解' };
    if (visit.routeId && visit.routeId !== route.id) return { code: 'visit-mismatch', message: '游览与当前路线不一致，请重新开始当前路线' };
    return { code: 'ready', message: '' };
  },
  serverAudioEnabled() {
    return this.serverAudioReadiness().code === 'ready';
  },
  applyServerReadiness(readiness) {
    this.setData({ audioError: ['room-ended', 'room-reconnecting'].includes(readiness.code) ? '' : readiness.message,
      followStatus: readiness.message, audioCreating: false, roomNotice: readiness.code === 'room-ended' ? readiness.message : '' });
  },
  serverAudioKey() {
    const options = this.serverAudioOptions();
    return [ui.userId(), auth.version(), options.roomId, options.visitId, options.routeId, options.guideId || '', options.language].join('|');
  },
  driverManaged() { return !!(this.data.locationEnabled && translation.snapshot().following !== false && this.serverAudioEnabled()); },
  serverAudioOptions(startStageId = '') {
    const room = translation.snapshot().room, guide = this.data.guides[this.data.guideIndex];
    const session = tourAudio.snapshot(), context = session.context;
    const preserveGuide = this.driverManaged() && context && session.roomId === room.roomId
      && context.visitId === this.data.visit.visitId && context.routeId === this.data.route.id && context.language === this.data.locale;
    return { roomId: room.roomId, visitId: this.data.visit.visitId, routeId: this.data.route.id,
      guideId: preserveGuide ? context.guideId : guide && guide.guideId || null, startStageId: startStageId || null, language: this.data.locale,
      skipExtra: this.data.skipExtra, autoplay: this.data.autoplay, following: this.data.locationEnabled && translation.snapshot().following !== false,
      roomMuted: !!translation.snapshot().paused,
      paused: !!this._userPaused, lockContent: this.driverManaged() ? false : !!(this.data.lockContent || this._visible && (this.data.contentOpen || this.data.queueOpen)) };
  },
  async ensureServerAudio(startStageId = '', requireIntent = false, recoverMembership = true) {
    const readiness = this.serverAudioReadiness();
    if (readiness.code !== 'ready') { this.applyServerReadiness(readiness); return null; }
    if (this._asking || this.data.chatOpen) { this.setData({ followStatus: '问答中，讲解暂歇' }); return null; }
    if (startStageId && this.driverManaged()) return null;
    const action = startStageId || requireIntent ? this._serverAction = {} : null;
    if (action) { this._serverExtraRequest = null; audio.stop('tour-extra'); }
    if (!this._serverSubscription) this._serverSubscription = tourAudio.subscribe(value => this.applyServerAudio(value));
    const key = this.serverAudioKey(), user = this._user, rev = this._rev;
    const options = this.serverAudioOptions(startStageId), accountVersion = auth.version();
    const current = () => (!action || action === this._serverAction) && user === this._user && user === ui.userId() && rev === this._rev && accountVersion === auth.version()
      && this.serverAudioEnabled() && ['roomId', 'visitId', 'routeId', 'guideId', 'language'].every(name => this.serverAudioOptions()[name] === options[name]);
    this._serverFailedKey = key;
    try {
      const operation = tourAudio.start(options), intended = tourAudio.captureIntent();
      const state = await operation;
      if (!current() || !state || tourAudio.snapshot().sessionId !== state.sessionId || (startStageId || requireIntent) && !intended()) throw Object.assign(Error('讲解会话已变更'), { cancelled: true });
      this._serverFailedKey = ''; this._pendingPlayback = null; this._pendingFinish = '';
      this.clearArrivalPrompt(); this._dwell = null; this._driverAlignment = null;
      this.setData({ driverAligning: false });
      if (startStageId && (state.stageId !== startStageId || (state.queue || []).some(item => item.stageId === startStageId && ['emitted', 'failed', 'skipped', 'completed'].includes(item.status)))) return await tourAudio.control('select', { stageId: startStageId }, state.sessionId);
      return state;
    } catch (error) {
      if (!error.cancelled && current() && recoverMembership && error.status === 403 && error.code === 10003 && error.message === '请先加入房间') {
        await translation.recoverRoom(options.roomId);
        if (translation.snapshot().room && translation.snapshot().room.roomId === options.roomId && this.serverAudioReadiness().code === 'room-ended') {
          this.applyServerReadiness(this.serverAudioReadiness()); return null;
        }
        if (user === this._user && user === ui.userId() && rev === this._rev && accountVersion === auth.version()
          && translation.snapshot().room && translation.snapshot().room.roomId === options.roomId && translation.snapshot().reconnecting) {
          this._serverFailedKey = ''; this.applyServerReadiness(this.serverAudioReadiness()); return null;
        }
        if (current()) return this.ensureServerAudio(startStageId, requireIntent, false);
      }
      if (!error.cancelled && current()) { this._serverFailedKey = key; this.setData({ audioError: error.message }); }
      throw error;
    }
  },
  applyServerAudio(value) {
    if (this._user !== ui.userId() || this._authVersion !== undefined && this._authVersion !== auth.version()) return;
    this.setData({ driverManaged: this.driverManaged() });
    if (!value.active && this._serverSession) {
      this._serverSession = false; this._userPaused = false;
      if (!value.error) this._serverFailedKey = '';
      this._pendingPlayback = null; this._pendingFinish = ''; this._playbackPaint = null;
      this._roomResume = null; this._askResume = null; this._backgroundResume = null; this._deferredResume = null;
      this._extraResume = null; this._extraReturn = null; this._extraPlayback = false;
      this._serverExtraRequest = null;
      this.setData({ playing: false, paused: false, playingStopId: '', hasDuration: false, itemTitle: '',
        timeLabel: '0:00', durationLabel: '0:00', progress: 0, audioError: value.error || '', sequence: [], queuedCount: 0, videoItem: null });
    }
    if (value.active) this._serverSession = true;
    const state = value.state, visit = this.data.visit, route = this.data.route;
    const interruptionNotice = interruption.snapshot().active ? '其他应用正在使用音频，讲解已暂停' : '音频已暂停，请点击重新连接继续收听';
    if (!state) {
      const readiness = this.serverAudioReadiness();
      if (['room-ended', 'room-reconnecting'].includes(readiness.code)) { this.applyServerReadiness(readiness); return; }
      if (value.active && interruption.blocked()) { this.setData({ audioCreating: value.creating, audioRecovering: false, audioError: '', paused: true, followStatus: interruptionNotice }); return; }
      this.setData({ audioCreating: value.creating, audioRecovering: false, audioError: value.error || '',
        followStatus: value.creating ? '正在连接讲解，请稍候' : value.error ? '讲解未连接，请重试' : this.serverAudioReadiness().message || '讲解尚未连接' });
      return;
    }
    if (!visit || !route || state.visitId !== visit.visitId || state.routeId !== route.id) return;
    const playback = audio.snapshot(), owns = playback.live && playback.item && playback.item.id === state.sessionId;
    const audible = value.audible || {}, audibleStage = audible.stageId || '';
    const index = this.data.stops.findIndex(stop => stop.id === audibleStage);
    if (index >= 0 && (!this.data.stop || this.data.stop.id !== audibleStage) && !this._manualBrowse) this.showStop(index, false, true);
    const nextVisit = state.visit || Object.assign({}, visit, { visitedStageIds: state.visitedStageIds || [], completedStageIds: state.completedStageIds || [] });
    if (nextVisit.visitId === visit.visitId) { visits.remember(nextVisit, route); this._heldVisit = { visit: nextVisit, route }; }
    const sequence = (state.queue || []).map(item => {
      const stopIndex = this.data.stops.findIndex(stop => stop.id === item.stageId);
      const labels = serverQueueLabels[this.data.locale] || serverQueueLabels.zh;
      return stopIndex < 0 ? null : { id: item.stageId, name: this.data.stops[stopIndex].name, index: stopIndex,
        status: item.status === 'emitted' ? 'awaiting' : item.status,
        statusLabel: item.status === 'emitted' ? labels[0] : item.status === 'failed' ? labels[1] : '' };
    }).filter(Boolean);
    const time = Number(audible.itemTimeSeconds) || 0, duration = Number(audible.itemDurationSeconds) || 0;
    const healthy = owns && playback.playing && !playback.failed && !value.stalled && !value.pausedIntent && !value.heldIntent;
    const followStatus = interruption.blocked() ? interruptionNotice : value.recovering ? '正在重新连接' : value.error ? '播放中断，请重新连接' : value.pausedIntent ? '已暂停，可重新连接继续' : value.heldIntent ? '问答中，讲解暂歇'
      : !healthy ? '正在连接讲解' : audible.kind === 'idle' ? '沿途趣事' : audible.kind === 'room' ? '车夫正在讲解' : audible.kind === 'route' ? '正在自动讲解' : '跟随中 · 到站自动讲解';
    this._userPaused = value.pausedIntent || !!(owns && playback.nativePaused);
    this.setData({ visit: nextVisit, sequence, queuedCount: sequence.filter(item => item.status === 'queued').length,
      playing: !!(healthy && ['route', 'room', 'idle'].includes(audible.kind)), followStatus,
      audioCreating: false, audioRecovering: value.recovering, audioLag: Math.round(value.lagSeconds || 0),
      paused: interruption.blocked() || value.pausedIntent || value.heldIntent || !!(owns && playback.nativePaused), playingStopId: audibleStage,
      timeLabel: ui.clock(time), durationLabel: ui.clock(duration), hasDuration: duration > 0,
      progress: duration > 0 ? Math.max(0, Math.min(100, time / duration * 100)) : 0,
      itemTitle: audible.title || '', audioError: interruption.blocked() ? '' : value.error || state.error || '', driverAligning: false,
      ...(audibleStage && !this._manualBrowse ? { selectionMode: 'formal', browsing: false } : {}),
      ...(nextVisit.status !== 1 ? { tourStage: 'overview', contentOpen: false, queueOpen: false } : {}) });
    if (playback.owner === 'tour-extra') this.updateServerExtraProgress(playback);
  },
  updateServerExtraProgress(playback) {
    if (playback.owner !== 'tour-extra' || !playback.item || !this._serverExtraRequest || !this._serverExtraRequest.started) return;
    this.setData({ playing: playback.playing, paused: !playback.playing, playingStopId: this.data.stop && this.data.stop.id || '',
      itemTitle: playback.item.title || '', timeLabel: ui.clock(playback.time), durationLabel: ui.clock(playback.duration),
      hasDuration: playback.duration > 0, progress: playback.duration > 0 ? Math.max(0, Math.min(100, playback.time / playback.duration * 100)) : 0 });
  },
  serverAudioCommand(command, values = {}) {
    if (this.driverManaged() && ['select', 'preview', 'replay', 'seek', 'skip', 'complete'].includes(command)) return Promise.resolve(null);
    return tourAudio.control(command, values).then(state => command === 'seek' && state ? tourAudio.setPaused(false, state.sessionId) : state).catch(error => { if (!error.cancelled) this.setData({ audioError: error.message }); return null; });
  },
  retryAudio() {
    if (this.data.busy || this.data.loading || this._asking || this.data.chatOpen || this.data.audioRecovering || this._audioRetry || tourAudio.snapshot().creating) return;
    const room = translation.snapshot().room, readiness = this.serverAudioReadiness();
    if (tourAudio.supported() && room && !room.isHost && readiness.code !== 'ready') { this.applyServerReadiness(readiness); return; }
    if (!interruption.resumeManually()) { my.showToast({ content: '其他应用正在使用音频，请结束后重试', type: 'none' }); return; }
    if (!this.driverManaged()) { this.play(true); return; }
    this._manualBrowse = false;
    const playback = audio.snapshot();
    if (playback.live && playback.owner === 'tour') audio.pause();
    this._audioRetry = this.ensureServerAudio('', true).then(state => state && tourAudio.control('realign', {}, state.sessionId))
      .then(state => state && tourAudio.setPaused(false, state.sessionId))
      .catch(error => { if (!error.cancelled) this.setData({ audioError: error.message }); }).finally(() => { this._audioRetry = null; });
  },
  copyAudioReport() {
    const report = tourAudio.diagnostics(), info = my.getSystemInfoSync();
    report.device = { platform: info.platform, system: info.system, model: info.model, version: info.version, SDKVersion: info.SDKVersion };
    report.routeId = this.data.route && this.data.route.id || '';
    report.selectedStageId = this.data.stop && this.data.stop.id || '';
    const room = translation.snapshot().room;
    report.startup = { readiness: this.serverAudioReadiness(), roomId: room && room.roomId || '', roomStatus: room && room.status || '',
      visitId: this.data.visit && this.data.visit.visitId || '', visitStatus: this.data.visit && this.data.visit.status,
      language: this.data.locale, tourStage: this.data.tourStage, following: !!this.data.locationEnabled, screenOffListening: backgroundListening.enabled(),
      busy: !!this.data.busy, loading: !!this.data.loading, asking: !!(this._asking || this.data.chatOpen),
      automaticRetryBlocked: !!(this.serverAudioEnabled() && this._serverFailedKey === this.serverAudioKey()) };
    my.setClipboard({ text: JSON.stringify(report, null, 2), success: () => my.showToast({ content: '已复制诊断记录，不含登录凭证和音频地址', type: 'none' }) });
  },
  syncServerPreferences() {
    if (!this.serverAudioEnabled() || !tourAudio.active()) return;
    const options = this.serverAudioOptions();
    this.serverAudioCommand('preferences', { skipExtra: options.skipExtra, autoplay: options.autoplay, following: options.following, lockContent: options.lockContent });
  },
  useServerScheduler() {
    if (tourAudio.active()) return true;
    if (this.data.tourStage !== 'navigation') return false;
    if (!this.serverAudioEnabled()) {
      const room = translation.snapshot().room;
      const readiness = this.serverAudioReadiness();
      if (['room-ended', 'room-reconnecting'].includes(readiness.code)) { this.applyServerReadiness(readiness); return true; }
      if (tourAudio.supported() && room && !room.isHost && translation.snapshot().following && !this.data.loading && !this.data.busy) {
        this.applyServerReadiness(readiness);
        return true;
      }
      return false;
    }
    const key = this.serverAudioKey();
    if (this._serverFailedKey === key) this.applyServerAudio(tourAudio.snapshot());
    if (!this.data.busy && !this.data.loading && this._serverFailedKey !== key) this.ensureServerAudio().catch(() => {});
    return true;
  },
  me() { my.navigateTo({ url: '/pages/me/index' }); },
  postcard() { const stop = this.data.stop; if (!stop || !stop.experience || !stop.experience.enabled) return; const visit = this.data.visit; if (!visit) { my.showToast({ content: '请先开始本条路线的游览', type: 'none' }); return; } audio.pause(); my.navigateTo({ url: '/pages/postcards/index?routeId=' + encodeURIComponent(this.data.route.id) + '&stageId=' + encodeURIComponent(stop.id) + '&visitId=' + encodeURIComponent(visit.visitId) }); },
  translationRoom() { translation.prepareEntry(this.data.locale); my.navigateTo({ url: '/pages/translation-room/index' }); },
  data: { mapToolsOpen: false, driverAligning: false, mapSkew: 0, mapSettings: { enableBuilding: 1, tiltGesturesEnabled: 1, rotateGesturesEnabled: 1 }, messages: Object.assign({}, tourMessages('zh'), arrivalMessages('zh')), arrivalCandidate: null, arrivalCountdown: '', tourStage: 'language', contentOpen: false, queueOpen: false, destinationName: '', sequence: [], queuedCount: 0, lockContent: false, locales, localeIndex: 0, locale: 'zh', destinations: [], destinationIndex: 0, routes: [], search: '', route: null, stops: [], stop: null, stopIndex: 0, guides: [], guideIndex: 0, chapters: [], visit: null, browsing: true, selectionMode: 'preview', busy: false, loading: false, error: '', audioError: '', playing: false, paused: false, playingStopId: '', canPlayStop: false, hasDuration: false, timeLabel: '0:00', durationLabel: '0:00', progress: 0, itemTitle: '', autoplay: false, skipExtra: false, locationEnabled: false, following: false, showRoute: true, locationNote: tourMessages('zh').locationHint, candidates: [], recording: false, transcribing: false, cancelRecording: false, map: { longitude: 116.383, latitude: 39.937, markers: [], polyline: [], includePoints: [] } },
  onLoad(query = {}) { this._rev = 0; this._visible = true; this._asking = false; this._dismissedCandidates = new Set(); this._arrivalLogged = new Set(); this._arrivalPreviousFix = null; this._launch = { list: query.view === 'routes', routeId: typeof query.routeId === 'string' ? query.routeId : '', routeCode: typeof query.routeCode === 'string' ? query.routeCode : '', destinationId: typeof query.destinationId === 'string' ? query.destinationId : '', locale: locales.some(l => l.value === query.lang) ? query.lang : '' }; this.setData({ messages: Object.assign({}, tourMessages('zh'), arrivalMessages('zh')), arrivalCandidate: null, arrivalCountdown: '', tourStage: 'language', contentOpen: false, sequence: [], queuedCount: 0, lockContent: false, chatOpen: false, immersive: false, mapScale: 15, mapRotation: 0, mapSkew: 0 }); this.initialize(); },
  onShow() {
    this.setData({ screenOffListening: backgroundListening.enabled() });
    this._visible = true;
    this.syncServerPreferences();
    tourAudio.setForeground(true);
    if (!this._serverSubscription) this._serverSubscription = tourAudio.subscribe(value => this.applyServerAudio(value));
    this.applyLocale(this.data.locale);
    if (!this._roomSubscription) this._roomSubscription = translation.subscribe(() => { if (this._visible || config.background) { this.syncDriverFollowing(); this.syncRoomPlayback(); this.flushFinished(); this.startNextSequence(); } });
    if (this._user && (this._user !== ui.userId() || this._authVersion !== undefined && this._authVersion !== auth.version())) { this.reset(); this.initialize(); return; }
    if (this._initializing) return;
    const rememberedLocale = storage.read('locale', '');
    if (rememberedLocale && rememberedLocale !== this.data.locale) { const selected = getApp().globalData.selectedRoute; getApp().globalData.selectedRoute = ''; this.chooseLocale({ detail: { value: Math.max(0, locales.findIndex(l => l.value === rememberedLocale)) } }, selected); return; }
    const selected = getApp().globalData.selectedRoute;
    if (selected) { getApp().globalData.selectedRoute = ''; this._backgroundResume = null; this._askResume = null; this.selectRoute(selected, true); return; }
    if (this.data.locationEnabled) this.watchLocation(true);
    if (getApp().globalData.openChat) { getApp().globalData.openChat = false; this.ask(); return; }
    if (this._askResume || this._asking && tourAudio.active()) this.resumeAfterAsk();
    else if (this._extraReturn) { const snapshot = this._extraReturn; this._extraReturn = null; this._backgroundResume = null; this.restorePlayback(snapshot); }
    else if (this._backgroundResume) {
      const snapshot = this._backgroundResume; this._backgroundResume = null;
      const state = audio.snapshot();
      // 后台期间整轮已经播完时不再从头恢复；否则恢复暂停点或继续播放。
      if (!(state.owner === 'tour' && !state.playing && !state.item)) this.restorePlayback(snapshot);
    }
    this.flushFinished(); this.startNextSequence();
  },
  onHide() {
    const extraRequest = this._serverExtraRequest;
    this._serverExtraRequest = null;
    if (extraRequest && extraRequest.started) audio.stop('tour-extra');
    if (extraRequest && extraRequest.started && extraRequest.sessionId && !this._asking) tourAudio.release(extraRequest.sessionId).catch(() => {});
    tourAudio.setForeground(false);
    if (!config.background) { if (this._roomSubscription) this._roomSubscription(); this._roomSubscription = null; }
    this._backgroundResume = this.capturePlayback();
    this._visible = false; this.saveCheckpoint(); this.clearArrivalPrompt();
    this.syncServerPreferences();
    if (audio.snapshot().item && audio.snapshot().item.kind === 'interlude-video') audio.pause();
    if (getApp().globalData.voiceInput === this._voice && this._voice) { this._voice.cancel(); getApp().globalData.voiceInput = null; }
    if (this._recorder && !this._handedVoice) this.cancelVoice();
    this.setData({ chatOpen: false });
    this._dwell = null; this._arrivalPreviousFix = null;
    // 后台模式保留定位轮询与讲解播放；关闭时维持“离开页面即暂停”。
    if (!config.background) {
      if (this._watch) { this._watch(); this._watch = null; }
      if (audio.snapshot().owner === 'tour') audio.pause();
    }
  },
  onUnload() { this.onHide(); if (this._serverSubscription) this._serverSubscription(); this._serverSubscription = null; tourAudio.stop(); if (this._roomSubscription) this._roomSubscription(); this._roomSubscription = null; if (!this._handedVoice) this.cancelVoice(); if (this._watch) { this._watch(); this._watch = null; } this._initToken = null; this._rev++; audio.stop('tour'); },
  reset() { tourAudio.stop(); this._serverFailedKey = ''; this._driverAlignment = null; this._driverPositionKey = ''; this.clearArrivalPrompt(); this._fix = null; this.cancelVoice(); this._asking = false; this._askResume = null; this._backgroundResume = null; this._initToken = null; this._initializing = false; this._manualBrowse = false; this._extraResume = null; this._extraReturn = null; this._pendingPlayback = null; this._pendingFinish = ''; this._rev++; audio.stop('tour'); this._heldVisit = null; this._detail = null; this._places = []; this._routes = []; this._dismissedCandidates = new Set(); getApp().globalData.chatContext = null; if (this._watch) this._watch(); this._watch = null; this.setData({ driverAligning: false, tourStage: 'language', contentOpen: false, queueOpen: false, route: null, stop: null, visit: null, stops: [], guides: [], chapters: [], candidates: [], sequence: [], queuedCount: 0, routes: [], busy: false, playing: false, paused: false, playingStopId: '', canPlayStop: false, hasDuration: false, chatOpen: false, locationEnabled: false, following: false, showRoute: true, selectionMode: 'preview', map: { longitude: 116.383, latitude: 39.937, markers: [], polyline: [], includePoints: [] } }); },
  clearSelection() { tourAudio.stop(); this._serverFailedKey = ''; this.clearArrivalPrompt(); if (this.data.visit && this.data.visit.status === 1) this._heldVisit = { visit: this.data.visit, route: this.data.route }; this._detail = null; this._manualBrowse = false; this._extraResume = null; this._extraReturn = null; this._pendingPlayback = null; this._pendingFinish = ''; this.setData({ tourStage: 'overview', contentOpen: false, queueOpen: false, route: null, visit: null, stop: null, stops: [], guides: [], chapters: [], sequence: [], queuedCount: 0, candidates: [], playing: false, paused: false, playingStopId: '', canPlayStop: false, hasDuration: false, itemTitle: '', progress: 0, map: { longitude: 116.383, latitude: 39.937, markers: [], polyline: [], includePoints: [] } }); this.syncContext(); },
  async initialize() {
    if (this._initializing) return;
    this._initializing = true; const initial = this._rev, token = this._initToken = {};
    this.setData({ loading: true, error: '' });
    try {
      const hadSession = !!auth.current();
      const user = await auth.ensure(); if (initial !== this._rev) return; this._user = ui.userId(); this._authVersion = auth.version();
      const authPromptKey = storage.scoped(this._user, 'alipay-auth-prompted');
      if (!hadSession && user && user.isGuest && !storage.read(authPromptKey, false)) {
        storage.write(authPromptKey, true);
        this.setData({ loading: false });
        if (this._visible && token === this._initToken) my.navigateTo({ url: '/pages/auth/index' });
        return;
      }
      const launch = this._launch || {}, storedLocale = launch.locale || storage.read('locale', storage.read('tour-locale', launch.list ? 'zh' : ''));
      if (!locales.some(l => l.value === storedLocale)) { this.setData({ tourStage: 'language', loading: false }); return; }
      const locale = storedLocale; storage.write('locale', locale);
      const prefs = storage.read(storage.scoped(this._user, 'preferences'), {});
      storage.write('tour-locale', locale);
      this.applyLocale(locale);
      this.setData({ autoplay: false, skipExtra: false, lockContent: !!prefs.lockContent, tourStage: 'overview' });
      if (!await this.loadCatalog(launch.destinationId || '') || token !== this._initToken || this._user !== ui.userId()) return;
      const selected = launch.routeId || getApp().globalData.selectedRoute || storage.read(storage.scoped(this._user, 'route'), '');
      getApp().globalData.selectedRoute = '';
      this._launch = null;
      const route = launch.routeCode ? this._routes.find(r => r.familyCode === launch.routeCode) : this._routes.find(r => r.id === selected) || (!launch.routeId && this._routes[0]);
      if ((launch.routeCode || launch.routeId) && !route) throw Error(this.data.messages.routeUnavailable);
      if (route) await this.selectRoute(route.id, !launch.list);
    } catch (e) { if (token === this._initToken) ui.error(this, e); }
    finally { if (token === this._initToken) { this._initializing = false; if (this._user === ui.userId()) { this.setData({ loading: false }); if (this.data.locationEnabled) this.watchLocation(); } } }
  },
  async loadCatalog(destinationId = '') {
    const rev = ++this._rev, user = this._user;
    this.setData({ loading: true, error: '' });
    try {
      const result = await http.post('/ClientCatalog/Catalog', { destinationId, locale: this.data.locale, scene: 'rickshaw' });
      if (rev !== this._rev || user !== ui.userId()) return;
      this._routes = (result.routes || []).filter(r => r.locale === this.data.locale); this._places = result.places || [];
      const destinations = [{ id: '', name: this.data.messages.allDestinations }].concat(result.destinations || []);
      this.setData({ destinations, destinationIndex: Math.max(0, destinations.findIndex(d => d.id === destinationId)) }); this.filterRoutes();
      return true;
    } catch (e) { if (rev === this._rev) ui.error(this, e); }
    finally { if (rev === this._rev) this.setData({ loading: false }); }
  },
  filterRoutes() { const q = this.data.search.trim().toLowerCase(); this.setData({ routes: (this._routes || []).filter(r => [r.title, r.subtitle, r.guideName, r.guideStyle].filter(Boolean).join(' ').toLowerCase().includes(q)) }); },
  search(event) { this.setData({ search: ui.value(event) }); this.filterRoutes(); },
  async chooseDestination(event) { if (this.data.busy || this.data.loading) return; const destination = this.data.destinations[Number(ui.value(event))]; if (!destination) return; const previous = this.data.route; this.saveCheckpoint(); audio.stop('tour'); this.clearSelection(); if (await this.loadCatalog(destination.id)) { const next = this._routes.find(r => previous && r.id === previous.id) || this._routes[0]; if (next) await this.selectRoute(next.id); } },
  async chooseLocale(event, selectedRouteId = '') {
    if (this.data.busy || this.data.loading) return;
    const index = Number(ui.value(event)); if (!locales[index]) return; const locale = locales[index].value;
    this.clearArrivalPrompt(); this.saveCheckpoint(); audio.stop('tour'); this._resumeFromChat = false;
    const previous = this.data.route; this.clearSelection();
    storage.write('locale', locale); storage.write('tour-locale', locale); this.applyLocale(locale); this.setData({ playing: false, tourStage: 'overview', contentOpen: false, search: '' });
    if (await this.loadCatalog()) { const next = this._routes.find(r => r.id === selectedRouteId) || this._routes.find(r => previous && (r.id === previous.id || previous.familyCode && r.familyCode === previous.familyCode)) || this._routes[0]; if (next) await this.selectRoute(next.id); }
    if (this.data.locationEnabled) this.watchLocation();
  },
  applyLocale(locale) {
    const messages = Object.assign({}, tourMessages(locale), arrivalMessages(locale), driverMessages(locale));
    const locationNote = this.data.locationEnabled && this._fix ? this._fix.accuracy > 65 ? messages.locationUnknown : formatRoomMessage(messages.locationAccuracy, { accuracy: Math.round(this._fix.accuracy) }) : messages.locationHint;
    this.setData({ locale, messages, localeIndex: Math.max(0, locales.findIndex(item => item.value === locale)), locationNote });
    if (my.setNavigationBar) my.setNavigationBar({ title: messages.tourTitle });
  },
  chooseRoute(event) { if (!this.data.busy && !this.data.loading) this.selectRoute(ui.dataset(event).id); },
  async selectRoute(id, restoreJourney = false) {
    if (!id || !this._user) return;
    tourAudio.stop();
    this._serverFailedKey = '';
    this._driverAlignment = null; this._driverPositionKey = '';
    this.setData({ driverAligning: false });
    this.clearArrivalPrompt(); this.saveCheckpoint(); audio.stop('tour'); this._resumeFromChat = false;
    if (this.data.visit && this.data.visit.status === 1) this._heldVisit = { visit: this.data.visit, route: this.data.route };
    const rev = ++this._rev, user = this._user;
    this.setData({ loading: true, error: '', audioError: '', playing: false, candidates: [] }); this._dwell = null; this._dismissedCandidates = new Set();
    try {
      const detail = await http.request(http.query('/ClientCatalog/Route', { routeId: id, locale: this.data.locale }));
      if (rev !== this._rev || user !== ui.userId()) return;
      if (!detail || !detail.route || typeof detail.route.id !== 'string' || detail.route.locale !== this.data.locale) throw Error(this.data.messages.routeUnavailable);
      const experiences = await http.request(http.query('/Postcard/Route', { routeId: detail.route.id }));
      if (rev !== this._rev || user !== ui.userId()) return;
      postcards.decorate(detail, experiences);
      const visit = await http.request(http.query('/RouteVisit/Active', { routeId: id }));
      if (rev !== this._rev || user !== ui.userId()) return;
      this._detail = detail; this._manualBrowse = false; const stops = tour.sorted(detail.stops).map((stop, index) => Object.assign({}, stop, { images: (stop.images || []).filter(image => image && image.url), displayOrder: String(index + 1).padStart(2, '0') }));
      storage.write(storage.scoped(user, 'route'), id);
      const destination = this.data.destinations.find(d => d.id === detail.route.destinationId);
      const map = sanitizeMap(tour.mapData(detail, destination, this._places)); this._fullPolyline = map.polyline;
      if (!this.data.showRoute) map.polyline = map.boundaryLines;
      this.setData({ route: detail.route, stops, visit: visit || null, map, destinationName: destination && destination.name || '', tourStage: restoreJourney && visit && visit.status === 1 ? 'navigation' : 'overview', contentOpen: false, queueOpen: false });
      if (this.data.locationEnabled && this._fix) this.updateLocationMarker(this._fix);
      this.restoreSequence();
      if (visit) { visits.remember(visit, detail.route); this._heldVisit = { visit, route: detail.route }; }
      const current = visit && visit.status === 1 ? stops.findIndex(s => s.id === visit.currentStageId) : -1;
      const resumable = current >= 0 && !(visit.completedStageIds || []).includes(stops[current].id);
      this.showStop(current >= 0 ? current : 0, !resumable);
      if (resumable && this.data.tourStage === 'navigation') this._pendingPlayback = { key: this.contextKey(), automatic: true };
      if (this.data.tourStage === 'navigation') { this.enableNearbyGuidance(); this.focusNavigationMap(); }
    } catch (e) { if (rev === this._rev) ui.error(this, e); }
    finally { if (rev === this._rev) { this.setData({ loading: false }); this.startNextSequence(); } }
  },
  showStop(index, browsing = true, preserveAudio = false) {
    this.clearArrivalPrompt(); this.saveCheckpoint(); if (!preserveAudio && !tourAudio.active()) audio.stop('tour'); this._dwell = null; this._resumeFromChat = false;
    this._askResume = null; this._backgroundResume = null; this._deferredResume = null; this._extraResume = null; this._extraReturn = null; this._pendingPlayback = null;
    const stop = this.data.stops[index] || null;
    const guides = stop ? tour.narrations(stop, this.data.locale) : [];
    const preferred = storage.read(storage.scoped(this._user, 'guide'), '');
    const guideIndex = Math.max(0, guides.findIndex(g => g.guideId === preferred));
    const chapters = tour.sorted(guides[guideIndex] && guides[guideIndex].chapters);
    const canPlayStop = !!(chapters.length || stop && (stop.video || (stop.extraAudios || []).some(item => item && item.url)));
    const selectionMode = browsing ? this.data.visit && this.data.visit.status === 1 && this.data.tourStage === 'navigation' ? 'browse' : 'preview' : 'formal';
    this.setData({ stopIndex: index, stop, guides, guideIndex, chapters, browsing, selectionMode, imageIndex: 0, audioError: this.serverAudioEnabled() ? tourAudio.snapshot().error || '' : '', playing: false, paused: false, playingStopId: '', canPlayStop, hasDuration: false, timeLabel: '0:00', durationLabel: '0:00', progress: 0, itemTitle: '' });
    this.syncContext();
  },
  browse(event) { const index = Number(ui.dataset(event).index); if (this.data.busy || this.data.loading || !this.data.stops[index]) return; if (this.data.visit && this.data.visit.status === 1) this.mutate(() => this.enter(index)); else { this._manualBrowse = true; this.showStop(index, true); } },
  browseBy(delta) { if (this.driverManaged()) return; const index = this.data.stopIndex + delta; if (this.data.busy || this.data.loading || !this.data.stops[index]) return; this._manualBrowse = true; this.showStop(index, true); this.play(); },
  previous() { this.browseBy(-1); },
  next() { this.browseBy(1); },
  marker(event) { const id = event.detail && event.detail.markerId !== undefined ? event.detail.markerId : event.markerId; const index = Number(id) - 1; if (index < 0 || index >= this.data.stops.length || this.data.busy || this.data.loading) return; if (this.data.visit && this.data.visit.status === 1) this.mutate(() => this.enter(index)); else { this._manualBrowse = true; this.showStop(index); } },
  mapReady() {
    if (!my.createMapContext || !this._visible) return;
    const context = my.createMapContext('tour-map');
    const camera = this.data.tourStage === 'navigation' && this.data.mapSkew > 0 ? {
      longitude: this.data.map.longitude, latitude: this.data.map.latitude,
      scale: this.data.mapScale, 'include-points': []
    } : {};
    if (context.updateComponents) context.updateComponents(Object.assign({}, camera, {
      setting: this.data.mapSettings,
      success: () => this.inspectMapCamera(),
      fail: error => console.warn('[tour-map] camera/settings update failed', error)
    }));
    else this.inspectMapCamera();
    if (context.getMapProperties) context.getMapProperties({
      success: properties => {
        if (!this._visible) return;
        this._mapProperties = properties; console.info('[tour-map] engine', properties);
        if (this.data.tourStage === 'navigation' && !this._notified2d && (properties.is3d === false || properties.is3d === 0) && my.showToast) {
          this._notified2d = true; my.showToast({ content: this.data.messages.map2dHint, type: 'none' });
        }
      },
      fail: error => console.warn('[tour-map] engine query failed', error)
    });
  },
  inspectMapCamera(event) {
    if (!this._visible || this.data.chatOpen || !my.createMapContext) return;
    const change = event && (event.detail || event);
    if (change && (change.type === 'begin' || change.regionChangedType === 'begin')) return;
    const context = my.createMapContext('tour-map');
    const requestedSkew = this.data.tourStage === 'navigation' ? this.data.mapSkew : 0;
    if (context.getSkew) context.getSkew({
      success: result => {
        if (!this._visible || this.data.chatOpen || requestedSkew !== (this.data.tourStage === 'navigation' ? this.data.mapSkew : 0)) return;
        const actualSkew = Number(result.skew);
        if (!Number.isFinite(actualSkew)) return;
        this._mapCamera = { requestedSkew, actualSkew };
        console.info('[tour-map] camera', this._mapCamera);
        if (requestedSkew > 0 && actualSkew === 0) console.warn('[tour-map] requested tilt is not applied; is3d alone does not confirm a tilted map or visible buildings');
      },
      fail: error => console.warn('[tour-map] camera query failed', error)
    });
  },
  focusNavigationMap() {
    if (this.data.tourStage !== 'navigation') return;
    const marker = this.data.map.markers.find(item => item.id === this.data.stopIndex + 1);
    const follow = this.data.following && isUsableLocation(this._fix, DEFAULT_APPROACH_POLICY);
    const center = follow && this.mapLocation(this._fix) || finiteCoordinate(marker) || finiteCoordinate(this.data.map);
    if (!center) return;
    this.setData({ mapSkew: 50, mapScale: 18, mapRotation: follow && Number.isFinite(this._fix.heading) ? this._fix.heading : 0, 'map.longitude': center.longitude, 'map.latitude': center.latitude, 'map.includePoints': [] }, () => this.mapReady());
  },
  overview() { this.setData({ following: false, mapSkew: 0, mapRotation: 0, 'map.includePoints': this.data.map.markers.filter(marker => marker.id !== 0).map(finiteCoordinate).filter(Boolean) }); if (my.createMapContext && this.data.map.includePoints.length) my.createMapContext('tour-map').includePoints({ points: this.data.map.includePoints, padding: [30, 30, 30, 30] }); },
  toggleMapTools() { this.setData({ mapToolsOpen: !this.data.mapToolsOpen }); },
  recenter() { this.setData({ following: true, mapToolsOpen: false }); if (this._fix && isUsableLocation(this._fix, DEFAULT_APPROACH_POLICY)) this.followLocation(this._fix, true); else if (my.createMapContext) my.createMapContext('tour-map').moveToLocation(); },
  toggleFollow() { if (!this.data.locationEnabled) return; this.setData({ following: !this.data.following, mapSkew: 50, mapScale: 18, 'map.includePoints': [] }); if (this.data.following && this._fix) this.followLocation(this._fix, true); },
  toggleRoute() { const showRoute = !this.data.showRoute; this.setData({ showRoute, 'map.polyline': showRoute ? (this._fullPolyline || []) : (this.data.map.boundaryLines || []) }); },
  zoomIn() { this.setData({ mapScale: Math.min(20, (this.data.mapScale || 15) + 1) }); },
  zoomOut() { this.setData({ mapScale: Math.max(5, (this.data.mapScale || 15) - 1) }); },
  toggleImmersive() { this.setData({ immersive: !this.data.immersive }); },
  mapLocation(fix) {
    if (!this._routeMatcher) this._routeMatcher = createRouteMatcher({ enabled: config.routeCorrection });
    return this._routeMatcher.display(fix, this.data.map.routeLines);
  },
  followLocation(fix, force = false) {
    const point = this.mapLocation(fix);
    if (!point || !isUsableLocation(fix, DEFAULT_APPROACH_POLICY)) return;
    const followDistance = this.data.map.routeLines && this.data.map.routeLines.length ? 1 : 5;
    if (!force && this._followCenter && metersBetween(this._followCenter, point) < followDistance) return;
    this._followCenter = { longitude: point.longitude, latitude: point.latitude };
    this.setData({ 'map.longitude': point.longitude, 'map.latitude': point.latitude, 'map.includePoints': [], ...(Number.isFinite(fix.heading) ? { mapRotation: fix.heading } : {}) }, () => this.mapReady());
  },
  updateLocationMarker(fix) {
    if (!this.data.locationEnabled) return;
    const point = this.mapLocation(fix);
    if (!point) return;
    const markers = this.data.map.markers.filter(marker => marker.id !== 0);
    const firstFix = markers.length === this.data.map.markers.length && isUsableLocation(fix, DEFAULT_APPROACH_POLICY);
    markers.push(Object.assign({}, point, { id: 0, iconPath: '/assets/location-marker.png', width: 36, height: 47, anchorX: .5, anchorY: .5, zIndex: 150, title: this.data.messages.currentLocation, label: { content: this.data.messages.currentLocation, color: '#246879', bgColor: '#fcfefd', padding: 5, fontSize: 11 } }));
    this.setData({ 'map.markers': markers, ...(firstFix ? { 'map.longitude': point.longitude, 'map.latitude': point.latitude, 'map.includePoints': [] } : {}) });
  },
  async startVisit() {
    if (this.data.busy || this.data.loading || !this.data.route || !this.data.stops.length) return;
    this.setData({ busy: true, error: '' });
    const rev = this._rev, user = this._user;
    try {
      const held = this._heldVisit;
      if (held && held.visit.status === 1 && held.route.id !== this.data.route.id) {
        if (!await ui.confirm(this.data.messages.switchJourney, formatRoomMessage(this.data.messages.switchJourneyConfirm, { title: held.route.title }), this.data.messages)) return;
        if (rev !== this._rev || user !== ui.userId()) return;
        await visits.abandon(held.visit, held.route); this._heldVisit = null;
      }
      if (rev !== this._rev || user !== ui.userId()) return;
      let visit = this.data.visit;
      const fresh = !visit || visit.status !== 1;
      if (fresh) visit = await visits.start(this.data.route, this.data.locale);
      if (rev !== this._rev || user !== ui.userId()) return;
      const previousVisitId = this.data.visit && this.data.visit.visitId;
      this.setData({ visit }); this._heldVisit = { visit, route: this.data.route };
      if (previousVisitId !== visit.visitId) this.restoreSequence();
      if (this.driverRoomAvailable() && translation.snapshot().following !== false) {
        this._driverPositionKey = '';
        this.showStop(fresh ? 0 : this.data.stopIndex, true);
      } else await this.enter(fresh ? 0 : this.data.stopIndex, false);
      if (rev === this._rev && user === ui.userId()) { this.setData({ tourStage: 'navigation', contentOpen: false, queueOpen: false }); this.enableNearbyGuidance(); this.focusNavigationMap(); }
    } catch (e) { if (rev === this._rev && user === ui.userId()) ui.error(this, e); }
    finally { if (rev === this._rev && user === ui.userId()) { this.setData({ busy: false }); this.flushFinished(); this.startNextSequence(); } }
  },
  async enter(index, play = true, automatic = false) {
    if (this.driverManaged() && !automatic) { this._manualBrowse = true; this.showStop(index, true, true); this.applyServerAudio(tourAudio.snapshot()); return; }
    const stop = this.data.stops[index], visit = this.data.visit, rev = this._rev, user = this._user;
    if (!stop || !visit || visit.status !== 1) return;
    if (this.serverAudioEnabled() || tourAudio.active()) {
      this._manualBrowse = false;
      this.showStop(index, false, true);
      this.setData({ tourStage: 'navigation', contentOpen: play && !automatic, queueOpen: false });
      const state = await this.ensureServerAudio(stop.id);
      if (play && state) await tourAudio.setPaused(false, state.sessionId);
      this.syncServerPreferences();
      return;
    }
    if (automatic && !tour.canAutoTriggerStop(stop, this.data.stops, visit.visitedStageIds || visit.completedStageIds || [])) return;
    const state = audio.snapshot();
    if (!automatic && this.data.stop && this.data.stop.id === stop.id && state.owner === 'tour' && state.item
      && (this.data.selectionMode === 'formal' && !this.data.browsing && visit.currentStageId === stop.id || (visit.completedStageIds || []).includes(stop.id))) {
      if (play) {
        this._userPaused = false;
        this.setData({ tourStage: 'navigation', contentOpen: true, queueOpen: false });
        this.restorePlayback({ key: this.contextKey(), userId: user, generation: state.generation, index: state.index, time: state.time, items: this._playbackItems, extra: this._extraPlayback });
      }
      return;
    }
    if (!automatic) this._userPaused = false;
    if ((visit.completedStageIds || []).includes(stop.id)) { this._manualBrowse = true; this.showStop(index, true); this.setData({ tourStage: 'navigation', contentOpen: true }); if (play) this.play(); return; }
    if (!automatic) this.prepareManualEntry(index);
    const arrivalWrite = this._arrivalWrites && this._arrivalWrites.get(visit.visitId + ':' + stop.id);
    if (arrivalWrite) await arrivalWrite;
    if (rev !== this._rev || user !== ui.userId()) return;
    let result;
    try { result = await visits.update(visit, stop.id, 'start', this.data.route); }
    catch (e) {
      if (automatic && rev === this._rev && user === ui.userId()) this._sequenceRetry = { key: visit.visitId + ':' + stop.id, after: !e.code && (!e.status || e.status >= 500) ? Date.now() + 5000 : Infinity };
      throw e;
    }
    if (rev !== this._rev || user !== ui.userId()) return;
    this._sequenceRetry = null;
    this.setData({ sequence: this.data.sequence.map(item => item.status === 'playing' && item.id !== stop.id ? Object.assign({}, item, { status: 'queued' }) : item) });
    this.setData({ visit: result }); this._heldVisit = { visit: result, route: this.data.route };
    this.sequenceStatus(stop.id, 'queued', index);
    this._manualBrowse = false; this.showStop(index, false); this.setData({ tourStage: 'navigation', contentOpen: play && !automatic });
    this._pendingPlayback = { key: this.contextKey(), automatic: automatic || !play };
    if (play) this.flushPlayback();
  },
  prepareManualEntry(index) {
    const stop = this.data.stops[index];
    if (!stop) return;
    const currentId = this.data.stop && this.data.stop.id;
    if (audio.snapshot().owner === 'tour') {
      this.saveCheckpoint();
      audio.stop('tour');
    }
    this._pendingPlayback = null;
    this._pendingFinish = '';
    this._roomResume = null;
    this._backgroundResume = null;
    this._askResume = null;
    this._deferredResume = null;
    const target = { id: stop.id, name: stop.name, index, status: 'queued' };
    const completed = new Set(this.data.visit && this.data.visit.completedStageIds || []);
    const sequence = this.data.sequence.filter(item => item.id !== stop.id).map(item =>
      !completed.has(item.id) && (item.id === currentId || item.status === 'playing') ? Object.assign({}, item, { status: 'skipped' }) : item);
    if (currentId && currentId !== stop.id && !completed.has(currentId) && !sequence.some(item => item.id === currentId)) {
      sequence.push({ id: currentId, name: this.data.stop.name, index: this.data.stopIndex, status: 'skipped' });
    }
    this.setData({ sequence: [target].concat(sequence), queuedCount: 1 + sequence.filter(item => item.status === 'queued').length });
    this.saveSequence();
  },
  async chooseLanguage(event) {
    const index = Number(ui.dataset(event).index);
    if (!locales[index] || this.data.loading || this.data.busy) return;
    storage.write('tour-locale', locales[index].value);
    if (this._launch) { this._launch.locale = locales[index].value; await this.initialize(); }
    else { await this.chooseLocale({ detail: { value: index } }); }
  },
  backToOverview() { if (this.data.busy || this.data.loading) return; this.clearArrivalPrompt(); this._dwell = null; this.setData({ tourStage: 'overview', contentOpen: false, queueOpen: false, mapToolsOpen: false, candidates: [], immersive: false }); this.overview(); },
  openContent() { this.clearArrivalPrompt(); if (this.data.stop) this.setData({ contentOpen: true, queueOpen: false, mapToolsOpen: false }); this.syncServerPreferences(); },
  closeContent() { this.setData({ contentOpen: false }); if (this.driverManaged()) { this._manualBrowse = false; this.applyServerAudio(tourAudio.snapshot()); } this.syncServerPreferences(); this.startNextSequence(); },
  changeContentSwitch(event) { this.changeLock({ detail: { value: !ui.value(event) } }); },
  toggleContent() { if (this.data.contentOpen) this.closeContent(); else this.openContent(); },
  toggleQueue() { if (this.data.videoItem) return; const opening = !this.data.queueOpen; this.clearArrivalPrompt(); this.setData({ queueOpen: opening, contentOpen: false }); this.syncServerPreferences(); if (!opening) this.startNextSequence(); },
  closeQueue() { this.setData({ queueOpen: false }); this.syncServerPreferences(); this.startNextSequence(); },
  driverRoomAvailable() {
    const state = translation.snapshot(), room = state.room;
    return Boolean(room && typeof room.roomId === 'string' && room.roomId && !room.isHost && (!state.disconnected || tourAudio.activeForRoom(room.roomId)) && !['closed', 'draining'].includes(room.status));
  },
  prepareDriverAlignment(explicit = false) {
    if (this.serverAudioEnabled() || tourAudio.active()) return false;
    const room = translation.snapshot().room, visit = this.data.visit;
    if (!room || !this.driverRoomAvailable() || !visit || visit.status !== 1 || this.data.tourStage !== 'navigation') return false;
    const key = room.roomId + ':' + visit.visitId;
    if (!explicit && this._driverPositionKey === key) return false;
    this._driverAlignment = { key, rev: this._rev, explicit };
    this._pendingPlayback = null; this._pendingFinish = '';
    this._roomResume = null; this._backgroundResume = null; this._askResume = null; this._deferredResume = null;
    this.clearArrivalPrompt();
    this.setData({ driverAligning: true, locationNote: driverMessages(this.data.locale).driverWaiting });
    if (audio.snapshot().owner === 'tour') { this.saveCheckpoint(); audio.stop('tour'); }
    if (explicit) {
      this._extraResume = null; this._extraReturn = null; this._dwell = null; this._arrivalPreviousFix = null;
      this._dismissedCandidates = new Set(); this._arrivalLogged = new Set();
      storage.remove(storage.scoped(this._user, 'checkpoint'));
      this.setData({ sequence: [], queuedCount: 0 });
      this.saveSequence();
    }
    return true;
  },
  returnToNow() {
    if (this.serverAudioEnabled() || tourAudio.active()) {
      if (this.data.busy || this.data.loading || this._asking) return;
      if (this.driverManaged()) { this._manualBrowse = false; this.applyServerAudio(tourAudio.snapshot()); this.overview(); return; }
      this._manualBrowse = false; this._userPaused = false;
      this.setData({ contentOpen: false, queueOpen: false, lockContent: false, autoplay: true, following: true, locationEnabled: true });
      this.ensureServerAudio('', true).then(state => state && tourAudio.control('realign', {}, state.sessionId)).then(state => state && tourAudio.setPaused(false, state.sessionId)).catch(error => { if (!error.cancelled) this.setData({ audioError: error.message }); });
      return;
    }
    if (this.data.driverAligning || this.data.busy || this.data.loading || !this.data.locationEnabled || !this.prepareDriverAlignment(true)) return;
    if (!this.alignDriverPosition()) this.watchLocation(true);
  },
  toggleScreenOffListening() {
    if (!config.background || !config.backgroundAudio) { my.showToast({ content: '当前版本未开启后台音频支持', type: 'none' }); return; }
    const enabled = !backgroundListening.enabled();
    backgroundListening.setEnabled(enabled);
    this.setData({ screenOffListening: backgroundListening.enabled() });
    my.showToast({ content: enabled ? '已开启息屏收听，切换其他 App 也会继续播放' : '已关闭，息屏或切换其他 App 后暂停', type: 'none' });
  },
  alignDriverPosition() {
    const pending = this._driverAlignment, visit = this.data.visit, room = translation.snapshot().room;
    if (!pending || !visit || !room || pending.rev !== this._rev || pending.key !== room.roomId + ':' + visit.visitId
      || !this.canDetectArrival() || this.data.busy || this.data.loading || !isUsableLocation(this._fix, DEFAULT_APPROACH_POLICY)
      || this._fix.source !== 'driver' || this._fix.roomId !== room.roomId) return false;
    if (!this._routeMatcher) this._routeMatcher = createRouteMatcher({ enabled: config.routeCorrection });
    const fix = this._routeMatcher.arrival(this._fix, this.data.map.routeLines);
    const candidates = tour.candidates(this.data.stops, this._places || [], fix, [], this._detail && this._detail.coordinateSystem || 1,
      Date.now(), -1, visit.visitedStageIds || visit.completedStageIds || []);
    const current = candidates.sort((first, second) => first.distance - second.distance || first.order - second.order)[0];
    if (!current) { this.setData({ locationNote: driverMessages(this.data.locale).driverNoNearbyStop }); return false; }
    const completed = new Set(visit.completedStageIds || []), sequence = new Map((pending.explicit ? [] : this.data.sequence).map(item => [item.id, Object.assign({}, item, item.status === 'playing' ? { status: 'queued' } : {})]));
    if (!pending.explicit) this.data.stops.slice(0, current.index).forEach((stop, index) => {
      sequence.set(stop.id, { id: stop.id, name: stop.name, index, status: completed.has(stop.id) ? 'completed' : 'skipped' });
    });
    const stop = this.data.stops[current.index];
    sequence.set(stop.id, { id: stop.id, name: stop.name, index: current.index, status: completed.has(stop.id) ? 'completed' : 'queued' });
    this._driverPositionKey = pending.key; this._driverAlignment = null;
    this._manualBrowse = false; this._userPaused = false; this._sequenceRetry = null; this._finishRetry = null;
    this._extraReturn = null; this._extraResume = null; this._roomResume = null;
    this.showStop(current.index, completed.has(stop.id));
    storage.remove(storage.scoped(this._user, 'checkpoint'));
    const items = Array.from(sequence.values()).sort((first, second) => first.index - second.index);
    this.setData({ driverAligning: false, sequence: items, queuedCount: items.filter(item => item.status === 'queued').length,
      contentOpen: false, queueOpen: false, following: true, ...(pending.explicit ? { lockContent: false, autoplay: true } : {}) });
    this.saveSequence();
    this.recordPrerequisiteArrival(stop.id);
    if (completed.has(stop.id)) this._pendingPlayback = { key: this.contextKey(), automatic: false };
    this.followLocation(this._fix, true);
    this.startNextSequence();
    return true;
  },
  syncDriverFollowing() {
    if (this._syncingDriver) return;
    this._syncingDriver = true;
    try {
      const available = this.driverRoomAvailable();
      const roomState = translation.snapshot();
      const ended = roomState.room && roomState.room.status === 'closed';
      this.setData({ hasTranslationRoom: available, roomNotice: ended ? roomState.displayNotice || '车夫已解散房间' : '' });
      if (!available && this.data.locationEnabled) {
        this._resumeDriverFollowing = roomState.reconnecting && roomState.following !== false;
        this.toggleLocation({ detail: { value: false } });
        this.setData({ locationNote: driverMessages(this.data.locale)[ended ? 'driverRoomEnded' : 'driverRoomRequired'] });
      }
      if (!available && (this.data.autoplay || this.data.following)) {
        this.setData({ autoplay: false, following: false });
        this._dwell = null;
      }
      if (available && roomState.following !== false && (this._resumeDriverFollowing || !this.data.locationEnabled && this.data.tourStage === 'navigation' && this.data.visit && this.data.visit.status === 1)) {
        this._resumeDriverFollowing = false;
        this.setData({ following: true });
        this.toggleLocation({ detail: { value: true } });
      }
      if (!roomState.reconnecting && !available) this._resumeDriverFollowing = false;
    } finally { this._syncingDriver = false; }
  },
  toggleTracking() {
    const enabled = !this.data.locationEnabled;
    translation.setFollowing(enabled);
    if (enabled && !this.driverRoomAvailable()) {
      this.toggleLocation({ detail: { value: false } });
      this.setData({ locationNote: driverMessages(this.data.locale).driverRoomRequired });
      my.showToast({ content: driverMessages(this.data.locale).driverRoomRequired, type: 'none' });
      this.translationRoom();
      return;
    }
    this.setData({ autoplay: enabled, following: enabled, ...(enabled ? { mapSkew: 50, mapScale: 18, 'map.includePoints': [] } : {}) });
    this.preferences(); this.toggleLocation({ detail: { value: enabled } });
    if (enabled) { this._manualBrowse = false; this.startNextSequence(); }
  },
  enableNearbyGuidance() {
    this.setData({ messages: Object.assign({}, this.data.messages, driverMessages(this.data.locale)) });
    if (!this.driverRoomAvailable()) {
      this.toggleLocation({ detail: { value: false } });
      this.setData({ autoplay: false, following: false, locationNote: driverMessages(this.data.locale).driverRoomRequired });
      return;
    }
    if (translation.snapshot().following === false) {
      this.toggleLocation({ detail: { value: false } });
      return;
    }
    // 只在开始或恢复游览时默认开启；onShow 沿用当前开关，尊重本次手动关闭。
    this.setData({ autoplay: true, following: true });
    this.prepareDriverAlignment();
    if (!this.data.locationEnabled) this.toggleLocation({ detail: { value: true } });
    else this.watchLocation();
  },
  roomAudioActive() { const state = translation.snapshot(); return state.speaking || state.audioPlaying || Boolean(state.room && !state.room.isHost && !state.paused && (state.audioPending || !state.disconnected && (state.inputDraining || state.translationPending || ['live', 'draining'].includes(state.room.status)))); },
  syncRoomPlayback() {
    if (tourAudio.active()) return;
    if (this._syncingRoomPlayback) return;
    this._syncingRoomPlayback = true;
    try {
      if (this.roomAudioActive()) {
        if (!this._roomResume) this._roomResume = this.capturePlayback();
        if (audio.snapshot().owner === 'tour') { this.saveCheckpoint(); audio.pause(); }
      } else if (this._roomResume) {
        const previous = this._roomResume; this._roomResume = null;
        this.restorePlayback(previous);
      }
    } finally { this._syncingRoomPlayback = false; }
  },
  showLanguage() { if (this.data.busy || this.data.loading) return; this.clearArrivalPrompt(); this._dwell = null; this.setData({ tourStage: 'language', contentOpen: false, queueOpen: false, candidates: [] }); },
  enterCurrent() { if (!this.data.visit || this.data.visit.status !== 1) return this.startVisit(); this.mutate(() => this.enter(this.data.stopIndex)); },
  async mutate(action) { if (this.data.busy || this.data.loading) return; const rev = this._rev, user = this._user; let succeeded = false; this.setData({ busy: true, error: '' }); try { await action(); succeeded = true; } catch (e) { if (rev === this._rev && user === ui.userId()) ui.error(this, e); } finally { if (rev === this._rev && user === ui.userId()) { this.setData({ busy: false }); this.flushFinished(); if (succeeded) this.startNextSequence(); } } },
  flushFinished() { const key = this._pendingFinish; if (!key || this.data.driverAligning) return; if (key !== this.contextKey()) { this._pendingFinish = ''; return; } if (this.data.busy || this.data.loading || this._asking || !this._visible && !config.background || this._finishRetry && this._finishRetry.key === key && Date.now() < this._finishRetry.after) return; this._pendingFinish = ''; this.complete(2); },
  async complete(source = 1) {
    if (tourAudio.active()) { if (source === 1 && this.data.stop) await this.serverAudioCommand('complete', { stageId: this.data.stop.id }); return; }
    if (!this.data.stop || !this.data.visit || this.data.visit.status !== 1 || ['browse', 'preview'].includes(this.data.selectionMode) || this.data.busy || this.data.loading || (this.data.visit.completedStageIds || []).includes(this.data.stop.id)) return;
    const stageId = this.data.stop.id, rev = this._rev, user = this._user, key = this.contextKey();
    await this.mutate(async () => {
      let result;
      try { result = await visits.update(this.data.visit, stageId, 'complete', this.data.route, source); }
      catch (e) {
        if (source === 2 && rev === this._rev && user === ui.userId() && key === this.contextKey() && !e.code && (!e.status || e.status >= 500)) { this._pendingFinish = key; this._finishRetry = { key, after: Date.now() + 5000 }; }
        throw e;
      }
      if (rev !== this._rev || user !== ui.userId()) return;
      this._finishRetry = null;
      audio.stop('tour'); this._manualBrowse = false; this.setData({ visit: result, playing: false, browsing: false, selectionMode: 'formal', tourStage: result.status === 1 ? 'navigation' : 'overview', contentOpen: result.status === 1 && this.data.contentOpen });
      this.sequenceStatus(stageId, 'completed', this.data.stopIndex);
      this._heldVisit = result.status === 1 ? { visit: result, route: this.data.route } : null;
      storage.remove(storage.scoped(user, 'checkpoint'));
      if (result.status !== 1) { my.showToast({ content: this.data.messages.finished, type: 'success' }); return; }
      if (this.data.tourStage === 'navigation' && this.data.autoplay && (this._visible || config.background) && !this.data.contentOpen && !this.data.queueOpen && !this._asking && !this.roomAudioActive() && !this.data.lockContent && !this._userPaused) {
        const queued = this.nextSequenceIndex();
        const index = queued >= 0 ? queued : !this.data.locationEnabled ? this.data.stops.findIndex(s => !(result.completedStageIds || []).includes(s.id) && !this.data.sequence.some(item => item.id === s.id && item.status === 'skipped')) : -1;
        if (index >= 0) await this.enter(index, true, true);
      }
    });
  },
  manualComplete() { this.complete(1); },
  async endVisit() {
    if (this.data.busy || !this.data.visit) return;
    const rev = this._rev, user = this._user;
    if (!await ui.confirm(this.data.messages.end, this.data.messages.endJourneyConfirm, this.data.messages)) return;
    if (rev !== this._rev || user !== ui.userId()) return;
    await this.mutate(async () => {
      const result = await visits.abandon(this.data.visit, this.data.route);
      await tourAudio.stop();
      if (rev !== this._rev || user !== ui.userId()) return;
      this._driverAlignment = null; this._driverPositionKey = '';
      this.setData({ driverAligning: false });
      this._roomResume = null; this._resumeDriverFollowing = false; this._deferredResume = null;
      audio.stop('tour'); this.clearArrivalPrompt(); this._heldVisit = null; this._pendingFinish = ''; this._manualBrowse = false; this._userPaused = false;
      this.setData({ visit: result, browsing: true, playing: false, tourStage: 'overview', contentOpen: false, queueOpen: false, sequence: [], queuedCount: 0 });
      this.showStop(0, true);
      storage.remove(storage.scoped(user, 'checkpoint'));
      storage.remove(storage.scoped(user, 'sequence'));
      translation.leave();
    });
  },
  chooseGuide(event) { if (this.driverManaged()) return; if (this.data.busy || this.data.loading) return; const guideIndex = Number(ui.value(event)); const guide = this.data.guides[guideIndex]; if (!guide) return; const server = tourAudio.active(); this.saveCheckpoint(); if (!server) audio.stop('tour'); const chapters = tour.sorted(guide.chapters); this.setData({ guideIndex, chapters, canPlayStop: !!(chapters.length || this.data.stop && (this.data.stop.video || (this.data.stop.extraAudios || []).some(item => item && item.url))), playing: false, paused: false, playingStopId: '', hasDuration: false, timeLabel: '0:00', durationLabel: '0:00', progress: 0, itemTitle: '' }); storage.write(storage.scoped(this._user, 'guide'), guide.guideId); this.syncContext(); if (server) this.ensureServerAudio(this.data.stop.id).catch(() => {}); },
  preferences() { storage.write(storage.scoped(this._user, 'preferences'), { autoplay: this.data.autoplay, skipExtra: this.data.skipExtra, lockContent: this.data.lockContent }); this.syncServerPreferences(); },
  changeAutoplay(event) { if (this.driverManaged()) return; this.setData({ autoplay: !!ui.value(event) && this.driverRoomAvailable() }); this._dwell = null; this.preferences(); if (this.data.autoplay) this.startNextSequence(); },
  changeLock(event) { if (this.driverManaged()) return; this.setData({ lockContent: !!ui.value(event) }); this.preferences(); if (!this.data.lockContent) this.startNextSequence(); },
  changeExtra(event) { if (this.driverManaged()) return; if (this.data.busy || this.data.loading) return; this.saveCheckpoint(); if (!tourAudio.active()) audio.stop('tour'); this.setData({ skipExtra: !!ui.value(event) }); this.preferences(); },
  contextKey() { return [this._user, this.data.visit && this.data.visit.visitId, this.data.route && this.data.route.id, this.data.stop && this.data.stop.id, this.data.guides[this.data.guideIndex] && this.data.guides[this.data.guideIndex].guideId, this.data.locale, this.data.skipExtra, this.data.selectionMode].join('|'); },
  syncContext() {
    const guide = this.data.guides[this.data.guideIndex], state = audio.snapshot();
    getApp().globalData.chatContext = this.data.route ? { routeId: this.data.route.id, stageId: this.data.stop && this.data.stop.id, guideId: guide && guide.guideId, voiceId: guide && guide.providerVoiceId, routeTitle: this.data.route.title, stageName: this.data.stop && this.data.stop.name, playingChapterId: state.owner === 'tour' && state.item && state.item.kind === 'chapter' ? state.item.id : null, playingTimeSeconds: state.owner === 'tour' ? state.time : 0 } : null;
  },
  updatePlaybackProgress(state, key, title) {
    if (key !== this.contextKey() || this._user !== ui.userId()) return;
    if (state.nativeControl) this._userPaused = state.nativeControl === 'pause';
    const now = Date.now();
    const paint = progressUpdate(this._playbackPaint && this._playbackPaint.key === key ? this._playbackPaint : null, state, now);
    if (paint) {
      this._playbackPaint = Object.assign({ key }, paint);
      const values = { playing: state.playing, paused: !!state.item && !state.playing, hasDuration: state.duration > 0,
        itemTitle: title === undefined ? state.item && state.item.title || '' : title,
        timeLabel: ui.clock(state.time), durationLabel: ui.clock(state.duration),
        progress: state.duration ? Math.max(0, Math.min(100, state.time / state.duration * 100)) : 0 };
      const update = {};
      Object.keys(values).forEach(name => { if (this.data[name] !== values[name]) update[name] = values[name]; });
      if (Object.keys(update).length) this.setData(update);
    }
    this.saveCheckpoint(!state.playing);
  },
  saveCheckpoint(force = true) {
    if (tourAudio.active()) return;
    const state = audio.snapshot(), guide = this.data.guides[this.data.guideIndex];
    if (state.owner !== 'tour' || !state.item || this._extraPlayback || !this.data.visit || this.data.browsing || !guide || this._user !== ui.userId()) return;
    const now = Date.now(), key = this.contextKey() + '|' + state.generation + '|' + state.item.id;
    const previous = this._checkpointWrite;
    if (!force && previous && previous.key === key && now >= previous.at && now - previous.at < 3000 && state.time >= previous.time && state.time - previous.time < 4) return;
    try {
      storage.write(storage.scoped(this._user, 'checkpoint'), { userId: this._user, visitId: this.data.visit.visitId, routeId: this.data.route.id, stageId: this.data.stop.id, guideId: guide.guideId, locale: this.data.locale, skipExtra: this.data.skipExtra, itemId: state.item.id, time: state.time, updatedAt: now });
      this._checkpointWrite = { key, at: now, time: state.time };
    } catch (error) { diag('checkpoint-save', error.message); }
    this.syncContext();
  },
  playedKey() { return storage.scoped(this._user, 'before:' + (this.data.visit ? this.data.visit.visitId : 'preview')); },
  play(restore = false, replay = false, localCheckpoint = null) {
    if (this.driverManaged()) return;
    if ((this.serverAudioEnabled() || tourAudio.active()) && this.data.stop) {
      if (this._asking) return;
      this._serverExtraRequest = null;
      if (this._manualBrowse) {
        const stageId = this.data.stop.id;
        this.ensureServerAudio('', true).then(state => state && tourAudio.control('preview', { stageId }, state.sessionId)).then(state => state && tourAudio.setPaused(false, state.sessionId)).catch(error => { if (!error.cancelled) this.setData({ audioError: error.message }); });
        return;
      }
      this._manualBrowse = false; this._userPaused = false;
      const stageId = this.data.stop.id;
      this.ensureServerAudio(stageId).then(state => replay && state ? tourAudio.control('replay', { stageId }, state.sessionId) : state).then(state => state && tourAudio.setPaused(false, state.sessionId)).catch(error => { if (!error.cancelled) this.setData({ audioError: error.message }); });
      return;
    }
    if (!this.data.stop || (!this._visible && !config.background) || this._asking || this.roomAudioActive() || this._user !== ui.userId()) return;
    translation.yieldToTour();
    this._pendingPlayback = null;
    this._deferredResume = null;
    const guide = this.data.guides[this.data.guideIndex];
    if (!guide && !this.data.stop.video && !(this.data.stop.extraAudios || []).some(item => item && item.url)) { this.setData({ audioError: this.data.messages.noNarration }); return; }
    const items = tour.queueFor(this.data.stop, guide, { skipExtra: this.data.skipExtra, playedBefore: this.data.browsing || replay ? [] : storage.read(this.playedKey(), []) });
    const cp = restore && storage.read(storage.scoped(this._user, 'checkpoint'));
    const itemIndex = cp ? items.findIndex(i => i.id === cp.itemId) : -1;
    let checkpoint = !this.data.browsing && itemIndex >= 0 && tour.checkpointMatches(cp, this._user, this.data.visit, this.data.stop.id, guide && guide.guideId) && cp.locale === this.data.locale && cp.skipExtra === this.data.skipExtra && Date.now() - cp.updatedAt < 21600000 && cp.updatedAt <= Date.now() + 1000 ? { index: itemIndex, time: cp.time } : {};
    const localIndex = localCheckpoint && localCheckpoint.items && localCheckpoint.items[localCheckpoint.index] ? items.findIndex(item => item.id === localCheckpoint.items[localCheckpoint.index].id) : -1;
    if (localCheckpoint && localCheckpoint.key === this.contextKey() && localIndex >= 0) checkpoint = { index: localIndex, time: localCheckpoint.time };
    const key = this.contextKey(); this._extraResume = null; this._extraReturn = null; this._playbackItems = items; this._extraPlayback = false; this._userPaused = false; this.setData({ audioError: '', playingStopId: this.data.stop.id, paused: false });
    try {
      audio.playQueue('tour', items, {
        video: (item, generation) => { if (!item || key === this.contextKey()) this.updateSequenceVideo(item, generation); },
        videoControl: (command, value) => { const context = my.createVideoContext('tour-interlude-video'); if (command === 'seek') context.seek(value); else context[command](); },
        change: state => this.updatePlaybackProgress(state, key),
        itemEnded: item => { if (key === this.contextKey() && item && item.kind === 'before' && !this.data.browsing) { const played = storage.read(this.playedKey(), []); if (!played.includes(item.id)) storage.write(this.playedKey(), played.concat(item.id)); } },
        error: e => { if (key === this.contextKey()) this.setData({ audioError: e.message }); },
        finished: state => {
          if (key !== this.contextKey()) return;
          if (tour.canCompleteAudio(items, state.failed, this.data.browsing, state.completedItemIds)) { this._pendingFinish = key; this.flushFinished(); }
          else this.startNextSequence();
        }
      }, checkpoint);
    } catch (e) { this.setData({ audioError: e.message }); }
  },
  ignorePlaybackTap() {},
  togglePlay() {
    if (this.driverManaged()) return;
    if (this.data.busy || this.data.loading) return;
    if (!interruption.resumeManually()) { my.showToast({ content: '其他应用正在使用音频，请结束后重试', type: 'none' }); return; }
    const playback = audio.snapshot();
    if (tourAudio.active() && playback.owner === 'tour-extra' && playback.item) {
      if (playback.playing) audio.pause(); else if (!this._asking) audio.resume('tour-extra');
      return;
    }
    if (tourAudio.active()) {
      if (this.data.playing && !this.data.audioError && this.data.playingStopId === (this.data.stop && this.data.stop.id)) {
        tourAudio.setPaused(true).catch(error => this.setData({ audioError: error.message }));
      } else this.play(true);
      return;
    }
    if (this.roomAudioActive()) return;
    const state = audio.snapshot();
    if (state.owner === 'tour' && this.data.playingStopId && this.data.playingStopId !== (this.data.stop && this.data.stop.id)) { this.play(true); return; }
    if (state.owner === 'tour' && state.playing) { this._userPaused = true; this._resumeFromChat = false; this.saveCheckpoint(); audio.pause(); }
    else if (state.owner === 'tour' && state.item) { this._userPaused = false; audio.resume('tour'); }
    else this.play(true);
  },
  replay() { if (this.driverManaged() || this.data.busy || this.data.loading) return; storage.remove(storage.scoped(this._user, 'checkpoint')); this.play(false, true); },
  playExtra(event) { if (this.driverManaged() || this.data.busy || this.data.loading || !this.data.stop) return; const item = (this.data.stop.extraAudios || []).find(a => a.id === ui.dataset(event).id); if (!item || !item.url) return; this.saveCheckpoint(); this.playExtraItem({ id: item.id, url: item.url, title: item.title, kind: item.position }); },
  playExtraItem(item, time = 0) {
    if (this.driverManaged()) return;
    if (tourAudio.active()) {
      const request = this._serverExtraRequest = {}, key = this.contextKey();
      this.serverAudioCommand('hold').then(state => {
        const current = () => state && state.sessionId === tourAudio.snapshot().sessionId && request === this._serverExtraRequest && key === this.contextKey() && !this._asking;
        if (!current() || !this._visible) {
          if (state && state.sessionId === tourAudio.snapshot().sessionId && !this._serverExtraRequest && !this._asking) tourAudio.release(state.sessionId).catch(() => {});
          return;
        }
        request.started = true; request.sessionId = state.sessionId;
        let released = false;
        const release = () => { if (released || !current()) return; released = true; tourAudio.release(state.sessionId).catch(error => { if (!error.cancelled && current()) this.setData({ audioError: error.message }); }); };
        audio.playQueue('tour-extra', [item], {
          change: playback => { if (current()) this.updateServerExtraProgress(playback); },
          video: (video, generation) => this.updateSequenceVideo(video, generation),
          videoControl: (command, value) => { const context = my.createVideoContext('tour-interlude-video'); if (command === 'seek') context.seek(value); else context[command](); },
          finished: release,
          error: error => { if (current()) { this.setData({ audioError: error.message }); release(); } }
        }, { time });
      });
      return;
    }
    if (!this._visible || this._asking || this.roomAudioActive() || this._user !== ui.userId()) return;
    translation.yieldToTour();
    const resume = this.capturePlayback();
    if (resume && !resume.extra) this._extraResume = resume;
    const key = this.contextKey(); this._extraPlayback = true; this._playbackItems = [item]; this._userPaused = false; this.setData({ playingStopId: this.data.stop && this.data.stop.id || '', paused: false });
    try { audio.playQueue('tour', [item], {
      video: (video, generation) => { if (!video || key === this.contextKey()) this.updateSequenceVideo(video, generation); },
      videoControl: (command, value) => { const context = my.createVideoContext('tour-interlude-video'); if (command === 'seek') context.seek(value); else context[command](); },
      change: state => this.updatePlaybackProgress(state, key, item.title || ''),
      error: e => { if (key === this.contextKey()) this.setData({ audioError: e.message }); },
      finished: () => {
        if (key !== this.contextKey()) return;
        const resume = this._extraResume; this._extraResume = null;
          if (resume) { if (this._asking) this._askResume = resume; else if (!this._visible) this._extraReturn = resume; else this.restorePlayback(resume); }
        this.startNextSequence();
      }
    }, { time }); } catch (e) { this.setData({ audioError: e.message }); }
  },
  seek(event) { if (this.driverManaged()) return; const state = audio.snapshot(); if (this.data.playingStopId !== (this.data.stop && this.data.stop.id)) return; if (state.owner === 'tour-extra') { audio.seek(state.duration * Number(ui.value(event)) / 100, 'tour-extra'); return; } if (tourAudio.active()) { const current = tourAudio.snapshot().state; if (current) this.serverAudioCommand('seek', { seconds: current.itemDurationSeconds * Number(ui.value(event)) / 100 }); return; } audio.seek(state.duration * Number(ui.value(event)) / 100, 'tour'); },
  backAudio() { if (this.driverManaged()) return; if (this.data.playingStopId !== (this.data.stop && this.data.stop.id)) return; const playback = audio.snapshot(); if (playback.owner === 'tour-extra') { audio.seek(playback.time - 15, 'tour-extra'); return; } if (tourAudio.active()) { const current = tourAudio.snapshot().state; if (current) this.serverAudioCommand('seek', { seconds: Math.max(0, current.itemTimeSeconds - 15) }); return; } audio.seek(playback.time - 15, 'tour'); },
  forwardAudio() { if (this.driverManaged()) return; if (this.data.playingStopId !== (this.data.stop && this.data.stop.id)) return; const playback = audio.snapshot(); if (playback.owner === 'tour-extra') { audio.seek(playback.time + 15, 'tour-extra'); return; } if (tourAudio.active()) { const current = tourAudio.snapshot().state; if (current) this.serverAudioCommand('seek', { seconds: current.itemTimeSeconds + 15 }); return; } audio.seek(playback.time + 15, 'tour'); },
  capturePlayback() { if (tourAudio.active()) return null; const state = audio.snapshot(); const background = getApp().globalData.backgroundAudio; const wasPlaying = state.playing || state.requested || getApp().globalData.foreground === false && background && background.owner === 'tour' && background.generation === state.generation && background.playing; return state.owner === 'tour' && state.item && wasPlaying && !this._userPaused ? { key: this.contextKey(), userId: this._user, generation: state.generation, index: state.index, time: state.time, items: this._playbackItems, extra: this._extraPlayback } : null; },
  restorePlayback(snapshot) {
    if (tourAudio.active()) { if (!this._asking && !this.data.chatOpen && !this._userPaused) tourAudio.release().catch(() => {}); return true; }
    if (!snapshot || this._userPaused || snapshot.key !== this.contextKey() || snapshot.userId !== ui.userId() || this._authVersion !== undefined && this._authVersion !== auth.version()) { this._deferredResume = null; return false; }
    const state = audio.snapshot();
    if (state.owner === 'tour' && state.nativePaused) { this._userPaused = true; this._deferredResume = null; return false; }
    const item = snapshot.items && snapshot.items[snapshot.index];
    const backgroundRestore = config.background && !snapshot.extra && item && item.kind !== 'interlude-video';
    if (!this._visible && !backgroundRestore || this._asking || this.data.chatOpen || this.data.recording || this.data.transcribing || this.roomAudioActive() || state.owner && state.owner !== 'tour' && (state.playing || state.requested)) { this._deferredResume = snapshot; return false; }
    this._deferredResume = null;
    if (state.owner === 'tour' && state.playing) return true;
    if (state.owner === 'tour' && state.generation === snapshot.generation && state.item) { audio.resume('tour'); return true; }
    if (snapshot.extra && snapshot.items && snapshot.items[0]) this.playExtraItem(snapshot.items[0], snapshot.time); else this.play(true, false, snapshot);
    return true;
  },
  suspendForAsk() { this._asking = true; if (tourAudio.active()) { this._serverExtraRequest = null; audio.stop('tour-extra'); this.serverAudioCommand('hold'); audio.pause(); this.syncContext(); return; } const snapshot = this.capturePlayback(); if (snapshot) this._askResume = snapshot; this.saveCheckpoint(); this.syncContext(); if (audio.snapshot().owner === 'tour') audio.pause(); },
  resumeAfterAsk() { if (this.data.chatOpen) return; this._asking = false; if (tourAudio.active()) { tourAudio.release().catch(error => this.setData({ audioError: error.message })); return; } const snapshot = this._askResume; this._askResume = null; this._backgroundResume = null; this.restorePlayback(snapshot); this.flushFinished(); this.startNextSequence(); },
  ask() { this.suspendForAsk(); this.setData({ chatOpen: true }); },
  closeChat() { if (getApp().globalData.voiceInput === this._voice && this._voice) { this._voice.cancel(); getApp().globalData.voiceInput = null; } this.setData({ chatOpen: false }); this.resumeAfterAsk(); },
  chatInterrupt() { this.suspendForAsk(); },
  chatSettled() { this.restorePlayback(this._askResume); },
  restoreSequence() {
    const visit = this.data.visit, route = this.data.route;
    const saved = storage.read(storage.scoped(this._user, 'sequence'), {});
    const items = visit && visit.status === 1 && route && saved.visitId === visit.visitId && saved.routeId === route.id && Array.isArray(saved.items) ? saved.items : [];
    const sequence = [], seen = new Set();
    items.forEach(item => { const index = this.data.stops.findIndex(s => s.id === item.id); if (index < 0 || seen.has(item.id)) return; seen.add(item.id); sequence.push({ id: item.id, name: this.data.stops[index].name, index, status: (visit.completedStageIds || []).includes(item.id) ? 'completed' : item.status === 'skipped' ? 'skipped' : 'queued' }); });
    this.setData({ sequence, queuedCount: sequence.filter(item => item.status === 'queued').length });
    if (visit && visit.status === 1) this.data.stops.forEach((stop, index) => { if ((visit.completedStageIds || []).includes(stop.id)) this.sequenceStatus(stop.id, 'completed', index); else if (stop.id === visit.currentStageId) this.sequenceStatus(stop.id, 'queued', index); });
  },
  saveSequence() { if (this.data.visit && this.data.route && this._user === ui.userId()) storage.write(storage.scoped(this._user, 'sequence'), { routeId: this.data.route.id, visitId: this.data.visit.visitId, items: this.data.sequence, updatedAt: Date.now() }); },
  sequenceStatus(id, status, index) { if (!this.data.stops[index]) return; const items = this.data.sequence.slice(), existing = items.findIndex(item => item.id === id), item = { id, name: this.data.stops[index].name, index, status }; if (existing < 0) items.push(item); else items[existing] = item; this.setData({ sequence: items, queuedCount: items.filter(entry => entry.status === 'queued').length }); this.saveSequence(); },
  enqueueCandidates(candidates) { candidates.slice().sort((a, b) => a.distance - b.distance || a.order - b.order).forEach(candidate => { if (!this.data.sequence.some(item => item.id === candidate.id) && !(this.data.visit.completedStageIds || []).includes(candidate.id)) { this.sequenceStatus(candidate.id, 'queued', candidate.index); this.recordPrerequisiteArrival(candidate.id); } }); this.startNextSequence(); },
  recordPrerequisiteArrival(stopId) {
    if (this.serverAudioEnabled() || tourAudio.active()) return;
    const visit = this.data.visit, user = this._user;
    if (!visit || visit.status !== 1 || (visit.visitedStageIds || []).includes(stopId) || !this.data.stops.some(stop => stop.autoTriggerPrerequisiteStageId === stopId)) return;
    const writes = this._arrivalWrites || (this._arrivalWrites = new Map()), key = visit.visitId + ':' + stopId;
    if (writes.has(key)) return writes.get(key);
    const retries = this._arrivalRetries || (this._arrivalRetries = new Map());
    if (retries.has(key) && Date.now() < retries.get(key)) return;
    const write = (async () => { try {
      const result = await visits.update(visit, stopId, 'arrive', this.data.route);
      retries.delete(key);
      if (this._user !== user || user !== ui.userId() || !this.data.visit || this.data.visit.visitId !== visit.visitId) return;
      const merged = Object.assign({}, this.data.visit, { visitedStageIds: Array.from(new Set((this.data.visit.visitedStageIds || []).concat(result.visitedStageIds || []))) });
      this.setData({ visit: merged }); this._heldVisit = { visit: merged, route: this.data.route };
    } catch (e) { if (this.data.visit && this.data.visit.visitId === visit.visitId && this._user === user && user === ui.userId()) { retries.set(key, !e.code && (!e.status || e.status >= 500) ? Date.now() + 5000 : Infinity); ui.error(this, e); } }
    finally { writes.delete(key); } })();
    writes.set(key, write); return write;
  },
  nextSequenceIndex() { if (this.data.driverAligning) return -1; const visit = this.data.visit || {}; const next = this.data.sequence.find(item => item.status === 'queued' && !(visit.completedStageIds || []).includes(item.id) && this.data.stops[item.index] && this.data.stops[item.index].id === item.id && tour.canAutoTriggerStop(this.data.stops[item.index], this.data.stops, visit.visitedStageIds || visit.completedStageIds || [])); return next ? next.index : -1; },
  flushPlayback() {
    if (this.useServerScheduler()) return false;
    if (this.data.driverAligning) return false;
    const pending = this._pendingPlayback;
    if (!pending) return false;
    if (pending.key !== this.contextKey()) { this._pendingPlayback = null; return false; }
    if (this.data.tourStage !== 'navigation' || !this.data.visit || this.data.visit.status !== 1 || (!this._visible && !config.background) || this._asking || this.data.chatOpen || this.data.recording || this.data.transcribing || this.roomAudioActive() || this._userPaused || this._user !== ui.userId() || pending.automatic && (this.data.contentOpen || this.data.queueOpen || !this.data.autoplay || this.data.lockContent || this._manualBrowse)) return false;
    if (!(this.data.visit.completedStageIds || []).includes(this.data.stop.id)) this.sequenceStatus(this.data.stop.id, 'playing', this.data.stopIndex);
    this.play(true); return true;
  },
  startNextSequence() { if (this.useServerScheduler()) return; if (this._authVersion !== undefined && this._authVersion !== auth.version() || this._pendingFinish) return; if (this.data.tourStage === 'navigation' && !this.data.busy && !this.data.loading && !this.data.contentOpen && !this.data.queueOpen && this._deferredResume && this.restorePlayback(this._deferredResume)) return; if (!this.data.busy && !this.data.loading && this.flushPlayback()) return; const state = audio.snapshot(); if (this.data.tourStage !== 'navigation' || (!this._visible && !config.background) || this._asking || this._extraReturn || this.data.chatOpen || this.data.recording || this.data.transcribing || this.roomAudioActive() || this._user !== ui.userId() || this.data.busy || this.data.loading || !this.data.visit || this.data.visit.status !== 1 || !this.data.autoplay || this.data.lockContent || this.data.contentOpen || this.data.queueOpen || this._manualBrowse || this._userPaused || state.playing || state.owner === 'tour' && state.item) return; const index = this.nextSequenceIndex(), current = this.data.stop, visit = this.data.visit; if (!state.item && index !== this.data.stopIndex && !this.data.browsing && this.data.selectionMode === 'formal' && current && current.id === visit.currentStageId && !(visit.completedStageIds || []).includes(current.id) && !this._pendingPlayback) return; if (index >= 0) { const retry = this._sequenceRetry; if (retry && retry.key === this.data.visit.visitId + ':' + this.data.stops[index].id && Date.now() < retry.after) return; this.mutate(() => this.enter(index, true, true)); } },
  playQueued(event) { if (this.driverManaged()) return; const item = this.data.sequence.find(s => s.id === ui.dataset(event).id && s.status === 'queued'); if (item) { this._userPaused = false; if (!this.data.busy && this._pendingPlayback && this._pendingPlayback.key === this.contextKey() && item.id === this.data.stop.id) { this._pendingPlayback.automatic = false; this.flushPlayback(); return; } this.mutate(() => this.enter(item.index)); } },
  skipQueued(event) { if (this.driverManaged()) return; if (this.data.busy || this.data.loading) return; if (tourAudio.active()) { this.serverAudioCommand('skip', { stageId: ui.dataset(event).id }); return; } const item = this.data.sequence.find(s => s.id === ui.dataset(event).id && s.status === 'queued'); if (item) { if (this._pendingPlayback && item.id === (this.data.stop && this.data.stop.id)) { this._pendingPlayback = null; this.setData({ browsing: true, selectionMode: 'browse' }); } this.sequenceStatus(item.id, 'skipped', item.index); this.startNextSequence(); } },
  toggleLocation(event) {
    this.setData({ messages: Object.assign({}, this.data.messages, driverMessages(this.data.locale)) });
    if (this._routeMatcher) this._routeMatcher.reset();
    this.clearArrivalPrompt();
    this._followCenter = null;
    const requested = !!ui.value(event), enabled = requested && this.driverRoomAvailable();
    this.setData({ autoplay: enabled, locationEnabled: enabled, locationNote: requested && !enabled ? driverMessages(this.data.locale).driverRoomRequired : enabled ? this.data.messages.locationUnknown : this.data.messages.locationHint }); this._dwell = null; this._arrivalPreviousFix = null; this._arrivalLogged = new Set(); this._dismissedCandidates = new Set();
    if (enabled) { this.prepareDriverAlignment(); this.watchLocation(); }
    else {
      this._driverAlignment = null; this._driverPositionKey = '';
      if (this._watch) this._watch(); this._watch = null; this._fix = null;
      this.setData({ driverAligning: false, candidates: [], following: false, 'map.markers': this.data.map.markers.filter(marker => marker.id !== 0) });
    }
    this.setData({ driverManaged: this.driverManaged() });
    this.syncServerPreferences();
    if (enabled && this.serverAudioEnabled() && !this._asking) this.ensureServerAudio().then(state => state && tourAudio.setPaused(false, state.sessionId)).catch(error => { if (!error.cancelled) this.setData({ audioError: error.message }); });
  },
  watchLocation(refresh = false) {
    this.setData({ messages: Object.assign({}, this.data.messages, driverMessages(this.data.locale)) });
    if (refresh) {
      this._fix = null; this._dwell = null; this._arrivalPreviousFix = null; this.clearArrivalPrompt();
      if (this._watch && this._watch.refresh) { this._watch.refresh(); return; }
      if (this._watch) this._watch();
      this._watch = null;
    }
    if (this._watch || (!this._visible && !config.background)) return;
    const stopWatch = location.watch(fix => {
      if (!this.data.locationEnabled || this._user !== ui.userId() || this._authVersion !== undefined && this._authVersion !== auth.version()) return;
      if (fix.source === 'driver' && fix.roomId && (!this.driverRoomAvailable() || !translation.snapshot().room || fix.roomId !== translation.snapshot().room.roomId)) return;
      this._fix = fix;
      this.updateLocationMarker(fix);
      const match = this._routeMatcher.resolve(fix, this.data.map.routeLines);
      const qualityNote = fix.accuracy > 65 ? this.data.messages.locationUnknown : formatRoomMessage(this.data.messages.locationAccuracy, { accuracy: Math.round(fix.accuracy) });
      const noteKey = routeLocationKeys[match.status];
      this.setData({ locationNote: noteKey ? this.data.messages[noteKey] : qualityNote });
      diag('location-match', { status: match.status, offsetMeters: match.distanceMeters === null ? null : Math.round(match.distanceMeters), routeParts: (this.data.map.routeLines || []).length, coordinateSystem: this._detail && (this._detail.coordinateSystem || this._detail.route && this._detail.route.coordinateSystem) || 1 });
      if (this.data.following) this.followLocation(fix);
      if (this.useServerScheduler()) return;
      if (this.data.driverAligning) { this.alignDriverPosition(); return; }
      if (!this.canDetectArrival()) { this._dwell = null; this.clearArrivalPrompt(); return; }
      const now = Date.now(), usable = isUsableLocation(fix, DEFAULT_APPROACH_POLICY, now);
      if (usable) { this.flushFinished(); this.startNextSequence(); }
      if (!this.canDetectArrival()) { this._dwell = null; this.clearArrivalPrompt(); return; }
      const evaluatedFix = usable ? this._routeMatcher.arrival(fix, this.data.map.routeLines, now) : null;
      if (!usable || !evaluatedFix) {
        if (this._dwell && now - this._dwell.lastSeenAt <= ARRIVAL_GAP_MS && this._dwell.missedFrames < ARRIVAL_MAX_MISSED_FRAMES) {
          this._dwell.missedFrames += 1;
          return;
        }
        this._dwell = null; this._arrivalPreviousFix = null; this._dismissedCandidates = new Set(); this.clearArrivalPrompt(); return;
      }
      const previousArrivalFix = this._arrivalPreviousFix;
      const candidates = this.nearbyCandidates(fix, evaluatedFix, previousArrivalFix);
      this._arrivalPreviousFix = evaluatedFix;
      if (!candidates.length) { this._dwell = null; this._arrivalPreviousFix = evaluatedFix; this._arrivalLogged = new Set(); this._dismissedCandidates = new Set(); this.clearArrivalPrompt(); return; }
      if (this.data.arrivalCandidate && !candidates.some(candidate => candidate.id === this.data.arrivalCandidate.id)) this.clearArrivalPrompt();
      const previous = this._dwell && this._dwell.arrivals || new Map();
      this._dwell = { updatedAt: now, lastSeenAt: now, missedFrames: 0, arrivals: new Map(candidates.map(candidate => [candidate.id, previous.has(candidate.id) ? previous.get(candidate.id) : now])) };
      const dismissedCandidates = this._dismissedCandidates || (this._dismissedCandidates = new Set());
      Array.from(dismissedCandidates).forEach(id => { if (!candidates.some(candidate => candidate.id === id)) dismissedCandidates.delete(id); });
      const stable = candidates.filter(candidate => now - this._dwell.arrivals.get(candidate.id) >= DEFAULT_APPROACH_POLICY.dwellMs);
      if (!stable.length) return;
      const arrivalLogged = this._arrivalLogged || (this._arrivalLogged = new Set());
      stable.forEach(candidate => {
        if (arrivalLogged.has(candidate.id)) return;
        arrivalLogged.add(candidate.id);
        diag('arrival-decision', { spotId: candidate.id, distance: candidate.distance === null ? null : Math.round(candidate.distance), accuracy: Math.round(fix.accuracy), speed: previousArrivalFix && previousArrivalFix.timestamp !== evaluatedFix.timestamp ? Math.round(metersBetween(previousArrivalFix, evaluatedFix) / Math.max(0.001, (evaluatedFix.timestamp - previousArrivalFix.timestamp) / 1000) * 100) / 100 : null, source: candidate.source || 'point', dwellMs: now - this._dwell.arrivals.get(candidate.id), latencyMs: now - this._dwell.arrivals.get(candidate.id) });
      });
      stable.forEach(candidate => { if (this.data.sequence.some(item => item.id === candidate.id && item.status === 'queued')) this.recordPrerequisiteArrival(candidate.id); });
      if (!this._visible && config.background) { this.clearArrivalPrompt(); this.enqueueCandidates(stable); return; }
      if (!this.canPromptArrival()) { this.clearArrivalPrompt(); if (this.data.contentOpen || this.data.queueOpen) this.enqueueCandidates(stable); return; }
      const visible = stable.filter(candidate => !dismissedCandidates.has(candidate.id) && !this.data.sequence.some(item => item.id === candidate.id)).sort((a, b) => a.distance - b.distance || a.order - b.order).map(candidate => {
        const stop = this.data.stops[candidate.index];
        const image = (stop.images || []).find(item => item && item.url);
        return Object.assign({}, candidate, { imageUrl: image && image.url || '', distanceLabel: Number.isFinite(candidate.distance) ? Math.round(candidate.distance) + ' ' + this.data.messages.metresShort : '' });
      });
      this.setData({ candidates: visible });
      if (!this.data.arrivalCandidate && visible.length) this.showArrivalPrompt(visible[0]);
    }, error => this.locationFailed(error));
    if (this.data.locationEnabled) this._watch = stopWatch; else stopWatch();
  },
  locationFailed(error) {
    if (error.reason === 'driverRoomRequired') {
      this.toggleLocation({ detail: { value: false } });
      if (!translation.snapshot().reconnecting) translation.setFollowing(false);
      this.setData({ locationNote: driverMessages(this.data.locale).driverRoomRequired });
      return;
    }
    this._fix = null;
    this._dwell = null; this._arrivalPreviousFix = null; this._followCenter = null;
    this.clearArrivalPrompt();
    if (this._routeMatcher) this._routeMatcher.reset();
    this.setData({ locationNote: this.data.messages[error.reason] || driverMessages(this.data.locale)[error.reason] || driverMessages(this.data.locale).driverWaiting,
      'map.markers': this.data.map.markers.filter(marker => marker.id !== 0) });
  },
  canDetectArrival() { return (this._visible || config.background) && this.data.locationEnabled && this.data.tourStage === 'navigation' && this.data.route && this.data.visit && this.data.visit.status === 1 && !this.data.loading && !this.data.chatOpen && !this.data.recording && !this.data.transcribing && !this._asking && (!this.roomAudioActive() || this._fix && this._fix.source === 'driver') && this._user === ui.userId() && (this._authVersion === undefined || this._authVersion === auth.version()); },
  canPromptArrival() { return this.canDetectArrival() && this._visible && !this.data.queueOpen && !this.data.contentOpen; },
  nearbyCandidates(fix = this._fix, evaluatedFix = undefined, previousFix = this._arrivalPreviousFix) {
    const visit = this.data.visit || {}, now = Date.now();
    if (!this._routeMatcher) this._routeMatcher = createRouteMatcher({ enabled: config.routeCorrection });
    const arrivalFix = evaluatedFix === undefined ? this._routeMatcher.arrival(fix, this.data.map.routeLines, now) : evaluatedFix;
    if (!arrivalFix || this._dwell && now - this._dwell.lastSeenAt > DEFAULT_APPROACH_POLICY.maxAgeMs) this._dwell = null;
    return tour.candidates(this.data.stops, this._places || [], arrivalFix, visit.completedStageIds || [], this._detail && this._detail.coordinateSystem || 1, now, this.data.stops.findIndex(stop => stop.id === visit.currentStageId), visit.visitedStageIds || visit.completedStageIds || [], this._dwell && this._dwell.arrivals ? Array.from(this._dwell.arrivals.keys()) : [], previousFix);
  },
  clearArrivalPrompt() { clearTimeout(this._arrivalTimer); this._arrivalTimer = null; this.setData({ candidates: [], arrivalCandidate: null, arrivalCountdown: '' }); },
  showArrivalPrompt(candidate) {
    clearTimeout(this._arrivalTimer);
    const token = { id: candidate.id, routeId: this.data.route.id, visitId: this.data.visit.visitId, rev: this._rev };
    const deadline = Date.now() + 3000;
    const step = () => {
      this._arrivalTimer = null;
      if (!this.canPromptArrival() || this._rev !== token.rev || this.data.route.id !== token.routeId || this.data.visit.visitId !== token.visitId || !this.data.arrivalCandidate || this.data.arrivalCandidate.id !== token.id) { this.clearArrivalPrompt(); return; }
      const fresh = this.nearbyCandidates();
      const current = fresh.find(item => item.id === token.id);
      if (!current || this.data.sequence.some(item => item.id === token.id)) { this.clearArrivalPrompt(); return; }
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (seconds) { this.setData({ arrivalCountdown: formatRoomMessage((this.data.messages.arrivalAutoQueue || arrivalMessages(this.data.locale).arrivalAutoQueue), { seconds }) }); this._arrivalTimer = setTimeout(step, Math.min(1000, deadline - Date.now())); return; }
      const dismissed = this._dismissedCandidates || (this._dismissedCandidates = new Set());
      dismissed.add(token.id);
      this.clearArrivalPrompt(); this.enqueueCandidates([current]);
    };
    this.setData({ arrivalCandidate: candidate }); step();
  },
  cycleArrivalCandidate() { const candidates = this.data.candidates; if (candidates.length < 2) return; const index = candidates.findIndex(candidate => this.data.arrivalCandidate && candidate.id === this.data.arrivalCandidate.id); this.showArrivalPrompt(candidates[(index + 1) % candidates.length]); },
  arrivalImageError() { if (this.data.arrivalCandidate) this.setData({ 'arrivalCandidate.imageUrl': '' }); },
  enterCandidate(event) { const id = ui.dataset(event).id; if (this.data.busy || this.data.loading || !this.data.candidates.some(candidate => candidate.id === id)) return; this.clearArrivalPrompt(); this.mutate(() => this.enter(this.data.stops.findIndex(s => s.id === id))); },
  dismissCandidates() { const dismissedCandidates = this._dismissedCandidates || (this._dismissedCandidates = new Set()); (this.data.candidates || []).forEach(candidate => dismissedCandidates.add(candidate.id)); this.clearArrivalPrompt(); },
  changeImage(event) { const index = Number(event.detail && event.detail.current); if (this.data.stop && Number.isInteger(index) && index >= 0 && index < this.data.stop.images.length) this.setData({ imageIndex: index }); },
  previousImage() { this.changeImage({ detail: { current: Math.max(0, (this.data.imageIndex || 0) - 1) } }); },
  nextImage() { if (this.data.stop) this.changeImage({ detail: { current: Math.min(this.data.stop.images.length - 1, (this.data.imageIndex || 0) + 1) } }); },
  previewImages(event) { if (this.data.stop && this.data.stop.images && this.data.stop.images.length) { const index = event ? Number(ui.dataset(event).index) : this.data.imageIndex || 0; my.previewImage({ urls: this.data.stop.images.map(i => i.url), current: Number.isInteger(index) ? index : 0 }); } },
  playStopVideo() { if (this.driverManaged() || this.data.busy || this.data.loading) return; const item = tour.stopVideo(this.data.stop); if (item) { this.saveCheckpoint(); this.playExtraItem(item); } },
  startRecording() {
    if (this.data.busy || this.data.loading || this.data.chatOpen || this.data.recording || this.data.transcribing || !this.data.stop) return;
    this.cancelVoice();
    this.suspendForAsk();
    const user = ui.userId(), key = this.contextKey();
    this.setData({ recording: true, transcribing: false, cancelRecording: false, error: '' });
    let resolveVoice, rejectVoice;
    const promise = new Promise((resolve, reject) => { resolveVoice = resolve; rejectVoice = reject; });
    promise.catch(() => {});
    const voice = { userId: user, promise, state: { recording: true, transcribing: false, microphoneStarting: true }, cancel: () => { if (voice.recorder) voice.recorder.destroy(); rejectVoice(Object.assign(Error('录音已取消'), { cancelled: true })); if (getApp().globalData.cancelVoiceInput === voice.cancel) getApp().globalData.cancelVoiceInput = null; } };
    this._voice = voice;
    getApp().globalData.cancelVoiceInput = voice.cancel;
    const active = () => this._voice === voice && user === ui.userId() && key === this.contextKey();
    try {
      voice.recorder = speech.recorder((recording, transcribing) => { voice.state = { recording, transcribing, microphoneStarting: false }; if (voice.onState) voice.onState(voice.state); if (active() && this._visible && !this._handedVoice) this.setData({ recording, transcribing }); }, text => {
        if (getApp().globalData.cancelVoiceInput === voice.cancel) getApp().globalData.cancelVoiceInput = null;
        if (user !== ui.userId()) { voice.cancel(); return; }
        resolveVoice(text); voice.recorder.destroy();
      }, error => { voice.recorder.destroy(); rejectVoice(error); if (getApp().globalData.cancelVoiceInput === voice.cancel) getApp().globalData.cancelVoiceInput = null; if (active() && this._visible && !this._handedVoice) { this.setData({ recording: false, transcribing: false, error: error.message }); this.resumeAfterAsk(); } });
      this._recorder = voice.recorder;
      voice.recorder.start();
      this._handedVoice = true;
      getApp().globalData.voiceInput = voice;
      this.syncContext();
      this.setData({ recording: false, chatOpen: true });
    } catch (error) { voice.cancel(); this.setData({ recording: false, transcribing: false, error: error.message }); this.resumeAfterAsk(); }
  },
  cancelVoice() { if (this._voice && !this._handedVoice) this._voice.cancel(); this._voice = null; this._recorder = null; this._handedVoice = false; this.setData({ recording: false, transcribing: false }); },
  retry() { this.initialize(); }
});
