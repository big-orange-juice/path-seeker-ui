const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId, plain } = require('./harness.cjs');

const routeId = '9223372036854775805';
const firstId = '9223372036854775804', barId = '9223372036854775803', nextId = '9223372036854775802';
function setup() {
  const h = harness(), page = h.page('tour');
  const route = { id: routeId, title: '导游路线-A线', locale: 'zh' };
  const stops = [firstId, barId, nextId].map((id, index) => ({
    id, name: ['什刹海体校·出发', '后海酒吧街', '张伯驹潘素故居'][index], order: index + 1,
    longitude: 116.38, latitude: 39.94 + index * 0.01, images: [], extraAudios: [],
    guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'chapter-' + id, audioUrl: '/' + id + '.mp3' }] }],
  }));
  const visit = { visitId: 'old-visit', routeId, status: 1, currentStageId: barId, completedStageIds: [firstId] };
  page._rev = 0; page._visible = true; page._user = userId; page._places = [];
  page._detail = { coordinateSystem: 1 };
  page.setData({ route, stops, visit, tourStage: 'navigation', autoplay: true });
  page.showStop(1, false);
  return { h, page, route, stops, visit, audio: h.load('services/audio'), storage: h.load('services/storage') };
}

test('ending at Houhai clears the queue and checkpoint, and the next journey enters the first stop', async () => {
  const { h, page, visit, audio, storage } = setup();
  page.sequenceStatus(barId, 'playing', 1); page.sequenceStatus(nextId, 'queued', 2);
  page.play();
  assert.ok(storage.read(storage.scoped(userId, 'checkpoint')));
  const ending = page.endVisit(); h.confirms[0].success({ confirm: true }); await tick();
  h.requests[0].ok({ ...visit, status: 3 }); await ending; await tick();
  assert.equal(page.data.stop.id, firstId); assert.equal(page.data.stopIndex, 0);
  assert.deepEqual(plain(page.data.sequence), []); assert.equal(page.data.queuedCount, 0);
  assert.equal(audio.snapshot().item, null);
  assert.equal(storage.read(storage.scoped(userId, 'checkpoint')), null);
  assert.equal(storage.read(storage.scoped(userId, 'sequence')), null);
  page.onHide(); page.onShow(); assert.equal(page.data.stop.id, firstId);
  const starting = page.startVisit();
  assert.match(h.requests[1].options.url, /RouteVisit\/Start$/);
  const fresh = { visitId: 'new-visit', routeId, status: 1, currentStageId: null, completedStageIds: [] };
  h.requests[1].ok(fresh); await tick();
  assert.equal(h.requests[2].options.data.stageId, firstId);
  h.requests[2].ok({ ...fresh, currentStageId: firstId }); await starting;
  assert.deepEqual(plain(page.data.sequence.map(item => item.id)), [firstId]);
  page.onUnload();
});

test('a fresh visit starts at the first stop even when the last preview was Houhai', async () => {
  const { h, page, visit } = setup(); page.setData({ visit: { ...visit, status: 3 } });
  const starting = page.startVisit();
  const fresh = { visitId: 'new-visit', routeId, status: 1, currentStageId: null, completedStageIds: [] };
  h.requests[0].ok(fresh); await tick();
  assert.equal(h.requests[1].options.data.stageId, firstId);
  h.requests[1].ok({ ...fresh, currentStageId: firstId }); await starting; page.onUnload();
});

test('restoring navigation without a room keeps autoplay off until the current stop is played manually', async () => {
  const { h, page, route, stops, visit, audio } = setup();
  page.setData({ autoplay: false });
  const selecting = page.selectRoute(routeId, true);
  h.requests[0].ok({ route, stops, coordinateSystem: 1 }); await tick();
  h.requests[1].ok(visit); await selecting;
  assert.equal(page.data.locationEnabled, false); assert.equal(page.data.autoplay, false);
  assert.equal(audio.snapshot().item, null);
  assert.equal(page.data.sequence.find(item => item.id === barId).status, 'queued');
  assert.equal(page.data.contentOpen, false);
  page.playQueued({ currentTarget: { dataset: { id: barId } } });
  assert.equal(audio.snapshot().item.id, 'chapter-' + barId);
  assert.equal(page.data.sequence.find(item => item.id === barId).status, 'playing');
  assert.equal(page.data.contentOpen, false); page.onUnload();
});

test('selecting a route in overview does not autoplay its unfinished visit', async () => {
  const { h, page, route, stops, visit, audio } = setup();
  const selecting = page.selectRoute(routeId);
  h.requests[0].ok({ route, stops, coordinateSystem: 1 }); await tick();
  h.requests[1].ok(visit); await selecting;
  assert.equal(page.data.tourStage, 'overview'); assert.equal(audio.snapshot().item, null);
  page.onUnload();
});

test('Houhai video keeps nearby detection active and the next stop plays after the video finishes', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  const { h, page, visit, audio, stops } = setup();
  stops[1].video = '/bar.mp4';
  h.my.createVideoContext = () => ({ pause() {}, play() {} });
  let fix;
  h.load('services/location').watch = onFix => { fix = onFix; return () => {}; };
  page.setData({ browsing: true, locationEnabled: true });
  page.enqueueCandidates([{ id: barId, index: 1, distance: 2, order: 2 }]);
  h.requests[0].ok(visit); await tick();
  assert.equal(audio.snapshot().playing, true); assert.equal(page.canPromptArrival(), true);
  h.audioContexts[0].emit('Ended');
  assert.equal(audio.snapshot().item.id, 'stop-video-' + barId);
  page.watchLocation();
  const deliver = () => fix({ longitude: stops[2].longitude, latitude: stops[2].latitude, accuracy: 10, timestamp: Date.now() });
  deliver(); t.mock.timers.tick(2000); deliver();
  assert.equal(page.data.arrivalCandidate.id, nextId);
  t.mock.timers.tick(3000);
  assert.equal(page.data.sequence.find(item => item.id === nextId).status, 'queued');
  assert.equal(h.requests.length, 1);
  const video = page.data.videoItem;
  page.videoEnded({ currentTarget: { dataset: { id: video.id, generation: video.generation } } });
  assert.equal(h.requests[1].options.data.action, 'complete');
  h.requests[1].ok({ ...visit, completedStageIds: [firstId, barId] }); await tick();
  assert.equal(h.requests[2].options.data.stageId, nextId);
  h.requests[2].ok({ ...visit, currentStageId: nextId, completedStageIds: [firstId, barId] }); await tick();
  assert.equal(audio.snapshot().item.id, 'chapter-' + nextId);
  assert.equal(page.canPromptArrival(), true); assert.equal(page.data.contentOpen, false);
  page.onUnload();
});

test('cold launch discards an ended visit queue, while a failed end leaves the active journey intact', async () => {
  const { h, page, route, stops, visit, storage, audio } = setup();
  storage.write(storage.scoped(userId, 'sequence'), { routeId, visitId: visit.visitId, items: [{ id: barId, status: 'playing' }] });
  page.play();
  const ending = page.endVisit(); h.confirms[0].success({ confirm: true }); await tick();
  h.requests[0].reject({ errorMessage: '网络不可用' }); await ending;
  assert.equal(page.data.visit.status, 1); assert.equal(page.data.stop.id, barId);
  assert.equal(audio.snapshot().playing, true); assert.ok(page.data.error);
  page.onUnload();
  const reopened = harness();
  for (const [key, value] of h.storage) reopened.storage.set(key, value);
  const freshPage = reopened.page('tour');
  freshPage.onLoad({ lang: 'zh', routeId }); await tick();
  reopened.requests[0].ok({ routes: [route], destinations: [], places: [] }); await tick();
  reopened.requests[1].ok({ route, stops, coordinateSystem: 1 }); await tick();
  reopened.requests[2].ok(null); await tick();
  assert.equal(freshPage.data.tourStage, 'overview'); assert.equal(freshPage.data.stop.id, firstId);
  assert.deepEqual(plain(freshPage.data.sequence), []); freshPage.onUnload();
});

test('ending a journey clears its room and cancels pending recovery, while a failed end keeps the room', async () => {
  const { h, page, visit } = setup();
  const session = h.load('services/translation-session');
  const sockets = [];
  h.load('services/translation-room').connect = value => { sockets.push(value); return { close() {}, pause() {} }; };
  session.attach({ roomId: '9223372036854775801', code: '12345678', status: 'paused', isHost: false }, 'en');
  const cacheKey = 'path-seeker:alipay:v1:user:' + userId + ':commentary-room';
  const failed = page.endVisit(); h.confirms[0].success({ confirm: true }); await tick();
  h.requests[0].reject({ errorMessage: 'offline' }); await failed;
  assert.equal(h.storage.has(cacheKey), true);
  session.suspend();
  const restoring = session.resume(), pending = h.requests[1];
  const ending = page.endVisit(); h.confirms[1].success({ confirm: true }); await tick();
  h.requests[2].ok({ ...visit, status: 3 }); await ending;
  assert.equal(pending.aborted, true);
  assert.equal(h.storage.has(cacheKey), false);
  assert.equal(session.snapshot().room, null);
  pending.ok({ roomId: '9223372036854775801', code: '12345678', status: 'paused', isHost: false });
  await restoring;
  h.requests[3].ok({});
  await session.resume();
  assert.equal(h.requests.length, 4);
  assert.equal(sockets.length, 1);
  page.onUnload();
});
