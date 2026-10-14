const auth = require('../../services/auth');
const http = require('../../services/http');
const storage = require('../../services/storage');
const audio = require('../../services/audio');
const speech = require('../../services/speech');
const { parseSSE, answerFrom } = require('../../core/sse');
const { toGcj02 } = require('../../shared/map-coordinates');
const ui = require('../../core/ui');
const config = require('../../config');
Page({
  data: { text: '', messages: [], sessions: [], sessionId: '', busy: false, loading: false, error: '', contextTitle: '随时提问，了解沿途的故事', recording: false, transcribing: false, cancelRecording: false, enableAudio: true, playingId: '', scrollTarget: '', voiceId: '', showSessions: false },
  onLoad() { this._seq = 0; this._files = []; },
  onShow() { this._visible = true; const context = getApp().globalData.chatContext; this.setData({ contextTitle: context ? context.routeTitle + (context.stageName ? ' · ' + context.stageName : '') : '随时提问，了解沿途的故事' }); this.initialize(); },
  onHide() { this._visible = false; this._init = (this._init || 0) + 1; this.cancel(); this.destroyRecorder(); audio.stop('chat'); speech.cleanup(this._files); this._files = []; this.setData({ playingId: '', messages: this.data.messages.map(m => Object.assign({}, m, { audioPaths: [] })) }); },
  onUnload() { this.onHide(); speech.cleanup(this._files); this._files = []; },
  async initialize() {
    const init = this._init = (this._init || 0) + 1;
    const active = () => this._visible && init === this._init;
    this.setData({ loading: true, error: '' });
    try {
      await auth.ensure(); if (!active()) return;
      const user = ui.userId();
      if (this._user !== user) { this.cancel(); this.destroyRecorder(); audio.stop('chat'); speech.cleanup(this._files); this._files = []; this._user = user; this.setData({ messages: [], sessions: [], sessionId: '', enableAudio: storage.read(storage.scoped(user, 'chatAudio'), true), voiceId: storage.read(storage.scoped(user, 'voice'), '') }); }
      this.setData({ voiceId: storage.read(storage.scoped(user, 'voice'), '') });
      const seq = this._seq; await this.loadSessions();
      if (!active() || seq !== this._seq || user !== ui.userId()) return;
      if (!this.data.sessionId) {
        const saved = storage.read(storage.scoped(user, 'chatSession'), '');
        if (this.data.sessions.some(s => s.id === saved)) await this.loadHistory(saved);
      } else await this.loadHistory(this.data.sessionId);
    } catch (e) { if (active()) ui.error(this, e); }
    finally { if (active()) this.setData({ loading: false }); }
  },
  valid(seq, user) { return this._visible && seq === this._seq && user === this._user && user === ui.userId(); },
  async loadSessions() { const user = this._user, seq = this._seq; const sessions = await http.request('/ExhibitChat/sessions'); if (this.valid(seq, user)) this.setData({ sessions: sessions || [] }); },
  async loadHistory(id) {
    this.cancel(); const seq = ++this._seq, user = this._user; this.setData({ loading: true, error: '' });
    try {
      const messages = await http.request(http.query('/ExhibitChat/history', { sessionId: id }));
      if (!this.valid(seq, user)) return;
      audio.stop('chat'); speech.cleanup(this._files); this._files = [];
      this.setData({ messages: (messages || []).map(m => Object.assign({}, m, { role: String(m.role || 'assistant').toLowerCase(), sources: m.sources || [], locations: m.locations || [], suggestions: [], audioPaths: [], domId: 'm-' + ui.uuid() })), playingId: '', sessionId: id, showSessions: false });
      storage.write(storage.scoped(user, 'chatSession'), id); this.scroll();
    } catch (e) { if (this.valid(seq, user)) ui.error(this, e); }
    finally { if (this.valid(seq, user)) this.setData({ loading: false }); }
  },
  selectSession(event) { if (!this.data.busy && !this.data.loading && !this.data.recording && !this.data.transcribing) this.loadHistory(ui.dataset(event).id); },
  toggleSessions() { if (this.data.loading || this.data.busy || this.data.recording || this.data.transcribing) return; const seq = this._seq, user = this._user; this.setData({ showSessions: !this.data.showSessions }); if (this.data.showSessions) this.loadSessions().catch(e => { if (this.valid(seq, user)) ui.error(this, e); }); },
  newSession() { if (this.data.loading) return; this.cancel(); this.destroyRecorder(); audio.stop('chat'); speech.cleanup(this._files); this._files = []; this.setData({ messages: [], sessionId: '', error: '', showSessions: false, playingId: '' }); storage.remove(storage.scoped(this._user, 'chatSession')); },
  async archiveSession(event) {
    if (this.data.busy || this.data.loading || this.data.recording || this.data.transcribing) return;
    const id = ui.dataset(event).id, user = this._user, seq = this._seq;
    if (!await ui.confirm('删除对话', '将此对话从列表移除？')) return;
    if (!this.valid(seq, user)) return;
    this.setData({ busy: true });
    try { await http.post('/ExhibitChat/archive', { id }); if (!this.valid(seq, user)) return; if (id === this.data.sessionId) this.newSession(); await this.loadSessions(); } catch (e) { if (this.valid(seq, user)) ui.error(this, e); } finally { if (this.valid(seq, user)) this.setData({ busy: false }); }
  },
  input(event) { this.setData({ text: ui.value(event) }); },
  changeAudio(event) { this.setData({ enableAudio: !!ui.value(event) }); storage.write(storage.scoped(this._user, 'chatAudio'), this.data.enableAudio); if (!this.data.enableAudio) { audio.stop('chat'); this.setData({ playingId: '' }); } },
  scroll() { const messages = this.data.messages; if (messages.length) this.setData({ scrollTarget: messages[messages.length - 1].domId }); },
  suggest(event) { this.setData({ text: ui.dataset(event).text }); this.send(); },
  async send() {
    const text = this.data.text.trim();
    if (!text || this.data.busy || this.data.loading || this.data.recording || this.data.transcribing || !this._visible) return;
    const seq = ++this._seq, user = this._user, context = getApp().globalData.chatContext || {}, clientMessageId = ui.uuid();
    audio.stop('chat'); this.setData({ busy: true, error: '', playingId: '' });
    let userMessage, answerIndex;
    try {
      await auth.ensure(); if (!this.valid(seq, user)) return;
      let id = this.data.sessionId;
      if (!id) {
        const result = await http.post('/ExhibitChat/sessions', { museumId: null, routeId: context.routeId || null, title: text.slice(0, 256) });
        if (!this.valid(seq, user)) return;
        id = typeof result === 'string' ? result : result.id;
        if (typeof id !== 'string' || !id) throw Error('创建对话失败，请重试');
        this.setData({ sessionId: id }); storage.write(storage.scoped(user, 'chatSession'), id);
      }
      userMessage = { id: clientMessageId, domId: 'm-' + clientMessageId, role: 'user', content: text, sources: [], locations: [], suggestions: [] };
      answerIndex = this.data.messages.length + 1;
      this.setData({ text: '', messages: this.data.messages.concat(userMessage, { id: 'pending-' + clientMessageId, domId: 'm-a-' + clientMessageId, role: 'assistant', content: '正在思考…', pending: true, sources: [], locations: [], suggestions: [] }) }); this.scroll();
      const voiceId = this.data.voiceId.trim() || context.voiceId || config.voiceId;
      const task = http.post('/ExhibitChat/send-with-audio', {
        sessionId: id, clientMessageId, message: text, enableAudio: this.data.enableAudio, voiceId,
        routeId: context.routeId || null, stageId: context.stageId || null, guideId: context.guideId || null, playingChapterId: context.playingChapterId || null, playingTimeSeconds: context.playingTimeSeconds || 0
      }, { dataType: 'text', headers: { Accept: 'text/event-stream' }, timeout: 120000 });
      this._task = task;
      const response = await task; if (!this.valid(seq, user)) return;
      const answer = answerFrom(parseSSE(response));
      const message = { id: answer.id || 'a-' + clientMessageId, domId: 'm-a-' + clientMessageId, role: 'assistant', content: answer.content || '暂时没有可用的回答', error: answer.error || answer.audioError, sources: answer.sources, locations: answer.locations, suggestions: answer.suggestions, audioPaths: [] };
      const messages = this.data.messages.slice(); messages[answerIndex] = message; this.setData({ messages }); this.scroll();
      if (answer.audio.length && this.data.enableAudio && !answer.error) {
        try {
          const paths = await speech.audioFiles(answer.audio, clientMessageId);
          if (!this.valid(seq, user)) { speech.cleanup(paths); return; }
          this._files.push(...paths); messages[answerIndex].audioPaths = paths; this.setData({ messages }); this.playMessage(message);
        } catch (e) { if (this.valid(seq, user)) ui.error(this, e); }
      }
      this.loadSessions().catch(() => {});
    } catch (e) {
      if (this.valid(seq, user)) {
        ui.error(this, e);
        if (answerIndex !== undefined) { const messages = this.data.messages.slice(); messages[answerIndex] = Object.assign({}, messages[answerIndex], { pending: false, content: '本次回答未完成，请查看对话历史。', error: e.message }); this.setData({ messages }); }
      }
    } finally { if (this.valid(seq, user)) { this._task = null; this.setData({ busy: false }); } }
  },
  cancel() {
    this._seq++; if (this._task) this._task.abort(); this._task = null;
    const messages = this.data.messages.map(m => m.pending ? Object.assign({}, m, { pending: false, content: '已停止等待回答，可打开对话历史查看结果。' }) : m);
    this.setData({ busy: false, loading: false, messages });
  },
  playAnswer(event) { const message = this.data.messages[Number(ui.dataset(event).index)]; if (this.data.playingId === message.id) { audio.stop('chat'); this.setData({ playingId: '' }); } else this.playMessage(message); },
  playMessage(message) {
    if (!message.audioPaths || !message.audioPaths.length || !this._visible) return;
    try { audio.playQueue('chat', message.audioPaths.map((url, i) => ({ id: message.id + '-' + i, url, kind: 'answer' })), { change: s => { if (this._visible) this.setData({ playingId: s.playing ? message.id : '' }); }, error: e => ui.error(this, e), finished: () => this.setData({ playingId: '' }) }); } catch (e) { ui.error(this, e); }
  },
  showSource(event) { const source = this.data.messages[Number(ui.dataset(event).index)].sources[Number(ui.dataset(event).source)]; if (source.imageUrl) my.previewImage({ urls: [source.imageUrl] }); else my.alert({ title: source.name || source.formalName || '资料来源', content: source.formalName || source.name || '暂无更多资料' }); },
  openLocation(event) {
    const item = this.data.messages[Number(ui.dataset(event).index)].locations[Number(ui.dataset(event).location)];
    const locations = (item.outdoorLocations || []).filter(l => typeof l.longitude === 'number' && typeof l.latitude === 'number');
    const open = location => { const point = toGcj02(location, location.coordinateSystem || 1); my.openLocation({ longitude: point.longitude, latitude: point.latitude, name: location.locationName || item.exhibitName || '', address: location.entranceName || '' }); };
    if (locations.length === 1) open(locations[0]);
    else if (locations.length > 1) my.showActionSheet({ title: '选择位置', items: locations.map(l => l.locationName || l.entranceName || '位置'), success: r => { if (r.index >= 0) open(locations[r.index]); } });
    else { const urls = (item.maps || []).filter(m => m.mapImageUrl).map(m => m.mapImageUrl); if (urls.length) my.previewImage({ urls }); else my.alert({ title: item.exhibitName || '位置', content: item.gallery ? [item.gallery.floorName, item.gallery.galleryName, item.showcaseNo].filter(Boolean).join(' · ') : '暂无可用位置' }); }
  },
  startRecording(event) {
    if (this.data.busy || this.data.loading || this.data.transcribing) return;
    this.setData({ error: '', cancelRecording: false }); audio.stop('chat');
    this._startY = event.touches && event.touches[0] && event.touches[0].clientY || 0;
    const user = this._user;
    try {
      if (!this._recorder) this._recorder = speech.recorder((recording, transcribing) => {
        if (this._visible && user === ui.userId()) this.setData({ recording, transcribing });
      }, text => {
        if (!this._visible || user !== ui.userId()) return;
        this.setData({ transcribing: false, text }); if (!text.trim()) this.setData({ error: '没有识别到语音，请重试' });
      }, e => { if (this._visible && user === ui.userId()) { this.setData({ recording: false, transcribing: false }); ui.error(this, e); } });
      this._recorder.start();
    } catch (e) { ui.error(this, e); }
  },
  moveRecording(event) { const y = event.touches && event.touches[0] && event.touches[0].clientY; if (typeof y === 'number') this.setData({ cancelRecording: this._startY - y > 60 }); },
  stopRecording() { if (this._recorder) this._recorder.stop(this.data.cancelRecording); },
  cancelTouch() { if (this._recorder) this._recorder.stop(true); this.setData({ recording: false, transcribing: false }); },
  destroyRecorder() { if (this._recorder) this._recorder.destroy(); this._recorder = null; this.setData({ recording: false, transcribing: false }); },
  microphoneHelp() { if (my.showAuthGuide) my.showAuthGuide({ authType: 'MICROPHONE' }); },
  backToTour() { my.switchTab({ url: '/pages/tour/index' }); }
});
