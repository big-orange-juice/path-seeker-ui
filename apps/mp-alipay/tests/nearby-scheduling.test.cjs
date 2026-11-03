const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId, session } = require('./harness.cjs');

function setup(t) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  const h = harness(), page = h.page('tour');
  page.driverRoomAvailable = () => true;
  const stops = ['current', 'bar', 'next'].map((id, index) => ({
    id, placeId: 'place-' + id, name: id, order: index + 1, images: [],
    longitude: 116.38, latitude: 39.94,
    guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'chapter-' + id, audioUrl: '/' + id + '.mp3' }] }],
  }));
  page._rev = 0; page._visible = true; page._user = userId; page._detail = { coordinateSystem: 1 };
  page._places = stops.map(s => ({ id: s.placeId, longitude: s.longitude, latitude: s.latitude, range: { type: 'circle', radiusMeters: 30, proximityDistanceMeters: 5 } }));
  page.setData({ tourStage: 'navigation', route: { id: 'route' }, stops,
    visit: { visitId: 'visit', routeId: 'route', status: 1, currentStageId: 'current', completedStageIds: ['current'] } });
  page.showStop(0, true);
  let deliver;
  h.load('services/location').watch = callback => { deliver = callback; return () => {}; };
  page.toggleTracking();
  const fix = () => deliver({ longitude: 116.38, latitude: 39.94, accuracy: 10, timestamp: Date.now() });
  return { h, page, fix, audio: h.load('services/audio') };
}

test('overlapping arrival queues one stop without silently dismissing the other', async t => {
  const { h, page, fix } = setup(t);
  fix(); t.mock.timers.tick(2000); fix(); t.mock.timers.tick(3000);
  assert.equal(h.requests[0].options.data.stageId, 'bar');
  h.requests[0].ok({ ...page.data.visit, currentStageId: 'bar' }); await tick();
  fix(); t.mock.timers.tick(2000); fix();
  assert.equal(page.data.arrivalCandidate && page.data.arrivalCandidate.id, 'next');
  t.mock.timers.tick(3000);
  assert.equal(page.data.sequence.find(s => s.id === 'next').status, 'queued');
  assert.equal(h.requests.length, 1);
  page.onUnload();
});

test('a continuously nearby circle matures while another candidate enters and leaves', t => {
  const { h, page, fix } = setup(t);
  const tour = h.load('core/tour'); let includeNext = true;
  tour.candidates = () => [
    { id: 'bar', index: 1, distance: 0, order: 2 },
    ...(includeNext ? [{ id: 'next', index: 2, distance: 4, order: 3 }] : []),
  ];
  fix(); t.mock.timers.tick(2000); includeNext = false; fix();
  assert.equal(page.data.arrivalCandidate && page.data.arrivalCandidate.id, 'bar');
  t.mock.timers.tick(1000); includeNext = true; fix(); t.mock.timers.tick(2000);
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].options.data.stageId, 'bar');
  page.onUnload();
});

test('an explicitly dismissed stop becomes eligible again after leaving only its own circle', t => {
  const { h, page, fix } = setup(t);
  const tour = h.load('core/tour'); let includeNext = true;
  tour.candidates = () => [{ id: 'bar', index: 1, distance: 0, order: 2 }, ...(includeNext ? [{ id: 'next', index: 2, distance: 4, order: 3 }] : [])];
  page.setData({ autoplay: false }); fix(); t.mock.timers.tick(2000); fix(); page.dismissCandidates();
  includeNext = false; fix(); includeNext = true; t.mock.timers.tick(2000); fix(); t.mock.timers.tick(2000); fix();
  assert.equal(page.data.arrivalCandidate && page.data.arrivalCandidate.id, 'next');
  page.onUnload();
});

test('a transient automatic start failure retries on later GPS fixes without duplicate parallel starts', async t => {
  const { h, page, fix, audio } = setup(t);
  page.enqueueCandidates([{ id: 'bar', index: 1, distance: 0, order: 2 }]);
  h.requests[0].reject({ errorMessage: '网络暂时不可用' }); await tick();
  fix(); assert.equal(h.requests.length, 1);
  t.mock.timers.tick(6000); fix(); fix();
  assert.equal(h.requests.length, 2);
  h.requests[1].ok({ ...page.data.visit, currentStageId: 'bar' }); await tick();
  assert.equal(audio.snapshot().playing, true); assert.equal(audio.snapshot().item.id, 'chapter-bar');
  page.onUnload();
});

test('a pending automatic playback intent cannot start from route overview', async t => {
  const { h, page, audio } = setup(t);
  page.enqueueCandidates([{ id: 'bar', index: 1, distance: 0, order: 2 }]);
  page.changeLock({ detail: { value: true } });
  h.requests[0].ok({ ...page.data.visit, currentStageId: 'bar' }); await tick();
  page.backToOverview(); page.changeLock({ detail: { value: false } });
  assert.equal(page.data.tourStage, 'overview'); assert.equal(audio.snapshot().item, null);
  page.onUnload();
});

test('starting with guidance already enabled flushes the first stop once the request settles', async t => {
  const { h, page, audio } = setup(t);
  page.setData({ tourStage: 'overview', visit: null });
  const starting = page.startVisit();
  const visit = { visitId: 'new', routeId: 'route', status: 1, completedStageIds: [] };
  h.requests[0].ok(visit); await tick();
  h.requests[1].ok({ ...visit, currentStageId: 'current' }); await starting;
  assert.equal(audio.snapshot().playing, true); assert.equal(audio.snapshot().item.id, 'chapter-current');
  page.onUnload();
});

test('same-visit arrival and completion writes are serialized and a failed write releases the next one', async () => {
  const h = harness(), visits = h.load('services/visits');
  const visit = { visitId: 'visit', routeId: 'route', status: 1 }, route = { id: 'route' };
  const arrival = visits.update(visit, 'palace', 'arrive', route);
  const complete = visits.update(visit, 'bar', 'complete', route);
  assert.equal(h.requests.length, 1);
  h.requests[0].reject({ errorMessage: '网络错误' }); await assert.rejects(arrival); await tick();
  assert.equal(h.requests.length, 2);
  h.requests[1].ok({ ...visit, currentStageId: 'bar', completedStageIds: ['bar'] });
  await complete;
});

test('a failed automatic completion retains its intent and later fixes resume the queued stop', async t => {
  const { h, page, fix, audio } = setup(t);
  page.showStop(1, false); page.setData({ visit: { ...page.data.visit, currentStageId: 'bar' } }); page.play();
  page.enqueueCandidates([{ id: 'next', index: 2, distance: 0, order: 3 }]);
  h.audioContexts[0].emit('Ended');
  assert.equal(h.requests[0].options.data.action, 'complete');
  h.requests[0].reject({ errorMessage: '网络暂时不可用' }); await tick();
  fix(); assert.equal(h.requests.length, 1);
  t.mock.timers.tick(6000); fix(); fix(); assert.equal(h.requests.length, 2);
  h.requests[1].ok({ ...page.data.visit, completedStageIds: ['current', 'bar'] }); await tick();
  assert.equal(h.requests[2].options.data.stageId, 'next');
  h.requests[2].ok({ ...page.data.visit, currentStageId: 'next' }); await tick();
  assert.equal(audio.snapshot().item.id, 'chapter-next'); assert.equal(audio.snapshot().playing, true);
  page.onUnload();
});

test('same-ID reauthentication invalidates queued visit writes from the previous identity', async () => {
  const h = harness(), visits = h.load('services/visits');
  const visit = { visitId: 'visit', routeId: 'route', status: 1 }, route = { id: 'route' };
  const first = visits.update(visit, 'palace', 'arrive', route);
  const second = visits.update(visit, 'bar', 'complete', route);
  const settled = Promise.allSettled([first, second]);
  const login = h.auth.login({ account: 'formal', password: 'password' });
  h.requests[1].ok({ ...session(userId, 'new-token'), isGuest: false }); await login;
  h.requests[0].ok({ ...visit, visitedStageIds: ['palace'] });
  const results = await settled;
  assert.ok(results.every(result => result.status === 'rejected'));
  assert.equal(h.requests.length, 2);
});

test('business rejection is surfaced without automatic GPS write retries', async t => {
  const { h, page, fix } = setup(t);
  page.enqueueCandidates([{ id: 'bar', index: 1, distance: 0, order: 2 }]);
  h.requests[0].text({ code: 12011, message: '行程不可用' }); await tick();
  for (let i = 0; i < 4; i++) { t.mock.timers.tick(6000); fix(); }
  assert.equal(h.requests.length, 1); assert.match(page.data.error, /行程不可用/);
  page.onUnload();
});
