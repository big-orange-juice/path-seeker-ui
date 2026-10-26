const auth = require('../../services/auth');
const rooms = require('../../services/translation-room');
const session = require('../../services/translation-session');
const { ROOM_LANGUAGES, groupRoomMessages } = require('../../shared/translation-room');
const { formatRoomMessage, localizeRoomNotice, roomMessages } = require('../../shared/translation-room-messages');
Page({
  data: { room: null, canHost: false, permissionPending: true, code: '', languages: ROOM_LANGUAGES, language: 'zh-CN', messages: roomMessages('zh-CN'), languageIndex: 0, sourceIndex: 0, source: '', translated: '', feed: [], chatGroups: [], languageGroups: [], sourceLabel: '', pendingSource: '', detailsOpen: false, showLatest: false, scrollTarget: '', speaking: false, paused: false, busy: false, disconnected: false, notice: '正在确认账号权限…', error: '' },
  onLoad(query = {}) {
    this._visible = true;
    this.setData({ code: typeof query.roomCode === 'string' ? query.roomCode : '' });
    this.bindSession();
    this.run(async () => {
      await auth.ensure();
      this._user = auth.current().userId;
      const active = session.snapshot();
      const permission = active.room ? { canHost: active.room.isHost } : await rooms.api('/host-permission');
      this._notice = permission.canHost ? '选择讲话语言，创建或返回讲解房间' : '输入房间码并选择语言，开始收听';
      if (this._visible) this.setData({ canHost: permission.canHost, notice: localizeRoomNotice(active.room ? active.notice : this._notice, this.data.language) });
    }).finally(() => { if (this._visible) this.setData({ permissionPending: false }); });
  },
  onShow() { this._visible = true; this.bindSession(); },
  onReady() { this.measureChat(); },
  measureChat() {
    if (!my.createSelectorQuery) return;
    my.createSelectorQuery().select('.chat-conversation').boundingClientRect().exec(result => {
      if (result && result[0]) this._chatHeight = result[0].height;
    });
  },
  openDetails() { this.setData({ detailsOpen: true }); },
  closeDetails() { this.setData({ detailsOpen: false }); },
  onChatScroll(event) {
    if (!this._chatHeight) return;
    const detail = event.detail;
    this._following = detail.scrollHeight - detail.scrollTop - this._chatHeight < 90;
    if (this.data.showLatest === this._following) this.setData({ showLatest: !this._following });
  },
  followLatest() {
    this._following = true;
    this.setData({ showLatest: false, scrollTarget: this.data.scrollTarget === 'chat-end-a' ? 'chat-end-b' : 'chat-end-a' });
  },
  bindSession() {
    if (this._unsubscribe) return;
    this._unsubscribe = session.subscribe(value => {
      if (!this._visible) return;
      const room = value.room;
      const messages = value.messages;
      const languageGroups = (room && room.languages || []).map(group => Object.assign({}, group, {
        label: (ROOM_LANGUAGES.find(item => item.value === group.language) || { label: group.language }).label,
        avatar: group.language.split('-')[0].toUpperCase(),
        names: (room.members || []).filter(member => member.language === group.language).map(member => member.displayName).join(', '),
        countLabel: formatRoomMessage(messages.people, { count: group.count })
      }));
      const chatGroups = groupRoomMessages(value.feed).map(group => Object.assign({}, group, {
        segmentLabel: formatRoomMessage(messages.segment, { number: group.sequence }),
        translations: group.translations.map(item => Object.assign({}, item, {
          avatar: item.language.split('-')[0].toUpperCase(),
          displayText: item.status === 'error' ? localizeRoomNotice(item.text, value.language, 'translationUnavailable') || messages.translationUnavailable : item.text || (item.status === 'translating' ? messages.translating : messages.noTranslation),
          statusLabel: item.status === 'translating' ? messages.translating : messages.segmentUnavailable
        }))
      }));
      const lastGroup = chatGroups[chatGroups.length - 1];
      const sourceLabel = room ? (ROOM_LANGUAGES.find(item => item.value === room.sourceLanguage) || { label: room.sourceLanguage }).label : '';
      const pendingSource = value.source && (!lastGroup || lastGroup.source !== value.source) ? value.source : '';
      const scrollTarget = this._following === false ? this.data.scrollTarget : this.data.scrollTarget === 'chat-end-a' ? 'chat-end-b' : 'chat-end-a';
      const hadRoom = !!this.data.room;
      const selectedIndex = Math.max(0, ROOM_LANGUAGES.findIndex(item => item.value === value.language));
      const title = room ? messages.chatTitle : messages.title;
      if (this._title !== title && my.setNavigationBar) my.setNavigationBar({ title });
      this._title = title;
      this.setData(Object.assign({}, value, {
        feed: value.feed.slice().reverse(), chatGroups, sourceLabel, pendingSource, languageGroups, scrollTarget,
        languageIndex: selectedIndex, sourceIndex: selectedIndex,
        sourceDescription: formatRoomMessage(messages.original, { language: sourceLabel || '' }),
        listenerLabel: formatRoomMessage(messages.listeners, { count: room ? room.listenerCount || 0 : 0 }),
        notice: localizeRoomNotice(value.notice || this._notice || '正在确认账号权限…', value.language), error: value.displayError,
        code: room ? room.code : this.data.code
      }));
      if (!hadRoom && room) this.measureChat();
    });
  },
  back() { my.navigateBack({ fail: () => my.reLaunch({ url: '/pages/tour/index' }) }); },
  scan() { my.scan({ type: 'qr', success: result => { const match = /(?:[?&]roomCode=)(\d{8})(?:&|$)/.exec(result.code || ''); const code = match ? match[1] : /^\d{8}$/.test(result.code || '') ? result.code : ''; this.setData(code ? { code, error: '' } : { error: this.data.messages.invalidQr }); } }); },
  onHide() { this._visible = false; if (this._unsubscribe) this._unsubscribe(); this._unsubscribe = null; },
  onUnload() { this.onHide(); },
  async run(action) {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try { await action(); } catch (error) { if (this._visible) this.setData({ error: localizeRoomNotice(error.message || '操作失败，请重试', this.data.language) }); }
    finally { if (this._visible) this.setData({ busy: false }); }
  },
  inputCode(event) { this.setData({ code: event.detail.value }); },
  chooseLanguage(event) { const languageIndex = Number(event.currentTarget.dataset.index); if (ROOM_LANGUAGES[languageIndex]) { this.setData({ languageIndex }); session.setLanguage(ROOM_LANGUAGES[languageIndex].value); } },
  chooseSource(event) { const sourceIndex = Number(event.currentTarget.dataset.index); if (ROOM_LANGUAGES[sourceIndex]) { this.setData({ sourceIndex }); session.setLanguage(ROOM_LANGUAGES[sourceIndex].value); } },
  join() { this.run(async () => { if (!/^\d{8}$/.test(this.data.code)) throw Error('请输入八位房间码'); const userId = auth.current().userId; const room = await rooms.api('/join', { code: this.data.code, targetLanguage: ROOM_LANGUAGES[this.data.languageIndex].value }); if (!auth.current() || auth.current().userId !== userId) throw Error('账号已切换'); if (this._visible) { this.attach(room); this.back(); } }); },
  create() { this.run(async () => { if (!this.data.canHost) throw Error('当前账号未获车夫授权'); const userId = auth.current().userId; const room = await rooms.api('', { sourceLanguage: ROOM_LANGUAGES[this.data.sourceIndex].value }); if (!auth.current() || auth.current().userId !== userId) throw Error('账号已切换'); if (this._visible) { this.attach(room); this.back(); } }); },
  attach(room) {
    if (!this._visible) return;
    session.attach(room, ROOM_LANGUAGES[room.isHost ? this.data.sourceIndex : this.data.languageIndex].value);
  },
  event(event) {
    session.event(event);
  },
  startSpeaking() { this.run(() => session.startSpeaking()); },
  changeLanguage() { this.run(() => session.changeLanguage()); },
  togglePause() { session.togglePause(); },
  end() { this.run(() => session.end(false)); },
  closeRoom() { this.run(() => session.end(true)); },
  disconnect() { session.disconnect(); },
  leave() { this.closeDetails(); this.run(() => session.leave()); }
});
