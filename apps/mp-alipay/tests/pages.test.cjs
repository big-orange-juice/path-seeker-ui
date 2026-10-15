const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, plain, userId, session } = require('./harness.cjs');
const routeId = '9223372036854775805', stageId = '9223372036854775804', visitId = '9223372036854775803';
const route = () => ({ id: routeId, title: '城市漫游', locale: 'zh', familyCode: 'city', destinationId: 'destination' });
const stop = (id = stageId, order = 1) => ({ id, name: '站点 ' + order, order, longitude: 116.383, latitude: 39.937, images: [], extraAudios: [], guideNarrations: [{ guideId: 'guide', guideName: '向导', locale: 'zh', chapters: [{ id: 'chapter-' + id, order: 1, title: '故事', audioUrl: 'chapter.mp3', text: '站点故事' }] }] });
const visit = (overrides = {}) => Object.assign({ visitId, routeId, status: 1, currentStageId: stageId, completedStageIds: [] }, overrides);
function tourPage(h, active = null) {
  const p = h.page('tour'); p._rev = 0; p._user = userId; p._visible = true; p._places = [];
  p.setData({ route: route(), stops: [stop()], visit: active, loading: false, autoplay: false });
  p._detail = { route: p.data.route, stops: p.data.stops, coordinateSystem: 1 };
  p.showStop(0, !active); return p;
}
test('route selection accepts a null active visit and defaults to browsing the first stop', async () => {
  const h = harness(), p = tourPage(h);
  const selection = p.selectRoute(routeId); h.requests[0].ok({ route: route(), stops: [stop()], coordinateSystem: 1 }); await tick();
  assert.match(h.requests[1].options.url, /RouteVisit\/Active/); h.requests[1].ok(null); await selection;
  assert.equal(p.data.stop.id, stageId); assert.equal(p.data.visit, null); assert.equal(p.data.browsing, true); assert.equal(p.data.loading, false);
  p.play(); h.audioContexts[0].emit('Ended'); await tick(); assert.equal(h.requests.length, 2);
});
test('late route response cannot replace the latest selection; missing route stays actionable', async () => {
  const h = harness(), p = tourPage(h), first = p.selectRoute('first'), last = p.selectRoute(routeId);
  h.requests[1].ok({ route: route(), stops: [stop()] }); await tick(); h.requests[2].ok(null); await last;
  h.requests[0].ok({ route: { id: 'first', locale: 'zh' }, stops: [] }); await first;
  assert.equal(p.data.route.id, routeId); assert.equal(h.requests.length, 3);
  const absent = p.selectRoute('absent'); h.requests[3].ok({ route: null, stops: [] }); await absent;
  assert.ok(p.data.error); assert.equal(p.data.loading, false); assert.equal(h.requests.length, 4);
});
test('tour audio completes only after before, chapter and after; reports System completion', async () => {
  const h = harness(), p = tourPage(h, visit());
  p.data.stop.extraAudios = [{ id: 'before', order: 1, position: 'before', url: 'before.mp3' }, { id: 'after', order: 1, position: 'after', url: 'after.mp3' }];
  p.play(); h.audioContexts[0].emit('Ended'); assert.equal(h.requests.length, 0);
  h.audioContexts[1].emit('Ended'); assert.equal(h.requests.length, 0);
  h.audioContexts[2].emit('Ended'); assert.equal(h.requests[0].options.data.completionSource, 2); assert.equal(h.requests[0].options.data.stageId, stageId);
  h.requests[0].ok(visit({ status: 2, completedStageIds: [stageId] })); await tick();
  assert.equal(p.data.visit.status, 2); assert.equal(p.data.sequence[0].status, 'completed');
});
test('manual completion reports Manual and preview playback never changes visit progress', async () => {
  const h = harness(), p = tourPage(h, visit()); p.showStop(0, true); p.play(); h.audioContexts[0].emit('Ended'); await tick();
  assert.equal(h.requests.length, 0); await p.complete(); assert.equal(h.requests.length, 0);
  p.showStop(0, false); const complete = p.complete(1); assert.equal(h.requests[0].options.data.completionSource, 1);
  h.requests[0].ok(visit({ status: 2, completedStageIds: [stageId] })); await complete;
});
test('single extra audio never completes the main narration', async () => {
  const h = harness(), p = tourPage(h, visit()); p.data.stop.extraAudios = [{ id: 'extra', position: 'after', url: 'extra.mp3' }];
  p.playExtra({ currentTarget: { dataset: { id: 'extra' } } }); h.audioContexts[0].emit('Ended'); await tick();
  assert.equal(h.requests.length, 0); assert.equal(p.data.visit.status, 1);
});
test('checkpoint resumes only its account, visit, route, stop, guide, locale and queue options', () => {
  for (const change of [null, { userId: 'other' }, { visitId: 'other' }, { routeId: 'other' }, { stageId: 'other' }, { guideId: 'other' }, { locale: 'en' }, { skipExtra: true }, { itemId: 'missing' }, { updatedAt: Date.now() - 21600001 }]) {
    const h = harness(), p = tourPage(h, visit()), storage = h.load('services/storage');
    const cp = Object.assign({ userId, visitId, routeId, stageId, guideId: 'guide', locale: 'zh', skipExtra: false, itemId: 'chapter-' + stageId, time: 14, updatedAt: Date.now() }, change);
    storage.write(storage.scoped(userId, 'checkpoint'), cp); p.play(true); h.audioContexts[0].emit('CanPlay');
    assert.equal(h.audioContexts[0].currentTime, change ? 0 : 14, JSON.stringify(change));
  }
});
test('language selection picks the published sibling route and resumes foreground location watching', async () => {
  const h = harness(), p = tourPage(h); let watchers = 0;
  h.load('services/location').watch = () => { watchers++; return () => {}; };
  p.setData({ locationEnabled: true });
  const change = p.chooseLocale({ detail: { value: 1 } });
  h.requests[0].ok({ routes: [{ ...route(), id: 'en-route', locale: 'en' }, route()], destinations: [], places: [] }); await tick();
  assert.match(h.requests[1].options.url, /routeId=en-route/); h.requests[1].ok({ route: { ...route(), id: 'en-route', locale: 'en' }, stops: [] }); await tick();
  h.requests[2].ok(null); await change;
  assert.equal(p.data.routes.length, 1); assert.equal(p.data.route.id, 'en-route'); assert.equal(p.data.messages.play, 'Play narration'); assert.equal(watchers, 1);
});
test('nearby stops queue by distance without interrupting playback and deduplicate repeated fixes', () => {
  const h = harness(), p = tourPage(h, visit()); p.setData({ stops: [stop(), stop('near', 2), stop('far', 3)], autoplay: true }); p.play();
  const candidates = [{ id: 'far', name: '远处', index: 2, order: 3, distance: 20 }, { id: 'near', name: '附近', index: 1, order: 2, distance: 5 }];
  p.enqueueCandidates(candidates); p.enqueueCandidates(candidates);
  assert.deepEqual(plain(p.data.sequence.map(i => i.id)), ['near', 'far']); assert.equal(h.requests.length, 0); assert.equal(h.audioContexts.length, 1);
});
test('queued nearby stop starts after current narration completes and preserves long stage ID', async () => {
  const h = harness(), p = tourPage(h, visit()), nextId = '9223372036854775802';
  p.setData({ stops: [stop(), stop(nextId, 2)], autoplay: true, locationEnabled: true });
  p.enqueueCandidates([{ id: nextId, index: 1, order: 2, distance: 5 }]); p.play(); h.audioContexts[0].emit('Ended');
  h.requests[0].ok(visit({ completedStageIds: [stageId] })); await tick();
  assert.equal(h.requests[1].options.data.action, 'start'); assert.equal(h.requests[1].options.data.stageId, nextId);
  h.requests[1].ok(visit({ currentStageId: nextId, completedStageIds: [stageId] })); await tick();
  assert.equal(p.data.stop.id, nextId); assert.equal(h.audioContexts.length, 2); assert.equal(p.data.busy, false);
});
test('manual browsing and content lock block automatic queued playback while explicit play is available', async () => {
  const h = harness(), p = tourPage(h, visit()); p.setData({ stops: [stop(), stop('next', 2)], autoplay: true });
  p._manualBrowse = true; p.showStop(0, true);
  p.enqueueCandidates([{ id: 'next', index: 1, order: 2, distance: 3 }]); assert.equal(h.requests.length, 0);
  p._manualBrowse = false; p.setData({ lockContent: true }); p.startNextSequence(); assert.equal(h.requests.length, 0);
  p.playQueued({ currentTarget: { dataset: { id: 'next' } } }); assert.equal(h.requests[0].options.data.stageId, 'next');
  h.requests[0].ok(visit({ currentStageId: 'next' })); await tick(); assert.equal(p.data.browsing, false);
});
test('restored playback sequence reconciles server progress and discards another visit', () => {
  const h = harness(), p = tourPage(h, visit({ completedStageIds: [stageId] })), storage = h.load('services/storage'); p.setData({ stops: [stop(), stop('next', 2)] });
  const saved = { routeId, visitId, items: [{ id: stageId, status: 'queued' }, { id: 'next', status: 'skipped' }, { id: 'gone', status: 'queued' }] };
  storage.write(storage.scoped(userId, 'sequence'), saved); p.restoreSequence();
  assert.deepEqual(plain(p.data.sequence.map(i => i.status)), ['completed', 'skipped']);
  storage.write(storage.scoped(userId, 'sequence'), { ...saved, visitId: 'other' }); p.restoreSequence();
  assert.deepEqual(plain(p.data.sequence.map(i => i.id)), [stageId]);
});
test('destination boundaries, polygon holes and circular place ranges render alongside native markers', () => {
  const h = harness(), tour = h.load('core/tour'), ring = [[116.38, 39.93], [116.39, 39.93], [116.39, 39.94], [116.38, 39.93]];
  const detail = { route: route(), coordinateSystem: 1, stops: [{ ...stop(), placeId: 'place' }], geometry: { type: 'LineString', coordinates: [[116.38, 39.93], [116.39, 39.94]] } };
  const map = tour.mapData(detail, { boundaryGeoJson: JSON.stringify({ type: 'Polygon', coordinates: [ring, ring] }) }, [{ id: 'place', longitude: 116.383, latitude: 39.937, range: { type: 'circle', radiusMeters: 30 } }]);
  assert.equal(map.markers[0].id, 1); assert.equal(map.polyline.length, 4); assert.ok(map.polyline[2].points.length > 4); assert.notEqual(map.markers[0].longitude, 116.383);
});
test('old account confirmation cannot log out or clear the newly logged-in account', async () => {
  for (const action of ['logout', 'clearHistory']) {
    const h = harness(), p = h.page('me'); p._visible = true; p._seq = 1;
    const pending = p[action](); const login = h.auth.login({ account: 'new', password: 'password' }); h.requests[0].ok(session('other', 'new-token')); await login;
    h.confirms[0].success({ confirm: true }); await pending; assert.equal(h.auth.current().userId, 'other'); assert.equal(h.requests.length, 1);
  }
});
test('login completion after leaving the page does not navigate unexpectedly', async () => {
  const h = harness(), p = h.page('auth'); let navigations = 0; h.my.switchTab = () => navigations++;
  p.onShow(); p.setData({ agreed: true, account: 'name', password: 'password' }); const pending = p.submit(); p.onHide(); h.requests[0].ok(session('registered', 'registered-token')); await pending;
  assert.equal(navigations, 0); assert.equal(h.auth.current().userId, 'registered'); assert.equal(p.data.password, '');
});
test('chat ignores an old initialization response after hiding and reopening', async () => {
  const h = harness(), p = h.page('chat'); p.onLoad(); p._visible = true; const old = p.initialize(); await tick();
  p.onHide(); p._visible = true; const current = p.initialize(); await tick(); h.requests[1].ok([{ id: 'current', title: 'new' }]); await current;
  h.requests[0].ok([{ id: 'old', title: 'stale' }]); await old;
  assert.equal(p.data.sessions[0].id, 'current'); assert.equal(p.data.loading, false); assert.equal(h.requests.length, 2);
});

test('GPS stability adds nearby stops while manual browsing keeps current content', () => {
  const h = harness(), p = tourPage(h, visit()); let fix;
  h.load('services/location').watch = callback => { fix = callback; return () => {}; };
  const candidate = { id: 'next', index: 1, order: 2, distance: 4 };
  h.load('core/tour').candidates = () => [candidate];
  p.setData({ stops: [stop(), stop('next', 2)], locationEnabled: true, autoplay: true });
  p._manualBrowse = true; p.showStop(0, true); p.watchLocation();
  fix({ accuracy: 10 }); assert.equal(p.data.sequence.length, 0);
  p._dwell.at = Date.now() - 2000; fix({ accuracy: 10 });
  assert.equal(p.data.sequence[0].id, 'next'); assert.equal(h.requests.length, 0); assert.equal(p.data.stop.id, stageId); assert.equal(p.data.candidates[0].id, 'next');
  p.dismissCandidates(); fix({ accuracy: 10 }); assert.equal(p.data.candidates.length, 0);
});

test('nearby prompt can explicitly enter a candidate and starts that stop', async () => {
  const h = harness(), p = tourPage(h, visit());
  p.setData({ stops: [stop(), stop('next', 2)], candidates: [{ id: 'next', index: 1, name: '下一站', distance: 5, distanceLabel: '5 米', approaching: true }] });
  p.enterCandidate({ currentTarget: { dataset: { id: 'next' } } });
  assert.equal(h.requests[0].options.data.stageId, 'next');
  h.requests[0].ok(visit({ currentStageId: 'next' })); await tick();
  assert.equal(p.data.browsing, false); assert.equal(p.data.stop.id, 'next');
});

test('skipped queued stop is not added again by repeated nearby fixes', () => {
  const h = harness(), p = tourPage(h, visit()); p.setData({ stops: [stop(), stop('next', 2)] });
  const candidate = { id: 'next', index: 1, order: 2, distance: 4 };
  p.enqueueCandidates([candidate]); p.skipQueued({ currentTarget: { dataset: { id: 'next' } } }); p.enqueueCandidates([candidate]);
  assert.equal(p.data.sequence.length, 1); assert.equal(p.data.sequence[0].status, 'skipped'); assert.equal(p.nextSequenceIndex(), -1);
});
