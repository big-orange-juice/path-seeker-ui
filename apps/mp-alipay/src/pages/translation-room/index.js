const auth = require('../../services/auth');
const rooms = require('../../services/translation-room');
const { ROOM_LANGUAGES } = require('../../shared/translation-room');
Page({
  data: { room: null, canHost: false, code: '', languages: ROOM_LANGUAGES, languageIndex: 2, sourceIndex: 0, source: '', translated: '', speaking: false, paused: false, busy: false, disconnected: false, notice: '选择语言，点击开始收听', error: '' },
  onLoad(query = {}) {
    this._visible = true;
    this.setData({ code: typeof query.roomCode === 'string' ? query.roomCode : '' });
    this.run(async () => { await auth.ensure(); this._user = auth.current().userId; const permission = await rooms.api('/host-permission'); if (this._visible) this.setData({ canHost: permission.canHost }); });
  },
  onShow() { this._visible = true; this.setData({ busy: false }); },
  scan() { my.scan({ type: 'qr', success: result => { const match = /(?:[?&]roomCode=)(\d{8})(?:&|$)/.exec(result.code || ''); const code = match ? match[1] : /^\d{8}$/.test(result.code || '') ? result.code : ''; this.setData(code ? { code, error: '' } : { error: '请扫描讲解房间二维码' }); } }); },
  onHide() { this._visible = false; this.disconnect(); },
  onUnload() { this._visible = false; this.disconnect(); },
  async run(action) {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try { await action(); } catch (error) { if (this._visible) this.setData({ error: error.message || '操作失败，请重试' }); }
    finally { if (this._visible) this.setData({ busy: false }); }
  },
  inputCode(event) { this.setData({ code: event.detail.value }); },
  chooseLanguage(event) { this.setData({ languageIndex: Number(event.detail.value) }); },
  chooseSource(event) { this.setData({ sourceIndex: Number(event.detail.value) }); },
  join() { this.run(async () => { if (!/^\d{8}$/.test(this.data.code)) throw Error('请输入八位房间码'); this.disconnect(); const room = await rooms.api('/join', { code: this.data.code, targetLanguage: ROOM_LANGUAGES[this.data.languageIndex].value }); this.attach(room); }); },
  create() { this.run(async () => { if (!this.data.canHost) throw Error('当前账号未获车夫授权'); this.disconnect(); const room = await rooms.api('', { sourceLanguage: ROOM_LANGUAGES[this.data.sourceIndex].value }); this.attach(room); }); },
  attach(room) {
    if (!this._visible) return;
    this._user = auth.current().userId;
    this.setData({ room, code: room.code, source: '', translated: '', speaking: false, paused: false, disconnected: false, notice: room.isHost ? '房间已创建，点击开始讲解开启麦克风' : '正在连接…' });
    this._connection = rooms.connect(room, {
      event: event => { if (this._visible && auth.current() && auth.current().userId === this._user) this.event(event); },
      error: error => { if (this._visible) this.setData({ error: error.message }); },
      disconnected: () => { if (this._visible) this.setData({ disconnected: true, speaking: false, notice: '连接已断开，请点击重新收听或返回讲解房间' }); }
    });
  },
  event(event) {
    const payload = event.payload || {}, updates = {};
    if (event.type === 'subscription.ready' || event.type === 'subscription.changed') { updates.room = payload.room; updates.notice = '已加入，等待下一段讲解'; }
    if (event.type === 'room.snapshot' || event.type === 'room.members.changed') updates.room = payload;
    if (event.type === 'transcript.final') updates.source = payload.text || '';
    if (event.type === 'translation.committed') updates.translated = '';
    if (event.type === 'text.delta') updates.translated = this.data.translated + (payload.content || '');
    if (event.type === 'translation.final') updates.translated = payload.text || '';
    if (event.type === 'language.error' || event.type === 'audio.error' || event.type === 'segment.error') updates.error = payload.message || '本段语音不可用，请阅读字幕';
    if (event.type === 'room.paused') updates.notice = '车夫暂时离线，讲解暂停';
    if (event.type === 'room.started') updates.notice = '讲解中';
    if (event.type === 'room.draining') updates.notice = '讲解即将结束，正在接收剩余语音';
    if (event.type === 'room.closed') { updates.room = Object.assign({}, this.data.room, { status: 'closed' }); updates.speaking = false; updates.notice = payload.mode === 'immediate' ? '房间已关闭' : '讲解已结束，剩余语音将继续播放'; }
    this.setData(updates);
  },
  startSpeaking() { this.run(async () => { if (!this._connection) throw Error('请先重新连接房间'); await this._connection.startRecording(); this.setData({ speaking: true }); }); },
  changeLanguage() { this.disconnect(); this.setData({ notice: '当前语音已停止，请选择语言并重新收听' }); },
  togglePause() { if (this._connection) { this.setData({ paused: !this.data.paused }); this._connection.pause(this.data.paused); } },
  end() { this.run(async () => { if (!this._connection) throw Error('请先返回讲解房间'); await this._connection.end(false); this.setData({ speaking: false }); }); },
  closeRoom() { this.run(async () => { if (this._connection) await this._connection.end(true); else await rooms.api('/' + this.data.room.roomId + '/close', {}); this.setData({ speaking: false, 'room.status': 'closed', notice: '房间已关闭' }); }); },
  disconnect() { if (this._connection) this._connection.close(true); this._connection = null; if (this.data.room) this.setData({ disconnected: true, speaking: false }); },
  leave() { const room = this.data.room; this.disconnect(); this.setData({ room: null, disconnected: false, source: '', translated: '' }); if (room && !room.isHost) rooms.api('/' + room.roomId + '/leave', {}).catch(() => {}); }
});
