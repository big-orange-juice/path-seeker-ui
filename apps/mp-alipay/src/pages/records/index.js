const auth = require('../../services/auth');
const http = require('../../services/http');
const visits = require('../../services/visits');
const ui = require('../../core/ui');
const storage = require('../../services/storage');
const { locales } = require('../../config');
const tabs = ['本机漫游', '进行中', '已完成', '足迹'];
Page({
  data: { tabs, tab: 0, records: [], loading: false, hasMore: false, error: '' },
  onLoad() { this._seq = 0; },
  onShow() { this._visible = true; this.load(true); },
  onHide() { this._visible = false; this._seq++; },
  choose(event) { this.setData({ tab: Number(ui.dataset(event).index), records: [] }); this.load(true); },
  more() { if (!this.data.loading && this.data.hasMore) this.load(false); },
  retry() { this.load(true); },
  async load(reset) {
    const seq = ++this._seq; this.setData({ loading: true, error: '' });
    try {
      await auth.ensure(); if (seq !== this._seq || !this._visible) return; const user = ui.userId(), tab = this.data.tab;
      let records, hasMore = false;
      const page = reset ? 1 : (this._page || 1) + 1;
      if (tab === 0) records = visits.list().map(v => Object.assign({}, v, { routeTitle: v.title, coverImageUrl: v.cover, dateLabel: v.updatedAt.slice(0, 10), progressLabel: (v.completedStageIds || []).length + ' 站已完成', statusLabel: v.status === 1 ? '进行中' : v.status === 2 ? '已完成' : '已结束' }));
      else if (tab === 2) { const result = await http.request('/Gameplay/MyCompletedRoutes'); records = result || []; }
      else {
        const result = await http.request(http.query(tab === 3 ? '/Gameplay/MyFootprints' : '/Gameplay/MyRouteHistory', Object.assign({ PageIndex: page, PageSize: 20 }, tab === 1 ? { Status: 1 } : {})));
        records = result.list || []; hasMore = result.pageIndex < result.totalPages;
      }
      if (seq !== this._seq || !this._visible || user !== ui.userId()) return;
      if (tab !== 0) records = records.map(r => Object.assign({}, r, { dateLabel: (r.completedAt || r.startedAt || '').slice(0, 10), progressLabel: (r.solvedCount || 0) + ' / ' + (r.puzzleCount || 0), statusLabel: tab === 1 ? '进行中' : '已完成' }));
      records = records.map((r, i) => Object.assign({}, r, { renderKey: r.visitId || r.sessionId || r.footprintId || r.id || (r.routeId + ':' + page + ':' + i) }));
      this._page = page;
      this.setData({ records: reset ? records : this.data.records.concat(records), hasMore });
    } catch (e) { if (seq === this._seq && this._visible) ui.error(this, e); }
    finally { if (seq === this._seq && this._visible) this.setData({ loading: false }); }
  },
  resume(event) { const id = ui.dataset(event).id, record = this.data.records.find(item => item.routeId === id); if (typeof id !== 'string' || !id || !record) { this.setData({ error: '该记录缺少可用路线，请重新选择路线' }); return; } if (locales.some(locale => locale.value === record.locale)) storage.write('locale', record.locale); getApp().globalData.selectedRoute = id; my.switchTab({ url: '/pages/tour/index' }); }
});
