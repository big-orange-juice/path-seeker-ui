const { gcj02ToWgs84 } = require('../shared/map-coordinates');
function watch(onFix, onError) {
  let closed = false, timer = null;
  const poll = () => {
    if (closed) return;
    my.getLocation({ type: 0, cacheTimeout: 0,
      success(result) {
        if (closed) return;
        const gcj = { longitude: Number(result.longitude), latitude: Number(result.latitude) };
        const accuracy = Number(result.horizontalAccuracy || result.accuracy);
        if (!Number.isFinite(gcj.longitude) || !Number.isFinite(gcj.latitude)) onError(Error('无法获得有效定位'));
        else onFix(Object.assign(gcj02ToWgs84(gcj), { gcj, accuracy: Number.isFinite(accuracy) ? accuracy : 999, timestamp: Date.now() }));
      },
      fail(result) {
        if (closed) return;
        const denied = [11, 2001, 2002, 2003, 2004].includes(Number(result.error));
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
module.exports = { watch };
