const auth = require('../../services/auth');
const storage = require('../../services/storage');
const ui = require('../../core/ui');
Page({
  data: { register: false, account: '', password: '', username: '', phone: '', email: '', nickname: '', busy: false, error: '', agreed: false },
  onShow() { this._visible = true; },
  onHide() { this._visible = false; },
  onUnload() { this._visible = false; },
  input(event) { const field = ui.dataset(event).field; if (['account', 'password', 'username', 'phone', 'email', 'nickname'].includes(field)) this.setData({ [field]: ui.value(event) }); },
  mode() { if (!this.data.busy) this.setData({ register: !this.data.register, error: '' }); },
  agree(event) { this.setData({ agreed: ui.value(event).includes('agree') }); },
  privacy() { my.navigateTo({ url: '/pages/privacy/index' }); },
  async submit() {
    if (this.data.busy) return;
    const d = this.data;
    if (!d.agreed) { this.setData({ error: '请先阅读并同意隐私说明' }); return; }
    if (d.register ? !(d.username.trim() || d.phone.trim() || d.email.trim()) || d.password.length < 6 : !d.account.trim() || !d.password) { this.setData({ error: d.register ? '请填写用户名、手机号或邮箱中的至少一项，并设置至少 6 位密码' : '请填写账号和密码' }); return; }
    this.setData({ busy: true, error: '' });
    try {
      await auth.login(d.register ? { username: d.username.trim() || null, phone: d.phone.trim() || null, email: d.email.trim() || null, password: d.password, nickname: d.nickname.trim() || null, preferredLang: storage.read('locale', 'zh') } : { account: d.account.trim(), password: d.password }, d.register);
      this.setData({ password: '' }); if (this._visible) my.switchTab({ url: '/pages/me/index' });
    } catch (e) { if (this._visible) ui.error(this, e); }
    finally { this.setData({ busy: false }); }
  },
  async guest() { if (this.data.busy) return; this.setData({ busy: true, error: '' }); try { await auth.ensure(); if (this._visible) my.switchTab({ url: '/pages/tour/index' }); } catch (e) { if (this._visible) ui.error(this, e); } finally { this.setData({ busy: false }); } }
});
