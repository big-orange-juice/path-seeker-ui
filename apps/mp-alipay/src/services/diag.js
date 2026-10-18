// 真机联调诊断输出：统一 [diag] 前缀，便于在支付宝开发者工具 Console 里过滤。
// diagnostics 关闭时不产生任何输出，也不弹窗。
const config = require('../config');
function text(value) {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch (_) { return String(value); }
}
function diag(label, value) {
  if (!config.diagnostics) return;
  if (typeof console === 'undefined' || typeof console.log !== 'function') return;
  console.log('[diag] ' + label + (value === undefined ? '' : ' ' + text(value)));
}
module.exports = { diag };
