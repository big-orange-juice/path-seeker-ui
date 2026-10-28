const auth = require('../../services/auth');
const http = require('../../services/http');
const postcards = require('../../services/postcards');
const ui = require('../../core/ui');
Page({
  data: { user: {}, eligible: false, loading: false, busy: false, error: '', composer: false, title: '我的电子明信片', experience: null, templates: [], templateIndex: 0, caption: '', photoPath: '', photoId: '', cards: [], albums: [], albumView: false, page: 1, total: 0, result: null, selected: null, imagePath: '' },
  onLoad(query) { this._query = query || {}; this._visible = true; this._generationKey = ''; },
  onShow() { this._visible = true; this.load(); },
  onHide() { this._visible = false; this._seq++; clearTimeout(this._timer); },
  onUnload() { this.onHide(); },
  async load() {
    const seq = this._seq = (this._seq || 0) + 1;
    if (this._accountVersion !== auth.version()) { this._accountVersion = auth.version(); this._generationKey = ''; this.setData({ cards: [], albums: [], result: null, selected: null, imagePath: '', photoId: '', photoPath: '', experience: null }); }
    this.setData({ loading: true, busy: false, error: '' });
    try {
      const user = await auth.ensure(); const version = auth.version(); const profile = await http.request('/AppUser/Profile');
      if (!this._visible || seq !== this._seq || version !== auth.version()) return;
      const eligible = !user.isGuest && Boolean(profile.phone);
      this.setData({ user, eligible, composer: Boolean(this._query.stageId) });
      if (!eligible) return;
      if (this._query.stageId) {
        const nodes = await http.request(http.query('/Postcard/Route', { routeId: this._query.routeId }));
        if (!this._visible || seq !== this._seq) return;
        const experience = nodes.find(n => n.stageId === this._query.stageId && n.enabled);
        if (!experience) throw Error('此节点暂未开放明信片制作');
        this.setData({ experience, templates: experience.templates });
        if (this.data.result && ['pending', 'rendering'].includes(this.data.result.status)) this.poll(this.data.result.id);
      } else await this.history(false);
    } catch (e) { if (this._visible && seq === this._seq) ui.error(this, e); }
    finally { if (this._visible && seq === this._seq) this.setData({ loading: false }); }
  },
  authorize() { my.navigateTo({ url: '/pages/auth/index?phone=1' }); },
  template(event) { if (this.data.busy) return; this._generationKey = ''; this.setData({ templateIndex: Number(ui.value(event)), result: null }); },
  caption(event) { if (this.data.busy) return; this._generationKey = ''; this.setData({ caption: ui.value(event), result: null }); },
  choosePhoto() {
    if (this.data.busy || !this.data.eligible) return;
    my.chooseImage({ count: 1, sourceType: ['camera', 'album'], success: async result => {
      const path = result.apFilePaths && result.apFilePaths[0] || result.tempFilePaths && result.tempFilePaths[0];
      if (!path) return;
      const user = ui.userId(), seq = this._seq; this.setData({ busy: true, error: '' });
      try { const file = await postcards.upload(path); if (!this._visible || seq !== this._seq || user !== ui.userId()) return; this._generationKey = ''; this.setData({ photoPath: path, photoId: file.fileId, result: null }); }
      catch (e) { if (this._visible && seq === this._seq && user === ui.userId()) ui.error(this, e); }
      finally { if (this._visible && seq === this._seq && user === ui.userId()) this.setData({ busy: false }); }
    } });
  },
  async generate() {
    if (this.data.busy || !this.data.eligible || !this.data.experience) return;
    const template = this.data.templates[this.data.templateIndex]; if (!template) return;
    if (this.data.experience.mode === 'ai' && !this.data.photoId) { this.setData({ error: '请先选择一张照片' }); return; }
    if (!this._query.visitId) { this.setData({ error: '请先开始本条路线的游览' }); return; }
    const user = ui.userId(), seq = this._seq; this.setData({ busy: true, error: '' });
    if (!this._generationKey || this.data.result && this.data.result.status === 'failed') this._generationKey = 'mp-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    try {
      const card = await http.post('/Postcard/Generate', { stageId: this._query.stageId, visitId: this._query.visitId, templateId: template.id, sourceAttachmentId: this.data.photoId || null, caption: this.data.caption, client: 'alipay', idempotencyKey: this._generationKey }, { timeout: 60000 });
      if (!this._visible || seq !== this._seq || user !== ui.userId()) return;
      this.setData({ result: card }); if (card.status === 'completed') await this.showCard(card); else if (card.status !== 'failed') this._timer = setTimeout(() => this.poll(card.id), 4000);
    } catch (e) { if (this._visible && seq === this._seq && user === ui.userId()) ui.error(this, e); }
    finally { if (this._visible && seq === this._seq && user === ui.userId()) this.setData({ busy: false }); }
  },
  async poll(id) {
    const user = ui.userId(), seq = this._seq;
    try { const card = await postcards.detail(id); if (!this._visible || seq !== this._seq || user !== ui.userId() || !this.data.result || this.data.result.id !== id) return; this.setData({ result: card }); if (card.status === 'completed') await this.showCard(card); else if (card.status !== 'failed') this._timer = setTimeout(() => this.poll(id), 4000); }
    catch (e) { if (this._visible && seq === this._seq && user === ui.userId()) ui.error(this, e); }
  },
  async history(more) {
    const user = ui.userId(), seq = this._seq;
    const result = await postcards.history(more ? this.data.page + 1 : 1);
    if (!this._visible || user !== ui.userId() || seq !== this._seq) return;
    const cards = (more ? this.data.cards : []).concat(result.list), groups = {};
    cards.forEach(c => { if (!groups[c.visitId]) groups[c.visitId] = { id: c.visitId, title: c.routeTitle, cards: [] }; groups[c.visitId].cards.push(c); });
    this.setData({ cards, albums: Object.keys(groups).map(key => groups[key]), total: result.total, page: result.page });
  },
  async more() { if (this.data.loading) return; this.setData({ loading: true }); try { await this.history(true); } catch (e) { if (this._visible) ui.error(this, e); } finally { if (this._visible) this.setData({ loading: false }); } },
  view() { this.setData({ albumView: !this.data.albumView }); },
  async open(event) { const version = auth.version(), seq = this._seq; try { const card = await postcards.detail(ui.dataset(event).id); if (version === auth.version() && seq === this._seq) await this.showCard(card); } catch (e) { if (this._visible && version === auth.version() && seq === this._seq) ui.error(this, e); } },
  refreshCard() { if (this.data.selected) this.open({ currentTarget: { dataset: { id: this.data.selected.id } } }); },
  async showCard(card) { if (!this._visible) return; const user = ui.userId(); this.setData({ selected: card, imagePath: '' }); if (card.status === 'completed') { const path = await postcards.image(card.id); if (this._visible && user === ui.userId() && this.data.selected && this.data.selected.id === card.id) this.setData({ imagePath: path }); } },
  closeCard() { this.setData({ selected: null, imagePath: '' }); },
  saveImage() { if (this.data.imagePath) my.saveImage({ url: this.data.imagePath, success: () => my.showToast({ content: '明信片已保存', type: 'success' }), fail: () => my.showToast({ content: '保存失败，请检查相册权限', type: 'none' }) }); }
});
