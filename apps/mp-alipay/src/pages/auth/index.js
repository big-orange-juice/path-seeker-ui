const auth = require('../../services/auth');
const storage = require('../../services/storage');
const ui = require('../../core/ui');
const { authOptions = {} } = require('../../config');
const invitation = require('../../services/room-invitation');
Page({
  onLoad(query = {}) { this._invitation = invitation.entry(query); if (this._invitation) this.setData({ guestLoginEnabled: false }); this._returnAfterPhone = query.phone === '1'; if (this._returnAfterPhone) this.setData({ requirePhoneNumber: true, postcardPhone: true }); },
  data: { guestLoginEnabled: authOptions.guestLogin === true, passwordLoginEnabled: authOptions.passwordLogin === true, requirePhoneNumber: authOptions.requirePhoneNumber !== false, register: false, account: '', password: '', username: '', phone: '', email: '', nickname: '', busy: false, error: '', agreed: false },
  onShow() { this._visible = true; },
  onHide() { this._visible = false; },
  onUnload() { this._visible = false; },
  input(event) { const field = ui.dataset(event).field; if (['account', 'password', 'username', 'phone', 'email', 'nickname'].includes(field)) this.setData({ [field]: ui.value(event) }); },
  mode() { if (authOptions.passwordLogin === true && !this.data.busy) this.setData({ register: !this.data.register, error: '' }); },
  agree(event) { this.setData({ agreed: ui.value(event).includes('agree') }); },
  privacy() { my.navigateTo({ url: '/pages/privacy/index' }); },
  alipayError() { if (!this.data.busy) this.setData({ error: '未完成手机号授权，请允许后重试' }); },
  async alipay() {
    if (this.data.busy) return;
    if (!this.data.agreed) { this.setData({ error: '请先阅读并同意隐私说明' }); return; }
    this.setData({ busy: true, error: '' });
    try {
      await auth.loginAlipay({ requirePhoneNumber: this.data.requirePhoneNumber });
      this.setData({ password: '' });
      if (this._visible) this.finishLogin('/pages/tour/index?view=routes');
    } catch (error) { if (this._visible) ui.error(this, error); }
    finally { this.setData({ busy: false }); }
  },
  async submit() {
    if (authOptions.passwordLogin !== true || this.data.busy) return;
    const d = this.data;
    if (!d.agreed) { this.setData({ error: '请先阅读并同意隐私说明' }); return; }
    if (d.register ? !(d.username.trim() || d.phone.trim() || d.email.trim()) || d.password.length < 6 : !d.account.trim() || !d.password) { this.setData({ error: d.register ? '请填写用户名、手机号或邮箱中的至少一项，并设置至少 6 位密码' : '请填写账号和密码' }); return; }
    this.setData({ busy: true, error: '' });
    try {
      await auth.login(d.register ? { username: d.username.trim() || null, phone: d.phone.trim() || null, email: d.email.trim() || null, password: d.password, nickname: d.nickname.trim() || null, preferredLang: storage.read('locale', 'zh') } : { account: d.account.trim(), password: d.password }, d.register);
      this.setData({ password: '' }); if (this._visible) this.finishLogin('/pages/tour/index?view=routes');
    } catch (e) { if (this._visible) ui.error(this, e); }
    finally { this.setData({ busy: false }); }
  },
  finishLogin(defaultUrl) { if (this._invitation) my.reLaunch({ url: invitation.url(this._invitation.roomCode, this._invitation) }); else if (this._returnAfterPhone && getCurrentPages().length > 1) my.navigateBack(); else my.reLaunch({ url: defaultUrl }); },
  async guest() { if (this._invitation || authOptions.guestLogin !== true || this.data.busy) return; this.setData({ busy: true, error: '' }); try { await auth.ensure(); if (this._visible) this.finishLogin('/pages/tour/index'); } catch (e) { if (this._visible) ui.error(this, e); } finally { this.setData({ busy: false }); } }
});
