const auth = require('../../services/auth');
const http = require('../../services/http');
const storage = require('../../services/storage');
const visits = require('../../services/visits');
const audio = require('../../services/audio');
const speech = require('../../services/speech');
const location = require('../../services/location');
const tour = require('../../core/tour');
const ui = require('../../core/ui');
const config = require('../../config');
const translation = require('../../services/translation-session');
const { locales } = config;
const { tourMessages } = require('../../shared/tourMessages');
const { formatRoomMessage } = require('../../shared/translation-room-messages');
const { toGcj02 } = require('../../shared/map-coordinates');
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
  translationRoom() { translation.prepareEntry(this.data.locale); my.navigateTo({ url: '/pages/translation-room/index' }); },
  data: { mapSkew: 0, mapSettings: { enableBuilding: 1, tiltGesturesEnabled: 1, rotateGesturesEnabled: 1 }, messages: tourMessages('zh'), tourStage: 'language', contentOpen: false, queueOpen: false, destinationName: '', sequence: [], lockContent: false, locales, localeIndex: 0, locale: 'zh', destinations: [], destinationIndex: 0, routes: [], search: '', route: null, stops: [], stop: null, stopIndex: 0, guides: [], guideIndex: 0, chapters: [], visit: null, browsing: true, busy: false, loading: false, error: '', audioError: '', playing: false, paused: false, playingStopId: '', canPlayStop: false, hasDuration: false, timeLabel: '0:00', durationLabel: '0:00', progress: 0, itemTitle: '', autoplay: false, skipExtra: false, locationEnabled: false, following: false, showRoute: true, locationNote: '开启定位后可查看附近景点，点击播放收听讲解', candidates: [], recording: false, transcribing: false, cancelRecording: false, map: { longitude: 116.383, latitude: 39.937, markers: [], polyline: [], includePoints: [] } },
  onLoad(query = {}) { this._rev = 0; this._visible = true; this._asking = false; this._dismissedCandidates = new Set(); this._launch = { routeId: typeof query.routeId === 'string' ? query.routeId : '', destinationId: typeof query.destinationId === 'string' ? query.destinationId : '', locale: locales.some(l => l.value === query.lang) ? query.lang : '' }; this.setData({ messages: tourMessages('zh'), tourStage: 'language', contentOpen: false, sequence: [], lockContent: false, chatOpen: false, immersive: false, mapScale: 15, mapRotation: 0, mapSkew: 0 }); this.initialize(); },
  onShow() {
    this._visible = true;
    if (!this._roomSubscription) this._roomSubscription = translation.subscribe(value => { if (this._visible) this.setData({ hasTranslationRoom: Boolean(value.room) }); });
    if (this._user && (this._user !== ui.userId() || this._authVersion !== undefined && this._authVersion !== auth.version())) { this.reset(); this.initialize(); return; }
    if (this._initializing) return;
    const rememberedLocale = storage.read('locale', '');
    if (rememberedLocale && rememberedLocale !== this.data.locale) { const selected = getApp().globalData.selectedRoute; getApp().globalData.selectedRoute = ''; this.chooseLocale({ detail: { value: Math.max(0, locales.findIndex(l => l.value === rememberedLocale)) } }, selected); return; }
    const selected = getApp().globalData.selectedRoute;
    if (selected) { getApp().globalData.selectedRoute = ''; this._backgroundResume = null; this._askResume = null; this.selectRoute(selected, true); return; }
    if (this.data.locationEnabled) this.watchLocation();
    if (getApp().globalData.openChat) { getApp().globalData.openChat = false; this.ask(); return; }
    if (this._askResume) this.resumeAfterAsk();
    else if (this._backgroundResume) {
      const snapshot = this._backgroundResume; this._backgroundResume = null;
      const state = audio.snapshot();
      // 后台期间整轮已经播完时不再从头恢复；否则恢复暂停点或继续播放。
      if (!(state.owner === 'tour' && !state.playing && !state.item)) this.restorePlayback(snapshot);
    }
  },
  onHide() {
    if (this._roomSubscription) this._roomSubscription(); this._roomSubscription = null;
    this._backgroundResume = this.capturePlayback();
    this._visible = false; this.saveCheckpoint();
    if (getApp().globalData.voiceInput === this._voice && this._voice) { this._voice.cancel(); getApp().globalData.voiceInput = null; }
    if (this._recorder && !this._handedVoice) this.cancelVoice();
    this.setData({ chatOpen: false });
    this._dwell = null;
    // 后台模式保留定位轮询与讲解播放；关闭时维持“离开页面即暂停”。
    if (!config.background) {
      if (this._watch) { this._watch(); this._watch = null; }
      if (audio.snapshot().owner === 'tour') audio.pause();
    }
  },
  onUnload() { this.onHide(); if (!this._handedVoice) this.cancelVoice(); if (this._watch) { this._watch(); this._watch = null; } this._initToken = null; this._rev++; audio.stop('tour'); },
  reset() { this.cancelVoice(); this._asking = false; this._askResume = null; this._backgroundResume = null; this._initToken = null; this._initializing = false; this._manualBrowse = false; this._pendingFinish = ''; this._rev++; audio.stop('tour'); this._heldVisit = null; this._detail = null; this._places = []; this._routes = []; this._dismissedCandidates = new Set(); getApp().globalData.chatContext = null; if (this._watch) this._watch(); this._watch = null; this.setData({ tourStage: 'language', contentOpen: false, queueOpen: false, route: null, stop: null, visit: null, stops: [], guides: [], chapters: [], candidates: [], sequence: [], routes: [], busy: false, playing: false, paused: false, playingStopId: '', canPlayStop: false, hasDuration: false, chatOpen: false, locationEnabled: false, following: false, showRoute: true, map: { longitude: 116.383, latitude: 39.937, markers: [], polyline: [], includePoints: [] } }); },
  clearSelection() { if (this.data.visit && this.data.visit.status === 1) this._heldVisit = { visit: this.data.visit, route: this.data.route }; this._detail = null; this._manualBrowse = false; this._pendingFinish = ''; this.setData({ tourStage: 'overview', contentOpen: false, queueOpen: false, route: null, visit: null, stop: null, stops: [], guides: [], chapters: [], sequence: [], candidates: [], playing: false, paused: false, playingStopId: '', canPlayStop: false, hasDuration: false, itemTitle: '', progress: 0, map: { longitude: 116.383, latitude: 39.937, markers: [], polyline: [], includePoints: [] } }); this.syncContext(); },
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
      const launch = this._launch || {}, storedLocale = launch.locale || storage.read('locale', storage.read('tour-locale', ''));
      if (!locales.some(l => l.value === storedLocale)) { this.setData({ tourStage: 'language', loading: false }); return; }
      const locale = storedLocale; storage.write('locale', locale);
      const prefs = storage.read(storage.scoped(this._user, 'preferences'), {});
      storage.write('tour-locale', locale);
      this.applyLocale(locale);
      this.setData({ autoplay: false, skipExtra: !!prefs.skipExtra, lockContent: !!prefs.lockContent, tourStage: 'overview' });
      if (!await this.loadCatalog(launch.destinationId || '') || token !== this._initToken || this._user !== ui.userId()) return;
      const selected = getApp().globalData.selectedRoute || launch.routeId || storage.read(storage.scoped(this._user, 'route'), '');
      getApp().globalData.selectedRoute = '';
      this._launch = null;
      const route = this._routes.find(r => r.id === selected) || this._routes[0];
      if (route) await this.selectRoute(route.id, true);
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
    this.saveCheckpoint(); audio.stop('tour'); this._resumeFromChat = false;
    const previous = this.data.route; this.clearSelection();
    storage.write('locale', locale); storage.write('tour-locale', locale); this.applyLocale(locale); this.setData({ playing: false, tourStage: 'overview', contentOpen: false, search: '' });
    if (await this.loadCatalog()) { const next = this._routes.find(r => r.id === selectedRouteId) || this._routes.find(r => previous && (r.id === previous.id || previous.familyCode && r.familyCode === previous.familyCode)) || this._routes[0]; if (next) await this.selectRoute(next.id); }
    if (this.data.locationEnabled) this.watchLocation();
  },
  applyLocale(locale) {
    const messages = tourMessages(locale);
    const locationNote = this.data.locationEnabled && this._fix ? this._fix.accuracy > 65 ? messages.locationUnknown : formatRoomMessage(messages.locationAccuracy, { accuracy: Math.round(this._fix.accuracy) }) : messages.locationHint;
    this.setData({ locale, messages, localeIndex: Math.max(0, locales.findIndex(item => item.value === locale)), locationNote });
    if (my.setNavigationBar) my.setNavigationBar({ title: messages.tourTitle });
  },
  chooseRoute(event) { if (!this.data.busy && !this.data.loading) this.selectRoute(ui.dataset(event).id); },
  async selectRoute(id, restoreJourney = false) {
    if (!id || !this._user) return;
    this.saveCheckpoint(); audio.stop('tour'); this._resumeFromChat = false;
    if (this.data.visit && this.data.visit.status === 1) this._heldVisit = { visit: this.data.visit, route: this.data.route };
    const rev = ++this._rev, user = this._user;
    this.setData({ loading: true, error: '', audioError: '', playing: false, candidates: [] }); this._dwell = null; this._dismissedCandidates = new Set();
    try {
      const detail = await http.request(http.query('/ClientCatalog/Route', { routeId: id, locale: this.data.locale }));
      if (rev !== this._rev || user !== ui.userId()) return;
      if (!detail || !detail.route || typeof detail.route.id !== 'string' || detail.route.locale !== this.data.locale) throw Error(this.data.messages.routeUnavailable);
      const visit = await http.request(http.query('/RouteVisit/Active', { routeId: id }));
      if (rev !== this._rev || user !== ui.userId()) return;
      this._detail = detail; this._manualBrowse = false; const stops = tour.sorted(detail.stops).map((stop, index) => Object.assign({}, stop, { images: stop.images || [], displayOrder: String(index + 1).padStart(2, '0') }));
      storage.write(storage.scoped(user, 'route'), id);
      const destination = this.data.destinations.find(d => d.id === detail.route.destinationId);
      const map = sanitizeMap(tour.mapData(detail, destination, this._places)); this._fullPolyline = map.polyline;
      if (!this.data.showRoute) map.polyline = map.boundaryLines;
      this.setData({ route: detail.route, stops, visit: visit || null, map, destinationName: destination && destination.name || '', tourStage: restoreJourney && visit && visit.status === 1 ? 'navigation' : 'overview', contentOpen: false, queueOpen: false });
      this.restoreSequence();
      if (visit) { visits.remember(visit, detail.route); this._heldVisit = { visit, route: detail.route }; }
      const current = visit ? stops.findIndex(s => s.id === visit.currentStageId) : -1;
      this.showStop(current >= 0 ? current : 0, !(visit && visit.status === 1 && visit.currentStageId));
      if (this.data.tourStage === 'navigation') this.focusNavigationMap();
    } catch (e) { if (rev === this._rev) ui.error(this, e); }
    finally { if (rev === this._rev) this.setData({ loading: false }); }
  },
  showStop(index, browsing = true) {
    this.saveCheckpoint(); audio.stop('tour'); this._dwell = null; this._resumeFromChat = false;
    this._askResume = null; this._backgroundResume = null;
    const stop = this.data.stops[index] || null;
    const guides = stop ? tour.narrations(stop, this.data.locale) : [];
    const preferred = storage.read(storage.scoped(this._user, 'guide'), '');
    const guideIndex = Math.max(0, guides.findIndex(g => g.guideId === preferred));
    const chapters = tour.sorted(guides[guideIndex] && guides[guideIndex].chapters);
    const canPlayStop = !!(chapters.length || stop && (stop.extraAudios || []).some(item => item && item.url));
    this.setData({ stopIndex: index, stop, guides, guideIndex, chapters, browsing, audioError: '', playing: false, paused: false, playingStopId: '', canPlayStop, hasDuration: false, timeLabel: '0:00', durationLabel: '0:00', progress: 0, itemTitle: '' });
    this.syncContext();
  },
  browse(event) { const index = Number(ui.dataset(event).index); if (this.data.busy || this.data.loading || !this.data.stops[index]) return; if (this.data.visit && this.data.visit.status === 1) this.mutate(() => this.enter(index)); else { this._manualBrowse = true; this.showStop(index, true); } },
  browseBy(delta) { const index = this.data.stopIndex + delta; if (this.data.busy || this.data.loading || !this.data.stops[index]) return; this._manualBrowse = true; this.showStop(index, true); this.play(); },
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
    const center = finiteCoordinate(marker) || finiteCoordinate(this.data.map);
    if (!center) return;
    this.setData({ mapSkew: 50, mapScale: 18, mapRotation: 0, following: false, 'map.longitude': center.longitude, 'map.latitude': center.latitude, 'map.includePoints': [] }, () => this.mapReady());
  },
  overview() { this.setData({ following: false, mapSkew: 0, mapRotation: 0, 'map.includePoints': this.data.map.markers.map(finiteCoordinate).filter(Boolean) }); if (my.createMapContext && this.data.map.includePoints.length) my.createMapContext('tour-map').includePoints({ points: this.data.map.includePoints, padding: [30, 30, 30, 30] }); },
  recenter() { this.setData({ following: true }); if (my.createMapContext) my.createMapContext('tour-map').moveToLocation(); },
  toggleFollow() { if (!this.data.locationEnabled) return; this.setData({ following: !this.data.following, mapSkew: 50, mapScale: 18, 'map.includePoints': [] }); if (this.data.following && this._fix) this.followLocation(this._fix); },
  toggleRoute() { const showRoute = !this.data.showRoute; this.setData({ showRoute, 'map.polyline': showRoute ? (this._fullPolyline || []) : (this.data.map.boundaryLines || []) }); },
  zoomIn() { this.setData({ mapScale: Math.min(20, (this.data.mapScale || 15) + 1) }); },
  zoomOut() { this.setData({ mapScale: Math.max(5, (this.data.mapScale || 15) - 1) }); },
  toggleImmersive() { this.setData({ immersive: !this.data.immersive }); },
  followLocation(fix) { const point = fix.gcj || toGcj02(fix, 1); if (!Number.isFinite(point.longitude) || !Number.isFinite(point.latitude) || fix.accuracy > 65) return; this.setData({ 'map.longitude': point.longitude, 'map.latitude': point.latitude, 'map.includePoints': [], ...(Number.isFinite(fix.heading) ? { mapRotation: fix.heading } : {}) }); },
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
      if (!visit || visit.status !== 1) visit = await visits.start(this.data.route, this.data.locale);
      if (rev !== this._rev || user !== ui.userId()) return;
      const previousVisitId = this.data.visit && this.data.visit.visitId;
      this.setData({ visit }); this._heldVisit = { visit, route: this.data.route };
      if (previousVisitId !== visit.visitId) this.restoreSequence();
      await this.enter(this.data.stopIndex, false);
      if (rev === this._rev && user === ui.userId()) { this.setData({ tourStage: 'navigation', contentOpen: false, queueOpen: false }); this.focusNavigationMap(); }
    } catch (e) { if (rev === this._rev && user === ui.userId()) ui.error(this, e); }
    finally { if (rev === this._rev && user === ui.userId()) { this.setData({ busy: false }); this.flushFinished(); } }
  },
  async enter(index, play = true) {
    const stop = this.data.stops[index], visit = this.data.visit, rev = this._rev, user = this._user;
    if (!stop || !visit || visit.status !== 1) return;
    if ((visit.completedStageIds || []).includes(stop.id)) { this._manualBrowse = true; this.showStop(index, true); this.setData({ tourStage: 'navigation', contentOpen: true }); if (play) this.play(); return; }
    const result = await visits.update(visit, stop.id, 'start', this.data.route);
    if (rev !== this._rev || user !== ui.userId()) return;
    this.setData({ sequence: this.data.sequence.map(item => item.status === 'playing' && item.id !== stop.id ? Object.assign({}, item, { status: 'queued' }) : item) });
    this.setData({ visit: result }); this._heldVisit = { visit: result, route: this.data.route };
    this.sequenceStatus(stop.id, 'playing', index);
    this._manualBrowse = false; this.showStop(index, false); this.setData({ tourStage: 'navigation', contentOpen: play }); if (play && (this._visible || config.background)) this.play(true);
  },
  async chooseLanguage(event) {
    const index = Number(ui.dataset(event).index);
    if (!locales[index] || this.data.loading || this.data.busy) return;
    storage.write('tour-locale', locales[index].value);
    if (this._launch) { this._launch.locale = locales[index].value; await this.initialize(); }
    else { await this.chooseLocale({ detail: { value: index } }); }
  },
  backToOverview() { if (this.data.busy || this.data.loading) return; this._dwell = null; this.setData({ tourStage: 'overview', contentOpen: false, queueOpen: false, candidates: [], immersive: false }); this.overview(); },
  openContent() { if (this.data.stop) this.setData({ contentOpen: true, queueOpen: false }); },
  closeContent() { this.setData({ contentOpen: false }); },
  changeContentSwitch(event) { this.changeLock({ detail: { value: !ui.value(event) } }); },
  toggleContent() { if (this.data.contentOpen) this.closeContent(); else this.openContent(); },
  toggleQueue() { this.setData({ queueOpen: !this.data.queueOpen, contentOpen: false }); },
  closeQueue() { this.setData({ queueOpen: false }); },
  toggleTracking() { this.toggleLocation({ detail: { value: !this.data.locationEnabled } }); },
  showLanguage() { if (this.data.busy || this.data.loading) return; this._dwell = null; this.setData({ tourStage: 'language', contentOpen: false, queueOpen: false, candidates: [] }); },
  enterCurrent() { if (!this.data.visit || this.data.visit.status !== 1) return this.startVisit(); this.mutate(() => this.enter(this.data.stopIndex)); },
  async mutate(action) { if (this.data.busy || this.data.loading) return; const rev = this._rev, user = this._user; this.setData({ busy: true, error: '' }); try { await action(); } catch (e) { if (rev === this._rev && user === ui.userId()) ui.error(this, e); } finally { if (rev === this._rev && user === ui.userId()) { this.setData({ busy: false }); this.flushFinished(); } } },
  flushFinished() { const key = this._pendingFinish; this._pendingFinish = ''; if (key && key === this.contextKey() && (this._visible || config.background) && !this._asking) { if (this.data.busy) this._pendingFinish = key; else this.complete(2); } },
  async complete(source = 1) {
    if (!this.data.stop || !this.data.visit || this.data.visit.status !== 1 || this.data.browsing || this.data.busy || this.data.loading || (this.data.visit.completedStageIds || []).includes(this.data.stop.id)) return;
    const stageId = this.data.stop.id, rev = this._rev, user = this._user;
    await this.mutate(async () => {
      const result = await visits.update(this.data.visit, stageId, 'complete', this.data.route, source);
      if (rev !== this._rev || user !== ui.userId()) return;
      audio.stop('tour'); this._manualBrowse = false; this.setData({ visit: result, playing: false, browsing: true, tourStage: result.status === 1 ? 'navigation' : 'overview', contentOpen: result.status === 1 });
      this.sequenceStatus(stageId, 'completed', this.data.stopIndex);
      this._heldVisit = result.status === 1 ? { visit: result, route: this.data.route } : null;
      storage.remove(storage.scoped(user, 'checkpoint'));
      if (result.status !== 1) { my.showToast({ content: this.data.messages.finished, type: 'success' }); return; }
      if (this.data.tourStage === 'navigation' && this.data.autoplay && (this._visible || config.background) && !this._asking && !this.data.lockContent && !this._userPaused) {
        const queued = this.nextSequenceIndex();
        const index = queued >= 0 ? queued : !this.data.locationEnabled ? this.data.stops.findIndex(s => !(result.completedStageIds || []).includes(s.id) && !this.data.sequence.some(item => item.id === s.id && item.status === 'skipped')) : -1;
        if (index >= 0) await this.enter(index);
      }
    });
  },
  manualComplete() { this.complete(1); },
  async endVisit() {
    if (this.data.busy || !this.data.visit) return;
    const rev = this._rev, user = this._user;
    if (!await ui.confirm(this.data.messages.end, this.data.messages.endJourneyConfirm, this.data.messages)) return;
    if (rev !== this._rev || user !== ui.userId()) return;
    this.mutate(async () => { const result = await visits.abandon(this.data.visit, this.data.route); if (rev !== this._rev || user !== ui.userId()) return; audio.stop('tour'); this._heldVisit = null; this.setData({ visit: result, browsing: true, playing: false, tourStage: 'overview', contentOpen: false }); storage.remove(storage.scoped(this._user, 'checkpoint')); });
  },
  chooseGuide(event) { if (this.data.busy || this.data.loading) return; const guideIndex = Number(ui.value(event)); const guide = this.data.guides[guideIndex]; if (!guide) return; this.saveCheckpoint(); audio.stop('tour'); const chapters = tour.sorted(guide.chapters); this.setData({ guideIndex, chapters, canPlayStop: !!(chapters.length || this.data.stop && (this.data.stop.extraAudios || []).some(item => item && item.url)), playing: false, paused: false, playingStopId: '', hasDuration: false, timeLabel: '0:00', durationLabel: '0:00', progress: 0, itemTitle: '' }); storage.write(storage.scoped(this._user, 'guide'), guide.guideId); this.syncContext(); },
  preferences() { storage.write(storage.scoped(this._user, 'preferences'), { autoplay: this.data.autoplay, skipExtra: this.data.skipExtra, lockContent: this.data.lockContent }); },
  changeAutoplay(event) { this.setData({ autoplay: !!ui.value(event) }); this._dwell = null; this.preferences(); if (this.data.autoplay) this.startNextSequence(); },
  changeLock(event) { this.setData({ lockContent: !!ui.value(event) }); this.preferences(); if (!this.data.lockContent) this.startNextSequence(); },
  changeExtra(event) { if (this.data.busy || this.data.loading) return; this.saveCheckpoint(); audio.stop('tour'); this.setData({ skipExtra: !!ui.value(event), playing: false }); this.preferences(); },
  contextKey() { return [this._user, this.data.visit && this.data.visit.visitId, this.data.route && this.data.route.id, this.data.stop && this.data.stop.id, this.data.guides[this.data.guideIndex] && this.data.guides[this.data.guideIndex].guideId, this.data.locale, this.data.skipExtra, this.data.browsing].join('|'); },
  syncContext() {
    const guide = this.data.guides[this.data.guideIndex], state = audio.snapshot();
    getApp().globalData.chatContext = this.data.route ? { routeId: this.data.route.id, stageId: this.data.stop && this.data.stop.id, guideId: guide && guide.guideId, voiceId: guide && guide.providerVoiceId, routeTitle: this.data.route.title, stageName: this.data.stop && this.data.stop.name, playingChapterId: state.owner === 'tour' && state.item && state.item.kind === 'chapter' ? state.item.id : null, playingTimeSeconds: state.owner === 'tour' ? state.time : 0 } : null;
  },
  saveCheckpoint() {
    const state = audio.snapshot(), guide = this.data.guides[this.data.guideIndex];
    if (state.owner !== 'tour' || !state.item || this._extraPlayback || !this.data.visit || this.data.browsing || !guide || this._user !== ui.userId()) return;
    storage.write(storage.scoped(this._user, 'checkpoint'), { userId: this._user, visitId: this.data.visit.visitId, routeId: this.data.route.id, stageId: this.data.stop.id, guideId: guide.guideId, locale: this.data.locale, skipExtra: this.data.skipExtra, itemId: state.item.id, time: state.time, updatedAt: Date.now() });
    this.syncContext();
  },
  playedKey() { return storage.scoped(this._user, 'before:' + (this.data.visit ? this.data.visit.visitId : 'preview')); },
  play(restore = false, replay = false, localCheckpoint = null) {
    if (!this.data.stop || (!this._visible && !config.background) || this._asking || this._user !== ui.userId()) return;
    const guide = this.data.guides[this.data.guideIndex];
    if (!guide) { this.setData({ audioError: this.data.messages.noNarration }); return; }
    const items = tour.queueFor(this.data.stop, guide, { skipExtra: this.data.skipExtra, playedBefore: this.data.browsing || replay ? [] : storage.read(this.playedKey(), []) });
    const cp = restore && storage.read(storage.scoped(this._user, 'checkpoint'));
    const itemIndex = cp ? items.findIndex(i => i.id === cp.itemId) : -1;
    let checkpoint = !this.data.browsing && itemIndex >= 0 && tour.checkpointMatches(cp, this._user, this.data.visit, this.data.stop.id, guide.guideId) && cp.locale === this.data.locale && cp.skipExtra === this.data.skipExtra && Date.now() - cp.updatedAt < 21600000 && cp.updatedAt <= Date.now() + 1000 ? { index: itemIndex, time: cp.time } : {};
    const localIndex = localCheckpoint && localCheckpoint.items && localCheckpoint.items[localCheckpoint.index] ? items.findIndex(item => item.id === localCheckpoint.items[localCheckpoint.index].id) : -1;
    if (localCheckpoint && localCheckpoint.key === this.contextKey() && localIndex >= 0) checkpoint = { index: localIndex, time: localCheckpoint.time };
    const key = this.contextKey(); this._playbackItems = items; this._extraPlayback = false; this._userPaused = false; this.setData({ audioError: '', playingStopId: this.data.stop.id, paused: false });
    try {
      audio.playQueue('tour', items, {
        change: state => { if (key !== this.contextKey()) return; this.setData({ playing: state.playing, paused: !!state.item && !state.playing, hasDuration: state.duration > 0, itemTitle: state.item && state.item.title || '', timeLabel: ui.clock(state.time), durationLabel: ui.clock(state.duration), progress: state.duration ? Math.min(100, state.time / state.duration * 100) : 0 }); this.saveCheckpoint(); },
        itemEnded: item => { if (key === this.contextKey() && item && item.kind === 'before' && !this.data.browsing) { const played = storage.read(this.playedKey(), []); if (!played.includes(item.id)) storage.write(this.playedKey(), played.concat(item.id)); } },
        error: e => { if (key === this.contextKey()) this.setData({ audioError: e.message }); },
        finished: state => { if (key === this.contextKey() && (this._visible || config.background) && !this._asking && tour.canCompleteAudio(items, state.failed, this.data.browsing)) { if (this.data.busy) this._pendingFinish = key; else this.complete(2); } }
      }, checkpoint);
    } catch (e) { this.setData({ audioError: e.message }); }
  },
  togglePlay() { if (this.data.busy || this.data.loading) return; const state = audio.snapshot(); if (state.owner === 'tour' && this.data.playingStopId && this.data.playingStopId !== (this.data.stop && this.data.stop.id)) { this.play(true); return; } if (state.owner === 'tour' && state.playing) { this._userPaused = true; this._resumeFromChat = false; this.saveCheckpoint(); audio.pause(); } else if (state.owner === 'tour' && state.item) { this._userPaused = false; audio.resume('tour'); } else this.play(true); },
  replay() { if (this.data.busy || this.data.loading) return; storage.remove(storage.scoped(this._user, 'checkpoint')); this.play(false, true); },
  playExtra(event) { if (this.data.busy || this.data.loading || !this.data.stop) return; const item = (this.data.stop.extraAudios || []).find(a => a.id === ui.dataset(event).id); if (!item || !item.url) return; this.saveCheckpoint(); this.playExtraItem({ id: item.id, url: item.url, title: item.title, kind: item.position }); },
  playExtraItem(item, time = 0) {
    const key = this.contextKey(); this._extraPlayback = true; this._playbackItems = [item]; this._userPaused = false; this.setData({ playingStopId: this.data.stop && this.data.stop.id || '', paused: false });
    try { audio.playQueue('tour', [item], {
      change: state => { if (key === this.contextKey()) this.setData({ playing: state.playing, paused: !!state.item && !state.playing, hasDuration: state.duration > 0, itemTitle: item.title || '', timeLabel: ui.clock(state.time), durationLabel: ui.clock(state.duration), progress: state.duration ? state.time / state.duration * 100 : 0 }); },
      error: e => { if (key === this.contextKey()) this.setData({ audioError: e.message }); }
    }, { time }); } catch (e) { this.setData({ audioError: e.message }); }
  },
  seek(event) { const state = audio.snapshot(); if (this.data.playingStopId !== (this.data.stop && this.data.stop.id)) return; audio.seek(state.duration * Number(ui.value(event)) / 100, 'tour'); },
  backAudio() { if (this.data.playingStopId !== (this.data.stop && this.data.stop.id)) return; audio.seek(audio.snapshot().time - 15, 'tour'); },
  forwardAudio() { if (this.data.playingStopId !== (this.data.stop && this.data.stop.id)) return; audio.seek(audio.snapshot().time + 15, 'tour'); },
  capturePlayback() { const state = audio.snapshot(); const background = getApp().globalData.backgroundAudio; const wasPlaying = state.playing || getApp().globalData.foreground === false && background && background.owner === 'tour' && background.generation === state.generation && background.playing; return state.owner === 'tour' && state.item && wasPlaying && !this._userPaused ? { key: this.contextKey(), userId: this._user, generation: state.generation, index: state.index, time: state.time, items: this._playbackItems, extra: this._extraPlayback } : null; },
  restorePlayback(snapshot) { if (!snapshot || !this._visible || this._userPaused || snapshot.key !== this.contextKey() || snapshot.userId !== ui.userId()) return; const state = audio.snapshot(); if (state.owner === 'tour' && state.playing) return; if (state.owner === 'tour' && state.generation === snapshot.generation && state.item) { audio.resume('tour'); return; } if (snapshot.extra && snapshot.items && snapshot.items[0]) this.playExtraItem(snapshot.items[0], snapshot.time); else this.play(true, false, snapshot); },
  suspendForAsk() { this._asking = true; const snapshot = this.capturePlayback(); if (snapshot) this._askResume = snapshot; this.saveCheckpoint(); this.syncContext(); if (audio.snapshot().owner === 'tour') audio.pause(); },
  resumeAfterAsk() { if (this.data.chatOpen) return; this._asking = false; const snapshot = this._askResume; this._askResume = null; this._backgroundResume = null; this.restorePlayback(snapshot); },
  ask() { this.suspendForAsk(); this.setData({ chatOpen: true }); },
  closeChat() { if (getApp().globalData.voiceInput === this._voice && this._voice) { this._voice.cancel(); getApp().globalData.voiceInput = null; } this.setData({ chatOpen: false }); this.resumeAfterAsk(); },
  chatInterrupt() { this.suspendForAsk(); },
  chatSettled() { this.restorePlayback(this._askResume); },
  restoreSequence() {
    const visit = this.data.visit, route = this.data.route;
    const saved = storage.read(storage.scoped(this._user, 'sequence'), {});
    const items = visit && route && saved.visitId === visit.visitId && saved.routeId === route.id && Array.isArray(saved.items) ? saved.items : [];
    const sequence = [], seen = new Set();
    items.forEach(item => { const index = this.data.stops.findIndex(s => s.id === item.id); if (index < 0 || seen.has(item.id)) return; seen.add(item.id); sequence.push({ id: item.id, name: this.data.stops[index].name, index, status: (visit.completedStageIds || []).includes(item.id) ? 'completed' : item.status === 'skipped' ? 'skipped' : 'queued' }); });
    this.setData({ sequence });
    if (visit) this.data.stops.forEach((stop, index) => { if ((visit.completedStageIds || []).includes(stop.id)) this.sequenceStatus(stop.id, 'completed', index); else if (stop.id === visit.currentStageId && visit.status === 1) this.sequenceStatus(stop.id, 'playing', index); });
  },
  saveSequence() { if (this.data.visit && this.data.route && this._user === ui.userId()) storage.write(storage.scoped(this._user, 'sequence'), { routeId: this.data.route.id, visitId: this.data.visit.visitId, items: this.data.sequence, updatedAt: Date.now() }); },
  sequenceStatus(id, status, index) { if (!this.data.stops[index]) return; const items = this.data.sequence.slice(), existing = items.findIndex(item => item.id === id), item = { id, name: this.data.stops[index].name, index, status }; if (existing < 0) items.push(item); else items[existing] = item; this.setData({ sequence: items }); this.saveSequence(); },
  enqueueCandidates(candidates) { candidates.slice().sort((a, b) => a.distance - b.distance || a.order - b.order).forEach(candidate => { if (!this.data.sequence.some(item => item.id === candidate.id) && !(this.data.visit.completedStageIds || []).includes(candidate.id)) this.sequenceStatus(candidate.id, 'queued', candidate.index); }); this.startNextSequence(); },
  nextSequenceIndex() { const next = this.data.sequence.find(item => item.status === 'queued' && !(this.data.visit && this.data.visit.completedStageIds || []).includes(item.id)); return next ? next.index : -1; },
  startNextSequence() { if (this.data.tourStage !== 'navigation' || (!this._visible && !config.background) || this._asking || this._user !== ui.userId() || this.data.busy || this.data.loading || !this.data.visit || this.data.visit.status !== 1 || !this.data.autoplay || this.data.lockContent || this._manualBrowse || this._userPaused || audio.snapshot().playing || !this.data.browsing) return; const index = this.nextSequenceIndex(); if (index >= 0) this.mutate(() => this.enter(index)); },
  playQueued(event) { const item = this.data.sequence.find(s => s.id === ui.dataset(event).id && s.status === 'queued'); if (item) { this._userPaused = false; this.mutate(() => this.enter(item.index)); } },
  skipQueued(event) { if (this.data.busy || this.data.loading) return; const item = this.data.sequence.find(s => s.id === ui.dataset(event).id && s.status === 'queued'); if (item) { this.sequenceStatus(item.id, 'skipped', item.index); this.startNextSequence(); } },
  toggleLocation(event) {
    const enabled = !!ui.value(event); this.setData({ locationEnabled: enabled }); this._dwell = null; this._dismissedCandidates = new Set();
    if (enabled) this.watchLocation(); else { if (this._watch) this._watch(); this._watch = null; this.setData({ candidates: [], following: false }); }
  },
  watchLocation() {
    if (this._watch || (!this._visible && !config.background)) return;
    const stopWatch = location.watch(fix => {
      this._fix = fix; this.setData({ locationNote: fix.accuracy > 65 ? this.data.messages.locationUnknown : formatRoomMessage(this.data.messages.locationAccuracy, { accuracy: Math.round(fix.accuracy) }) });
      if (this.data.following) this.followLocation(fix);
      if (this.data.tourStage !== 'navigation' || !this.data.route || !this.data.visit || this.data.visit.status !== 1 || this.data.busy || this.data.loading || this.data.chatOpen || this.data.recording || this.data.transcribing || this._asking || (!this._visible && !config.background) || this._user !== ui.userId()) { this._dwell = null; return; }
      const candidates = tour.candidates(this.data.stops, this._places || [], fix, this.data.visit.completedStageIds || [], this._detail.coordinateSystem || 1, Date.now(), this.data.stops.findIndex(s => s.id === this.data.visit.currentStageId));
      const key = candidates.map(c => c.id).join('|');
      if (!key) { this._dwell = null; this._dismissedCandidates = new Set(); this.setData({ candidates: [] }); return; }
      if (!this._dwell || this._dwell.key !== key) { this._dwell = { key, at: Date.now() }; return; }
      if (Date.now() - this._dwell.at < 1500) return;
      const dismissedCandidates = this._dismissedCandidates || (this._dismissedCandidates = new Set());
      const visible = candidates.filter(candidate => !dismissedCandidates.has(candidate.id)).map(candidate => Object.assign({}, candidate, { distanceLabel: Number.isFinite(candidate.distance) ? Math.round(candidate.distance) + ' ' + this.data.messages.metresShort : '' }));
      this.setData({ candidates: visible }); this.enqueueCandidates(candidates);
    }, e => { this._dwell = null; this.setData({ locationNote: e.denied ? this.data.messages.permissionDenied : this.data.messages.locationFailed, candidates: [], locationEnabled: !e.denied }); if (e.denied) this._watch = null; });
    if (this.data.locationEnabled) this._watch = stopWatch; else stopWatch();
  },
  enterCandidate(event) { const id = ui.dataset(event).id; if (!this.data.candidates.some(candidate => candidate.id === id)) return; this.dismissCandidates(); this.mutate(() => this.enter(this.data.stops.findIndex(s => s.id === id))); },
  dismissCandidates() { const dismissedCandidates = this._dismissedCandidates || (this._dismissedCandidates = new Set()); (this.data.candidates || []).forEach(candidate => dismissedCandidates.add(candidate.id)); this.setData({ candidates: [] }); },
  previewImages() { if (this.data.stop && this.data.stop.images && this.data.stop.images.length) my.previewImage({ urls: this.data.stop.images.map(i => i.url) }); },
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
