const auth = require('../services/auth');
function value(event) { return event.detail.value; }
function dataset(event) { return event.currentTarget.dataset; }
function confirm(title, content, labels = {}) { return new Promise(resolve => my.confirm({ title, content, confirmButtonText: labels.confirm || '确定', cancelButtonText: labels.cancel || '取消', success: r => resolve(r.confirm), fail: () => resolve(false) })); }
function error(page, reason) { if (!reason.cancelled) page.setData({ error: reason.message || '操作失败，请重试' }); }
function userId() { return auth.current() && auth.current().userId; }
function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16); }); }
function clock(seconds) { seconds = Math.floor(seconds || 0); return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); }
module.exports = { value, dataset, confirm, error, userId, uuid, clock };
