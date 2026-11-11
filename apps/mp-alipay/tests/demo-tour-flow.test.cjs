const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId, plain } = require('./harness.cjs');

function setup(t, completed = []) {
  const h = harness(), page = h.page('tour'), audio = h.load('services/audio');
  const stops = ['A', 'B', 'C', 'D'].map((id, index) => ({
    id, name: id, order: index + 1, longitude: 116.38 + index * 0.003, latitude: 39.94,
    images: [], extraAudios: [], guideNarrations: [{ guideId: 'guide', locale: 'zh',
      chapters: [{ id: 'chapter-' + id, audioUrl: '/' + id + '.mp3' }] }],
  }));
  const visit = { visitId: 'visit', routeId: 'route', status: 1, currentStageId: 'A', completedStageIds: completed, visitedStageIds: [] };
  h.load('services/translation-session').snapshot = () => ({ room: { roomId: 'room', isHost: false, status: 'paused' }, paused: true, following: true });
  page._rev = 0; page._user = userId; page._visible = true; page._places = []; page._detail = { coordinateSystem: 1 };
  page._routeMatcher = h.load('core/route-location').createRouteMatcher({ enabled: false });
  page.setData({ route: { id: 'route', title: '验收路线' }, stops, visit, tourStage: 'navigation', autoplay: true, locationEnabled: true });
  page.showStop(0, completed.includes('A'));
  let onLocation;
  h.load('services/location').watch = callback => { onLocation = callback; return () => {}; };
  page.watchLocation();
  const fix = index => ({ ...stops[index], timestamp: Date.now(), accuracy: 10, source: 'driver', roomId: 'room' });
  t.after(() => page.onUnload());
  return { h, page, audio, visit, fix, deliver(index) { onLocation(fix(index)); } };
}

test('a playing browse preview can be explicitly promoted to a formal stop and completed', async t => {
  const { h, page, audio, visit } = setup(t);
  page.next();
  const preview = h.audioContexts[0];
  assert.equal(audio.snapshot().item.id, 'chapter-B');
  page.marker({ detail: { markerId: 2 } });
  assert.equal(preview.stopped, true);
  assert.equal(h.requests[0].options.data.action, 'start');
  assert.equal(h.requests[0].options.data.stageId, 'B');
  h.requests[0].ok({ ...visit, currentStageId: 'B' }); await tick();
  assert.equal(page.data.selectionMode, 'formal');
  assert.equal(page.data.visit.currentStageId, 'B');
  h.audioContexts.at(-1).emit('Ended');
  assert.equal(h.requests[1].options.data.action, 'complete');
  assert.equal(h.requests[1].options.data.stageId, 'B');
  h.requests[1].ok({ ...visit, currentStageId: 'B', completedStageIds: ['B'] }); await tick();
});

test('selecting the active formal stop opens content and resumes a pause without restarting it', async t => {
  const { h, page, audio } = setup(t);
  page.sequenceStatus('A', 'playing', 0); page.play();
  const original = h.audioContexts[0]; original.currentTime = 23;
  page.marker({ detail: { markerId: 1 } }); await tick();
  assert.equal(page.data.contentOpen, true);
  assert.equal(h.requests.length, 0);
  assert.equal(h.audioContexts.length, 1);
  page.togglePlay(); assert.equal(audio.snapshot().playing, false);
  page.setData({ contentOpen: false });
  page.marker({ detail: { markerId: 1 } }); await tick();
  assert.equal(page.data.contentOpen, true);
  assert.equal(audio.snapshot().playing, true);
  assert.equal(audio.snapshot().time, 23);
  assert.equal(h.audioContexts.length, 1);
  assert.equal(h.requests.length, 0);
});

test('manual insertion cancels the former stop across repeated arrivals and preserves other pending stops', async t => {
  const { h, page, visit } = setup(t, ['D']);
  page.sequenceStatus('A', 'playing', 0);
  page.sequenceStatus('C', 'queued', 2);
  page.sequenceStatus('D', 'completed', 3);
  page.play();
  page.marker({ detail: { markerId: 2 } });
  assert.equal(page.data.queuedCount, 2);
  h.requests[0].ok({ ...visit, currentStageId: 'B' }); await tick();
  page.closeContent();
  for (let i = 0; i < 3; i++) page.enqueueCandidates([{ id: 'A', index: 0, order: 1, distance: 0 }]);
  assert.equal(page.data.sequence.find(item => item.id === 'A').status, 'skipped');
  assert.equal(page.data.sequence.find(item => item.id === 'D').status, 'completed');
  assert.equal(page.data.queuedCount, 1);
  h.audioContexts.at(-1).emit('Ended');
  h.requests[1].ok({ ...visit, currentStageId: 'B', completedStageIds: ['B', 'D'] }); await tick();
  assert.deepEqual(h.requests.map(request => [request.options.data.action, request.options.data.stageId]), [['start', 'B'], ['complete', 'B'], ['start', 'C']]);
  h.requests[2].ok({ ...visit, currentStageId: 'C', completedStageIds: ['B', 'D'] }); await tick();
});

test('back to now replays a completed stop and then automatically follows newly detected arrivals', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  const { h, page, audio, visit, fix, deliver } = setup(t, ['A']);
  page.sequenceStatus('C', 'queued', 2);
  page._fix = fix(0); page.returnToNow();
  assert.equal(audio.snapshot().item.id, 'chapter-A');
  assert.deepEqual(plain(page.data.sequence.map(item => item.id)), ['A']);
  deliver(1); t.mock.timers.tick(2000); deliver(1); t.mock.timers.tick(3000);
  assert.equal(h.requests.length, 0);
  assert.equal(page.data.sequence.find(item => item.id === 'B').status, 'queued');
  h.audioContexts[0].emit('Ended');
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].options.data.action, 'start');
  assert.equal(h.requests[0].options.data.stageId, 'B');
  h.requests[0].ok({ ...visit, currentStageId: 'B' }); await tick();
  assert.equal(audio.snapshot().item.id, 'chapter-B');
});

test('back to now clears old future playback and accepts a fresh GPS stop after current completion', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  const { h, page, audio, visit, fix, deliver } = setup(t);
  page.sequenceStatus('C', 'queued', 2);
  page._fix = fix(0); page.returnToNow();
  h.requests[0].ok(visit); await tick();
  h.audioContexts[0].emit('Ended');
  h.requests[1].ok({ ...visit, completedStageIds: ['A'] }); await tick();
  assert.equal(audio.snapshot().item, null);
  assert.equal(h.requests.length, 2);
  deliver(1); t.mock.timers.tick(2000); deliver(1); t.mock.timers.tick(3000);
  assert.equal(h.requests[2].options.data.stageId, 'B');
  assert.equal(page.data.sequence.some(item => item.id === 'C'), false);
  h.requests[2].ok({ ...visit, currentStageId: 'B', completedStageIds: ['A'] }); await tick();
  assert.equal(audio.snapshot().item.id, 'chapter-B');
});

for (const panel of ['content', 'queue']) {
  test(`stable arrivals queue behind the open ${panel} panel and start when it closes`, async t => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
    const { h, page, audio, visit, deliver } = setup(t, ['A']);
    if (panel === 'content') page.openContent(); else page.toggleQueue();
    deliver(1); t.mock.timers.tick(2000); deliver(1);
    assert.equal(page.data.sequence.find(item => item.id === 'B').status, 'queued');
    assert.equal(audio.snapshot().item, null);
    assert.equal(h.requests.length, 0);
    if (panel === 'content') page.closeContent(); else page.closeQueue();
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].options.data.stageId, 'B');
    h.requests[0].ok({ ...visit, currentStageId: 'B' }); await tick();
    assert.equal(audio.snapshot().item.id, 'chapter-B');
  });
}

test('explicit manual replay of a completed stop retains its browsing protection', async t => {
  const { h, page, audio } = setup(t, ['A']);
  await page.enter(0);
  assert.equal(audio.snapshot().item.id, 'chapter-A');
  page.enqueueCandidates([{ id: 'B', index: 1, distance: 0, order: 2 }]);
  h.audioContexts[0].emit('Ended'); page.closeContent();
  assert.equal(h.requests.length, 0);
  assert.equal(page.data.sequence.find(item => item.id === 'B').status, 'queued');
});
