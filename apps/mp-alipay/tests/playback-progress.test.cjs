const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, userId } = require('./harness.cjs');

function setup() {
  const h = harness(), page = h.page('tour');
  page._rev = 0; page._user = userId; page._visible = true;
  const stops = ['first', 'second'].map(id => ({ id, name: id, images: [], extraAudios: [], guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'chapter-' + id, audioUrl: '/' + id + '.mp3' }] }] }));
  page.setData({ route: { id: 'route' }, visit: { visitId: 'visit', status: 1, currentStageId: 'first', completedStageIds: [] }, stops });
  page.showStop(0, false);
  const writes = [], updates = [];
  const write = h.my.setStorageSync;
  h.my.setStorageSync = input => { if (input.key.endsWith(':checkpoint')) writes.push(input.data); return write(input); };
  const setData = page.setData;
  page.setData = function(update, callback) { updates.push(update); return setData.call(this, update, callback); };
  page.play();
  return { h, page, audio: h.load('services/audio'), writes, updates };
}

test('100次进度回调合并渲染和存储，暂停仍立即保存最新进度', context => {
  let now = 100000;
  context.mock.method(Date, 'now', () => now);
  const { h, page, writes, updates } = setup();
  const active = h.audioContexts[0];
  writes.length = 0; updates.length = 0;
  for (let index = 1; index <= 100; index++) {
    now += 50; active.currentTime = index / 20; active.emit('TimeUpdate');
  }
  assert.ok(updates.length <= 18, '进度渲染受300毫秒窗口限制');
  assert.equal(writes.length, 1, '持续播放每3秒保存一次');
  page.togglePlay();
  assert.equal(writes.at(-1).time, 5);
  assert.equal(page.data.playing, false);
  assert.equal(page.data.timeLabel, '0:05');
  page.onUnload();
});

test('切站、后台、卸载以及跳转进度都会保存准确上下文', context => {
  let now = 100000;
  context.mock.method(Date, 'now', () => now);
  const { h, page, writes } = setup();
  const active = h.audioContexts[0];
  active.currentTime = 9; active.emit('TimeUpdate');
  page.onHide();
  assert.equal(writes.at(-1).time, 9);
  assert.equal(writes.at(-1).stageId, 'first');
  page._visible = true;
  page.showStop(1, false); page.play();
  const next = h.audioContexts.findLast(item => !item.destroyed && item.src === '/second.mp3');
  assert.equal(writes.at(-1).stageId, 'second');
  next.currentTime = 8; next.emit('TimeUpdate');
  next.currentTime = 2; next.emit('TimeUpdate');
  assert.equal(writes.at(-1).time, 2);
  assert.equal(page.data.timeLabel, '0:02');
  page.onUnload();
  assert.equal(writes.at(-1).stageId, 'second');
});

test('段落切换及迟到旧事件不会被节流阻挡或覆盖新段', context => {
  context.mock.method(Date, 'now', () => 100000);
  const { h, page, writes } = setup();
  const old = h.audioContexts[0], stale = old.callbacks('TimeUpdate')[0];
  page.showStop(1, false); page.play();
  const count = writes.length;
  old.currentTime = 45; stale();
  assert.equal(writes.length, count);
  assert.equal(writes.at(-1).stageId, 'second');
  assert.equal(page.data.timeLabel, '0:00');
  page.onUnload();
});

test('缓存不可写时讲解继续，下一次仍可重试保存', context => {
  let now = 100000;
  context.mock.method(Date, 'now', () => now);
  const { h, page, audio, writes } = setup();
  const write = h.my.setStorageSync;
  h.my.setStorageSync = () => { throw Error('quota'); };
  now += 4000; h.audioContexts[0].currentTime = 4;
  assert.doesNotThrow(() => h.audioContexts[0].emit('TimeUpdate'));
  assert.equal(audio.snapshot().playing, true);
  h.my.setStorageSync = write;
  h.audioContexts[0].emit('TimeUpdate');
  assert.equal(writes.at(-1).time, 4);
  page.onUnload();
});
