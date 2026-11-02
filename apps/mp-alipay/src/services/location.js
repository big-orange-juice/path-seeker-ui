const { gcj02ToWgs84 } = require('../shared/map-coordinates');
const { diag } = require('./diag');
let foreground = true, hiddenAt = null;
function setForeground(visible) {
  const now = Date.now();
  if (foreground === visible) return;
  diag('location-lifecycle', { at: now, foreground: visible, hiddenMs: !visible || hiddenAt === null ? null : now - hiddenAt });
  foreground = visible; hiddenAt = visible ? null : now;
}
function reportCapabilities() {
  diag('location-capabilities', {
    getLocation: typeof my.getLocation === 'function',
    startLocationUpdateBackground: typeof my.startLocationUpdateBackground === 'function',
    startContinuousLocation: typeof my.startContinuousLocation === 'function',
    onLocationChange: typeof my.onLocationChange === 'function'
  });
}
function coordinate(value, limit) {
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'string' && !value.trim()) return NaN;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : NaN;
}
function precision(result) {
  for (const value of [result.horizontalAccuracy, result.accuracy]) {
    if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'string' && !value.trim()) continue;
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return 999;
}
function watch(onFix, onError) {
  let closed = false, timer = null, lastFixAt = null;
  const poll = () => {
    if (closed) return;
    const requestedAt = Date.now();
    my.getLocation({ type: 0, cacheTimeout: 0,
      success(result) {
        if (closed) return;
        const gcj = { longitude: coordinate(result.longitude, 180), latitude: coordinate(result.latitude, 90) };
        const accuracy = precision(result);
        if (!Number.isFinite(gcj.longitude) || !Number.isFinite(gcj.latitude)) onError(Error('无法获得有效定位'));
        else {
          const now = Date.now();
          diag('location-fix', { at: now, foreground, requestMs: now - requestedAt, intervalMs: lastFixAt === null ? null : now - lastFixAt, hiddenMs: hiddenAt === null ? null : now - hiddenAt, accuracy });
          lastFixAt = now;
          onFix(Object.assign(gcj02ToWgs84(gcj), { gcj, accuracy, heading: typeof result.direction === 'number' && result.direction >= 0 && result.direction <= 360 ? result.direction : null, timestamp: now }));
        }
      },
      fail(result) {
        if (closed) return;
        const denied = [11, 2001, 2002, 2003, 2004].includes(Number(result.error));
        diag('location-error', { at: Date.now(), foreground, code: result.error, denied });
        if (denied) { closed = true; clearTimeout(timer); }
        onError(Object.assign(Error(denied ? '定位权限未开启，请在支付宝设置中允许后重试' : '暂时无法定位，可手动选择站点'), { denied }));
      },
      // 每次请求结束后才安排下一次，避免慢定位产生请求重叠。
      complete() { if (!closed) timer = setTimeout(poll, 3000); }
    });
  };
  poll();
  return () => { closed = true; clearTimeout(timer); };
}
module.exports = { watch, setForeground, reportCapabilities };
