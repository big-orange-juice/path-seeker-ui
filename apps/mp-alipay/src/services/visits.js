const http = require('./http');
const auth = require('./auth');
const storage = require('./storage');
const { mergeVisitArrivalProgress } = require('../shared/tour-auto-trigger');
const pendingWrites = new Map();
function writeVisit(visit, user, action) {
  const version = auth.version();
  const writeKey = user + ':' + visit.visitId;
  const previous = pendingWrites.get(writeKey);
  const run = () => {
    if (!auth.current() || auth.current().userId !== user || auth.version() !== version) throw Error('账号已切换');
    return action();
  };
  const task = previous ? previous.catch(() => {}).then(run) : run();
  pendingWrites.set(writeKey, task);
  const release = () => { if (pendingWrites.get(writeKey) === task) pendingWrites.delete(writeKey); };
  task.then(release, release);
  return task;
}
function key() { return storage.scoped(auth.current().userId, 'visits'); }
function list() { return auth.current() ? storage.read(key(), []) : []; }
function remember(visit, route, user = auth.current() && auth.current().userId) {
  if (!user || !auth.current() || user !== auth.current().userId) throw Error('账号已切换');
  visit = mergeVisitArrivalProgress(list().find(item => item.visitId === visit.visitId), visit);
  const records = list().filter(r => r.visitId !== visit.visitId);
  records.unshift(Object.assign({}, visit, { title: route.title, cover: route.cover, updatedAt: new Date().toISOString() }));
  storage.write(key(), records.slice(0, 100));
  return visit;
}
async function start(route, locale) { const user = auth.current().userId; return remember(await http.post('/RouteVisit/Start', { routeId: route.id, locale }), route, user); }
async function update(visit, stageId, action, route, completionSource = 1) {
  const user = auth.current().userId;
  return writeVisit(visit, user, async () => remember(await http.post('/RouteVisit/UpdateStop', { routeId: visit.routeId, visitId: visit.visitId, stageId, action, completionSource }), route, user));
}
async function abandon(visit, route) { const user = auth.current().userId; return writeVisit(visit, user, async () => remember(await http.post('/RouteVisit/Abandon', { routeId: visit.routeId, visitId: visit.visitId }), route, user)); }
module.exports = { list, remember, start, update, abandon };
