const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId } = require('./harness.cjs');
function setup() {
  const h = harness(), page = h.page('tour');
  page._rev = 0; page._user = userId; page._visible = true; page._places = []; page._detail = { coordinateSystem: 1 };
  h.my.createVideoContext = () => ({ pause() {}, play() {}, seek() {} });
  const stops = ['a', 'b'].map(id => ({ id, name: id, images: [], extraAudios: [], guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'chapter-' + id, audioUrl: '/' + id + '.mp3' }] }] }));
  page.setData({ tourStage: 'navigation', route: { id: 'route' }, visit: { visitId: 'visit', routeId: 'route', status: 1, currentStageId: 'a', completedStageIds: [] }, stops, autoplay: true });
  page.showStop(0, true);
  return { h, page, audio: h.load('services/audio') };
}
for (const gate of ['ask', 'room', 'autoplay', 'lock']) test('自动切站请求期间阻断：' + gate + '，解除后只播放一次且不重复请求', async () => {
  const { h, page, audio } = setup();
  page.enqueueCandidates([{ id: 'b', index: 1, distance: 2, order: 2 }]);
  if (gate === 'ask') page.ask();
  if (gate === 'room') { h.load('services/translation-session').snapshot = () => ({ audioPlaying: true }); audio.playQueue('translation-room', [{ id: 'room', url: '/room.mp3' }]); }
  if (gate === 'autoplay') page.changeAutoplay({ detail: { value: false } });
  if (gate === 'lock') page.changeLock({ detail: { value: true } });
  h.requests[0].ok({ ...page.data.visit, currentStageId: 'b' }); await tick();
  assert.notEqual(audio.snapshot().item && audio.snapshot().item.id, 'chapter-b');
  if (gate === 'room') { assert.equal(audio.snapshot().owner, 'translation-room'); h.load('services/translation-session').snapshot = () => ({}); audio.stop(); }
  if (gate === 'ask') page.closeChat();
  if (gate === 'autoplay') page.changeAutoplay({ detail: { value: true } });
  if (gate === 'lock') page.changeLock({ detail: { value: false } });
  page.startNextSequence(); page.startNextSequence();
  assert.equal(audio.snapshot().item.id, 'chapter-b'); assert.equal(audio.snapshot().playing, true); assert.equal(h.requests.length, 1);
  page.onUnload();
});
test('视频尚未触发原生 play 时提问，关闭后仍恢复同一视频', () => {
  const { h, page, audio } = setup();
  page.data.stops[0].video = '/video.mp4'; page.data.stops[0].guideNarrations = []; page.showStop(0, false); page.play();
  assert.equal(audio.snapshot().playing, false);
  page.ask(); audio.playQueue('chat', [{ id: 'answer', url: '/answer.mp3' }]); audio.stop('chat'); page.closeChat();
  assert.equal(audio.snapshot().item.id, 'stop-video-a'); assert.equal(page.data.videoItem.url, '/video.mp4'); page.onUnload();
});
test('切到别的节点后旧待播放意图失效', async () => {
  const { h, page, audio } = setup();
  page.enqueueCandidates([{ id: 'b', index: 1, distance: 2, order: 2 }]); page.ask();
  h.requests[0].ok({ ...page.data.visit, currentStageId: 'b' }); await tick();
  page.showStop(0, true); page.closeChat(); assert.equal(audio.snapshot().item, null); page.onUnload();
});
test('用户暂停后迟到的原生 Play 不能重新出声', () => {
  const { h, audio } = setup(); audio.playQueue('tour', [{ id: 'one', url: '/one.mp3' }]);
  audio.pause(); h.audioContexts[0].emit('Play'); assert.equal(audio.snapshot().playing, false); assert.equal(audio.snapshot().requested, false);
});
test('旧的跳过偏好不再影响默认额外音频，无导游章节也可播放额外音频', async () => {
  const h = harness(), storage = h.load('services/storage'), page = h.page('tour');
  storage.write(storage.scoped(userId, 'preferences'), { skipExtra: true });
  page.onLoad({ lang: 'zh' }); await tick(); h.requests[0].ok({ routes: [], destinations: [], places: [] }); await tick();
  assert.equal(page.data.skipExtra, false); page.onUnload();
  const f = setup(); f.page.data.stops[0].guideNarrations = []; f.page.data.stops[0].extraAudios = [{ id: 'extra', position: 'before', url: '/extra.mp3' }];
  f.page.showStop(0, true); f.page.play(); assert.equal(f.audio.snapshot().item.id, 'extra'); assert.equal(f.audio.snapshot().playing, true); f.page.onUnload();
});
test('提问期间迟到的视频 play 仍保持暂停，不抢走问答声音', () => {
  const { page, audio } = setup(); page.data.stops[0].video = '/video.mp4'; page.data.stops[0].guideNarrations = []; page.showStop(0, false); page.play();
  const video = page.data.videoItem; page.ask(); page.videoPlay({ currentTarget: { dataset: { id: video.id, generation: video.generation } } });
  assert.equal(audio.snapshot().playing, false); page.closeChat(); assert.equal(audio.snapshot().requested, true); page.onUnload();
});
for (const action of ['play', 'skip']) test('自动入站受阻后手动' + action + '消费待播意图且不重复 start', async () => {
  const { h, page, audio } = setup(); page.enqueueCandidates([{ id: 'b', index: 1, distance: 2, order: 2 }]);
  page.changeAutoplay({ detail: { value: false } }); h.requests[0].ok({ ...page.data.visit, currentStageId: 'b' }); await tick();
  assert.equal(page.data.sequence[0].status, 'queued');
  if (action === 'play') page.playQueued({ currentTarget: { dataset: { id: 'b' } } });
  else page.skipQueued({ currentTarget: { dataset: { id: 'b' } } });
  page.changeAutoplay({ detail: { value: true } });
  assert.equal(h.requests.length, 1); assert.equal(audio.snapshot().item && audio.snapshot().item.id, action === 'play' ? 'chapter-b' : null); page.onUnload();
});
