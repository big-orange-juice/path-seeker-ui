const http = require('./http');
const auth = require('./auth');
const storage = require('./storage');
function key() { return storage.scoped(auth.current().userId, 'visits'); }
function list() { return auth.current() ? storage.read(key(), []) : []; }
function remember(visit, route, user = auth.current() && auth.current().userId) {
  if (!user || !auth.current() || user !== auth.current().userId) throw Error('账号已切换');
  const records = list().filter(r => r.visitId !== visit.visitId);
  records.unshift(Object.assign({}, visit, { title: route.title, cover: route.cover, updatedAt: new Date().toISOString() }));
  storage.write(key(), records.slice(0, 100));
  return visit;
}
async function start(route, locale) { const user = auth.current().userId; return remember(await http.post('/RouteVisit/Start', { routeId: route.id, locale }), route, user); }
async function update(visit, stageId, action, route, completionSource = 1) {
  const user = auth.current().userId;
  return remember(await http.post('/RouteVisit/UpdateStop', { routeId: visit.routeId, visitId: visit.visitId, stageId, action, completionSource }), route, user);
}
async function abandon(visit, route) { const user = auth.current().userId; return remember(await http.post('/RouteVisit/Abandon', { routeId: visit.routeId, visitId: visit.visitId }), route, user); }
module.exports = { list, remember, start, update, abandon };
