const auth = require('../../services/auth');
const http = require('../../services/http');
const storage = require('../../services/storage');
const audio = require('../../services/audio');
const ui = require('../../core/ui');
const { locales } = require('../../config');
Page({
  data: { user: {}, profile: {}, loading: false, busy: false, editing: false, nickname: '', country: '', localeIndex: 0, locales, voiceId: '', error: '' },
  onShow() { this._visible = true; this.load(); },
  onHide() { this._visible = false; this._seq = (this._seq || 0) + 1; this.setData({ busy: false }); },
  async load() {
    const seq = this._seq = (this._seq || 0) + 1;
    const active = () => this._visible && seq === this._seq;
    this.setData({ loading: true, error: '' });
    try {
      const user = await auth.ensure(); if (!active()) return;
      this.setData({ user, profile: {}, localeIndex: Math.max(0, locales.findIndex(l => l.value === storage.read('locale', 'zh'))), voiceId: storage.read(storage.scoped(user.userId, 'voice'), ''), editing: false });
      const profile = await http.request('/AppUser/Profile');
      if (active() && ui.userId() === user.userId) this.setData({ profile: profile || {}, nickname: profile && profile.nickname || '', country: profile && profile.country || '' });
    } catch (e) { if (active()) ui.error(this, e); }
    finally { if (active()) this.setData({ loading: false }); }
  },
  login() { my.navigateTo({ url: '/pages/auth/index' }); },
  records() { my.navigateTo({ url: '/pages/records/index' }); },
  privacy() { my.navigateTo({ url: '/pages/privacy/index' }); },
  tour() { my.reLaunch({ url: '/pages/tour/index' }); },
  edit() { this.setData({ editing: !this.data.editing }); },
  input(event) { const field = ui.dataset(event).field; if (['nickname', 'country', 'voiceId'].includes(field)) this.setData({ [field]: ui.value(event) }); },
  locale(event) { const index = Number(ui.value(event)); if (!locales[index]) return; storage.write('locale', locales[index].value); storage.write('tour-locale', locales[index].value); this.setData({ localeIndex: index }); },
  saveVoice() { if (!this.data.user.userId || this.data.user.userId !== ui.userId()) return; storage.write(storage.scoped(this.data.user.userId, 'voice'), this.data.voiceId.trim()); my.showToast({ content: '音色设置已保存', type: 'success' }); },
  async save() {
    if (this.data.busy || this.data.loading || !this.data.profile.id) return;
    this.setData({ busy: true, error: '' }); const user = ui.userId(), profile = this.data.profile, seq = this._seq;
    const active = () => this._visible && seq === this._seq && user === ui.userId();
    try {
      await http.post('/AppUser/UpdateProfile', { nickname: this.data.nickname.trim() || null, avatarUrl: profile.avatarUrl || null, gender: profile.gender || 0, birthday: profile.birthday || null, country: this.data.country.trim() || null, preferredLang: locales[this.data.localeIndex].value });
      if (!active()) return; this.setData({ busy: false }); await this.load(); if (this._visible && user === ui.userId()) my.showToast({ content: '资料已保存', type: 'success' });
    } catch (e) { if (active()) ui.error(this, e); } finally { if (active()) this.setData({ busy: false }); }
  },
  async logout() {
    const user = ui.userId(), seq = this._seq;
    if (!await ui.confirm('退出登录', '退出当前账号？再次进入将以游客身份浏览。')) return;
    if (!this._visible || seq !== this._seq || user !== ui.userId()) return;
    audio.stop(); auth.logout(); getApp().globalData.chatContext = null; getApp().globalData.selectedRoute = ''; this.setData({ profile: {}, user: {}, editing: false }); await this.load();
  },
  async clearHistory() {
    const user = ui.userId(), seq = this._seq;
    if (!await ui.confirm('清除本机记录', '清除本机的漫游历史和讲解断点？服务端行程进度会保留。')) return;
    if (!this._visible || seq !== this._seq || user !== ui.userId()) return;
    if (user) ['visits', 'checkpoint', 'route', 'sequence'].forEach(key => storage.remove(storage.scoped(user, key))); my.showToast({ content: '本机记录已清除', type: 'success' });
  }
});
