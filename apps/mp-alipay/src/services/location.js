const http = require('./http');
const auth = require('./auth');
const translation = require('./translation-session');
const { gcj02ToWgs84 } = require('../shared/map-coordinates');
const { diag } = require('./diag');
const MAX_FIX_AGE_MS = 15000;
let foreground = true;
function setForeground(visible) { foreground = visible; }
function reportCapabilities() { diag('location-capabilities', { source: 'driver', polling: true }); }
function watch(onFix, onError) {
  let closed = false, roomId = '', generation = 0, timer = null, expiry = null, request = null, lastSample = null;
  const error = reason => onError(Object.assign(Error('车夫位置暂不可用'), { driver: true, denied: false, reason }));
  const clear = () => {
    generation++; clearTimeout(timer); clearTimeout(expiry); timer = null; expiry = null;
    if (request) request.abort(); request = null; lastSample = null;
  };
  const schedule = delay => {
    clearTimeout(timer); timer = setTimeout(poll, delay);
    if (timer && timer.unref) timer.unref();
  };
  const poll = async () => {
    if (closed || !roomId || request) return;
    const current = generation, userVersion = auth.version(), requestedAt = Date.now();
    const pending = request = http.request('/TranslationRooms/' + encodeURIComponent(roomId) + '/location', { timeout: 10000 });
    try {
      const result = await pending;
      if (closed || current !== generation || userVersion !== auth.version()) return;
      const sampledAt = Date.parse(result.sampledAt), serverTime = Date.parse(result.serverTime), now = Date.now();
      const age = serverTime - sampledAt + now - requestedAt;
      const valid = result.roomId === roomId && result.coordinateSystem === 'GCJ-02'
        && typeof result.longitude === 'number' && Number.isFinite(result.longitude) && Math.abs(result.longitude) <= 180
        && typeof result.latitude === 'number' && Number.isFinite(result.latitude) && Math.abs(result.latitude) <= 90
        && typeof result.accuracy === 'number' && Number.isFinite(result.accuracy) && result.accuracy > 0 && result.accuracy <= 500;
      if (result.status !== 'online' || !valid || !Number.isFinite(age) || age < -2000 || age > MAX_FIX_AGE_MS) {
        clearTimeout(expiry); expiry = null;
        error(result.status === 'stopped' ? 'driverStopped' : result.status === 'closed' ? 'driverRoomEnded' : 'driverWaiting');
        return;
      }
      if (lastSample !== null && sampledAt <= lastSample) return;
      lastSample = sampledAt;
      const gcj = { longitude: result.longitude, latitude: result.latitude };
      const timestamp = now - Math.max(0, age);
      clearTimeout(expiry);
      expiry = setTimeout(() => { if (!closed && current === generation) error('driverWaiting'); }, Math.max(1, MAX_FIX_AGE_MS - Math.max(0, age)));
      if (expiry && expiry.unref) expiry.unref();
      diag('location-fix', { source: 'driver', foreground, accuracy: result.accuracy, ageMs: age });
      onFix(Object.assign(gcj02ToWgs84(gcj), { gcj, accuracy: result.accuracy, heading: null, timestamp, receivedAt: now, timestampSource: 'server', source: 'driver', roomId }));
    } catch (failure) {
      if (!closed && current === generation && userVersion === auth.version() && !failure.cancelled) error(failure.status === 403 ? 'driverRoomRequired' : failure.status === 404 ? 'driverUnavailable' : 'driverNetwork');
    } finally {
      if (request === pending) request = null;
      if (!closed && current === generation && roomId) schedule(1000);
    }
  };
  const unsubscribe = translation.subscribe(state => {
    const room = state.room;
    const next = room && !room.isHost && !state.disconnected && !['closed', 'draining'].includes(room.status) && typeof room.roomId === 'string' ? room.roomId : '';
    if (closed || next === roomId && roomId) return;
    clear(); roomId = next;
    error(next ? 'driverWaiting' : 'driverRoomRequired');
    if (next) poll();
  });
  const stop = () => { closed = true; clear(); unsubscribe(); };
  stop.refresh = () => { if (!closed) { clear(); if (roomId) poll(); else error('driverRoomRequired'); } };
  return stop;
}
module.exports = { watch, setForeground, reportCapabilities };
