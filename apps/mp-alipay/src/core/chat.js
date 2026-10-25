const auth = require('../services/auth');
const http = require('../services/http');
const storage = require('../services/storage');
const audio = require('../services/audio');
const speech = require('../services/speech');
const { sendChat } = require('../services/chat-run');
const { markdownNodes } = require('./markdown');
const bargeIn = require('../services/barge-in');
const { diag } = require('../services/diag');
const { toGcj02 } = require('../shared/map-coordinates');
const ui = require('./ui');
const config = require('../config');
module.exports = function createChat() { return {
  data: { text: '', messages: [], sessions: [], sessionId: '', busy: false, loading: false, error: '', contextTitle: '随时提问，了解沿途的故事', recording: false, transcribing: false, cancelRecording: false, enableAudio: true, mode: 'voice', playingId: '', scrollTarget: '', voiceId: '', showSessions: false, caption: '', captionProgress: 0, bargeInEnabled: false, bargeInSupported: false, expanded: false, embedded: false, transport: 'buffered' },
  onLoad() { this._seq = 0; this._files = []; this.setData({ microphoneStarting: false, bargeInSupported: bargeIn.supported() }); },
  onShow() {
    this._visible = true;
    this.setData({ busy: false, loading: false, recording: false, microphoneStarting: false, transcribing: false, playingId: '', caption: '', messages: this.data.messages.map(message => Object.assign({}, message, { pending: false, audioPaths: [] })) });
    const show = this._show = (this._show || 0) + 1, app = getApp(), context = app.globalData.chatContext;
    const handoff = app.globalData.voiceInput;
    if (handoff) app.globalData.voiceInput = null;
    const draft = app.globalData.chatDraft;
    app.globalData.chatDraft = null;
    this.setData({ contextTitle: context ? context.routeTitle + (context.stageName ? ' · ' + context.stageName : '') : '随时提问，了解沿途的故事', ...(draft && draft.userId === ui.userId() ? { text: draft.text || '' } : {}) });
    const ready = this.initialize();
    if (handoff && handoff.userId === ui.userId()) {
      this._voiceHandoff = handoff;
      handoff.onState = state => {
        if (this._visible && this._voiceHandoff === handoff && handoff.userId === ui.userId()) this.setData(state);
      };
      this.setData(Object.assign({ mode: 'voice' }, handoff.state || { transcribing: true }));
      Promise.all([ready, handoff.promise]).then(([initialized, text]) => {
        if (!this._visible || show !== this._show || handoff.userId !== ui.userId() || this._voiceHandoff !== handoff) return;
        this._voiceHandoff = null; this.setData({ recording: false, microphoneStarting: false, transcribing: false, text });
        if (!initialized) return;
        if (text.trim()) this.send(text); else this.setData({ error: '没有识别到语音，请重试' });
      }).catch(error => { if (this._visible && show === this._show && handoff.userId === ui.userId() && this._voiceHandoff === handoff) { this._voiceHandoff = null; this.setData({ recording: false, microphoneStarting: false, transcribing: false, error: error.message }); } });
    } else { if (handoff) handoff.cancel(); }
  },
  onHide() { this._visible = false; this._show = (this._show || 0) + 1; this._init = (this._init || 0) + 1; if (this._voiceHandoff) this._voiceHandoff.cancel(); this._voiceHandoff = null; this.cancel(true); this.destroyRecorder(true); this.stopBargeIn(); audio.stop('chat'); speech.cleanup(this._files); this._files = []; },
  onUnload() { this.onHide(); speech.cleanup(this._files); this._files = []; },
  async initialize() {
    const init = this._init = (this._init || 0) + 1;
    const active = () => this._visible && init === this._init;
    this.setData({ loading: true, error: '' });
    try {
      await auth.ensure(); if (!active()) return;
      const user = ui.userId();
      if (this._user !== user) { this.cancel(); this.destroyRecorder(false, !!this._voiceHandoff && this._voiceHandoff.userId === user); audio.stop('chat'); speech.cleanup(this._files); this._files = []; this._user = user; this.setData({ messages: [], sessions: [], sessionId: '', enableAudio: storage.read(storage.scoped(user, 'chatAudio'), true), voiceId: storage.read(storage.scoped(user, 'voice'), '') }); }
      this.setData({ voiceId: storage.read(storage.scoped(user, 'voice'), '') });
      if (this._voiceHandoff && this._voiceHandoff.userId === user) this.setData(this._voiceHandoff.state || { transcribing: true });
      const seq = this._seq; await this.loadSessions();
      if (!active() || seq !== this._seq || user !== ui.userId()) return;
      if (!this.data.sessionId) {
        const saved = storage.read(storage.scoped(user, 'chatSession'), '');
        if (this.data.sessions.some(s => s.id === saved) && !await this.loadHistory(saved)) return false;
      } else if (!await this.loadHistory(this.data.sessionId)) return false;
      return active() && user === ui.userId();
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
      this.setData({ messages: (messages || []).map(m => Object.assign({}, m, { role: String(m.role || 'assistant').toLowerCase(), nodes: markdownNodes(m.content), sources: m.sources || [], locations: m.locations || [], suggestions: [], audioPaths: [], audioTexts: [], domId: 'm-' + ui.uuid() })), playingId: '', sessionId: id, showSessions: false });
      storage.write(storage.scoped(user, 'chatSession'), id); this.scroll();
      return true;
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
  toggleMode(event) { const mode = ui.dataset(event).mode; if (mode !== 'voice' && mode !== 'text') return; if (mode === 'text') this.cancelTouch(); this.setData({ mode }); },
  changeAudio(event) { this.setData({ enableAudio: !!ui.value(event) }); storage.write(storage.scoped(this._user, 'chatAudio'), this.data.enableAudio); if (!this.data.enableAudio) { if (this._playbackTask) this._playbackTask.mute(); this.stopBargeIn(); audio.stop('chat'); this.setData({ playingId: '', caption: '' }); this.settleTour(); } },
  scroll() { const messages = this.data.messages; if (messages.length) this.setData({ scrollTarget: messages[messages.length - 1].domId }); },
  suggest(event) { const text = ui.dataset(event).text; this.setData({ text }); this.send(text); },
  async send(overrideText) {
    const text = (typeof overrideText === 'string' ? overrideText : this.data.text).trim();
    if (!text || this.data.busy || this.data.loading || this.data.recording || this.data.transcribing || !this._visible) return;
    this.interruptTour();
    this.stopBargeIn();
    const seq = ++this._seq, user = this._user, context = Object.assign({}, getApp().globalData.chatContext || {}), clientMessageId = ui.uuid();
    audio.stop('chat'); this.setData({ busy: true, error: '', playingId: '', caption: '', captionProgress: 0 });
    let answerIndex;
    const answerId = 'a-' + clientMessageId;
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
      answerIndex = this.data.messages.length + 1;
      this.setData({ text: '', messages: this.data.messages.concat(
        { id: clientMessageId, domId: 'm-' + clientMessageId, role: 'user', content: text, sources: [], locations: [], suggestions: [] },
        { id: answerId, domId: 'm-' + answerId, role: 'assistant', content: '正在思考…', pending: true, sources: [], locations: [], suggestions: [], audioPaths: [], audioTexts: [] }
      ) }); this.scroll();
      const update = fields => {
        if (!this.valid(seq, user)) return;
        const messages = this.data.messages.slice();
        messages[answerIndex] = Object.assign({}, messages[answerIndex], fields);
        this.setData({ messages }); this.scroll();
      };
      const task = sendChat({
        sessionId: id, clientMessageId, message: text, enableAudio: this.data.enableAudio,
        voiceId: this.data.voiceId.trim() || context.voiceId || config.voiceId,
        routeId: context.routeId || null, stageId: context.stageId || null, guideId: context.guideId || null,
        playingChapterId: context.playingChapterId || null, playingTimeSeconds: context.playingTimeSeconds || 0
      }, {
        active: () => this.valid(seq, user),
        update: (answer, streaming) => {
          update({ content: answer.content || '正在思考…', nodes: markdownNodes(answer.content), sources: answer.sources, locations: answer.locations, suggestions: answer.suggestions, pending: !answer.done, error: answer.error || answer.audioError, retryText: answer.error ? text : '' });
          if (streaming) this.setData({ transport: 'streaming' });
        },
        files: (path, caption) => {
          this._files.push(path);
          const message = this.data.messages[answerIndex];
          update({ audioPaths: message.audioPaths.concat(path), audioTexts: message.audioTexts.concat(caption) });
        },
        playback: state => {
          if (!this.valid(seq, user)) return;
          this.setData({ playingId: state.playing ? answerId : '', caption: state.playing && state.item ? state.item.text || '' : '', captionProgress: state.duration ? Math.round(state.time / state.duration * 100) : 0 });
          if (state.playing) this.startBargeIn(); else this.stopBargeIn();
        },
        audioError: error => { if (this.valid(seq, user)) { this.stopBargeIn(); this.setData({ error: error.message, playingId: '', caption: '' }); } },
        settled: () => { this.stopBargeIn(); if (this._visible && this.valid(seq, user)) this.setData({ playingId: '', caption: '' }); this.settleTour(); }
      });
      this._task = task; this._playbackTask = task;
      const result = await task;
      if (!this.valid(seq, user) || !result) return;
      update({ pending: false, retryText: result.answer.error ? text : '' });
      this.loadSessions().catch(() => {});
    } catch (error) {
      if (this.valid(seq, user)) {
        ui.error(this, error);
        if (answerIndex !== undefined) {
          const messages = this.data.messages.slice();
          messages[answerIndex] = Object.assign({}, messages[answerIndex], { pending: false, error: error.message, retryText: text });
          this.setData({ messages });
        }
      }
    } finally {
      if (this.valid(seq, user)) { this._task = null; this.setData({ busy: false }); if (!audio.snapshot().playing) this.settleTour(); }
    }
  },
  retry(event) { const message = this.data.messages[Number(ui.dataset(event).index)]; if (!message || !message.retryText || this.data.busy) return; this.setData({ text: message.retryText }); this.send(message.retryText); },
  cancel(silent = false) {
    const hadRun = !!(this._task || this._playbackTask || this.data.playingId);
    this._seq++; if (this._task) this._task.abort(); this._task = null;
    if (this._playbackTask) this._playbackTask.abort(); this._playbackTask = null;
    this.stopBargeIn(); audio.stop('chat');
    const messages = this.data.messages.map(m => m.pending ? Object.assign({}, m, { pending: false, content: '已停止等待回答，可打开对话历史查看结果。' }) : m);
    if (silent !== true && this._visible) this.setData({ busy: false, loading: false, messages, playingId: '', caption: '' });
    if (hadRun) this.settleTour();
  },
  playAnswer(event) { const message = this.data.messages[Number(ui.dataset(event).index)]; if (!message) return; if (this.data.playingId === message.id) { if (this._playbackTask) this._playbackTask.mute(); this.stopBargeIn(); audio.stop('chat'); this.setData({ playingId: '', caption: '' }); this.settleTour(); } else if (!this.data.busy) this.playMessage(message); },
  playMessage(message) {
    if (!message.audioPaths || !message.audioPaths.length || !this._visible) return;
    this.interruptTour();
    try { audio.playQueue('chat', message.audioPaths.map((url, index) => ({ id: message.id + '-' + index, url, text: (message.audioTexts || [])[index] || '', kind: 'answer' })), {
      change: state => { if (!this._visible) return; this.setData({ playingId: state.playing ? message.id : '', caption: state.playing && state.item ? state.item.text || '' : '', captionProgress: state.duration ? Math.round(state.time / state.duration * 100) : 0 }); if (state.playing) this.startBargeIn(); else this.stopBargeIn(); },
      error: error => { if (!this._visible) return; this.stopBargeIn(); ui.error(this, error); this.setData({ playingId: '', caption: '' }); this.settleTour(); },
      finished: () => { if (!this._visible) return; this.stopBargeIn(); this.setData({ playingId: '', caption: '' }); this.settleTour(); }
    }); } catch (error) { if (this._visible) ui.error(this, error); }
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
  toggleRecording() { if (this.data.recording) this.stopRecording(); else if (!this.data.transcribing) return this.startRecording(); },
  async startRecording() {
    diag('mic', { event: 'press', mode: this.data.mode, loading: !!this.data.loading, transcribing: !!this.data.transcribing, recording: !!this.data.recording, visible: !!this._visible });
    if (this.data.loading || this.data.transcribing || this.data.recording) { diag('mic', { event: 'ignored' }); return; }
    const press = this._press = {};
    this.cancel(); this.interruptTour();
    this.setData({ error: '', text: '', cancelRecording: false, recording: true, microphoneStarting: true }); audio.stop('chat');
    const user = this._user;
    try {
      if (this._bargeStopping) await this._bargeStopping;
      if (this._press !== press || !this._visible || user !== ui.userId()) { diag('mic', { event: 'aborted' }); return; }
      if (!this._recorder) this._recorder = speech.recorder((recording, transcribing) => {
        diag('mic', { event: 'state', recording, transcribing });
        if (this._visible && user === ui.userId()) this.setData({ recording, transcribing, microphoneStarting: false });
      }, text => {
        if (!this._visible || user !== ui.userId()) return;
        this.setData({ transcribing: false, text });
        if (!text.trim()) this.setData({ error: '没有识别到语音，请重试' });
        else this.send(text);
      }, e => {
        diag('mic', { event: 'error', message: e.message });
        if (this._recorder) {
          this._recorder.destroy();
          this._recorder = null;
        }
        if (this._visible && user === ui.userId()) {
          this.setData({ recording: false, transcribing: false, microphoneStarting: false });
          ui.error(this, e);
        }
      });
      this._recorder.start();
      diag('mic', { event: 'recording' });
    } catch (e) { diag('mic', { event: 'start-failed', message: e.message }); if (this._visible) { this.setData({ recording: false, microphoneStarting: false }); ui.error(this, e); } }
  },
  stopRecording() {
    if (!this.data.recording) return;
    this._press = null;
    if (this.data.microphoneStarting) { this.cancelTouch(); return; }
    this.setData({ recording: false, transcribing: true });
    if (this._voiceHandoff) this._voiceHandoff.recorder.stop();
    else if (this._recorder) this._recorder.stop();
    else this.setData({ transcribing: false });
  },
  cancelTouch() { this.destroyRecorder(); },
  destroyRecorder(silent = false, preserveHandoff = false) { this._press = null; if (!preserveHandoff) { if (this._voiceHandoff) this._voiceHandoff.cancel(); this._voiceHandoff = null; } if (this._recorder) this._recorder.destroy(); this._recorder = null; if (!silent && this._visible && !preserveHandoff) this.setData({ recording: false, transcribing: false, microphoneStarting: false }); },
  microphoneHelp() { if (my.showAuthGuide) my.showAuthGuide({ authType: 'MICROPHONE' }); },
  interruptTour() { if (this.props && this.props.onInterrupt) this.props.onInterrupt(); },
  settleTour() { if (this._visible && !this.data.busy && !this.data.recording && !this.data.transcribing && this.props && this.props.onSettled) this.props.onSettled(); },
  toggleBargeIn(event) { const enabled = !!ui.value(event); this.setData({ bargeInEnabled: enabled, error: '' }); if (enabled && audio.snapshot().owner === 'chat' && audio.snapshot().playing) this.startBargeIn(); else this.stopBargeIn(); },
  startBargeIn() {
    if (!this.data.bargeInEnabled || !this._visible || this._bargeIn) return;
    this._bargeIn = bargeIn.monitor(() => { this.cancel(); if (this._visible) this.setData({ error: '已打断朗读，可点击麦克风继续提问' }); }, error => { if (this._visible) this.setData({ bargeInEnabled: false, error: error.message }); });
  },
  stopBargeIn() { if (this._bargeIn) this._bargeStopping = this._bargeIn.stop(); this._bargeIn = null; return this._bargeStopping; },
  toggleExpanded() {
    if (this.data.embedded) this.setData({ expanded: !this.data.expanded });
    else { getApp().globalData.openChat = true; getApp().globalData.chatDraft = { userId: ui.userId(), text: this.data.text }; my.reLaunch({ url: '/pages/tour/index' }); }
  },
  backToTour() { if (this.props && this.props.onClose) this.props.onClose(); else my.reLaunch({ url: '/pages/tour/index' }); }
}; };
