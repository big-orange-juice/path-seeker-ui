const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, plain, userId } = require('./harness.cjs');
const event = (type, payload, eventId) => 'data: ' + JSON.stringify({ type, payload, ...(eventId ? { eventId } : {}) }) + '\n\n';
function setupTour(h) {
  const page = h.page('tour');
  page._rev = 0; page._user = userId; page._visible = true; page._places = [];
  const stops = ['9223372036854775804', '9223372036854775803'].map((id, index) => ({ id, name: '站' + index, order: index, longitude: 116.38, latitude: 39.93, images: [], guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'c-' + id, title: '故事', text: '正文', audioUrl: 'chapter.mp3' }] }] }));
  page.setData({ route: { id: '9223372036854775805', locale: 'zh' }, stops, autoplay: false, loading: false, chatOpen: false, visit: { visitId: 'visit', routeId: '9223372036854775805', status: 1, currentStageId: stops[0].id, completedStageIds: [] } });
  page._detail = { coordinateSystem: 1 }; page.showStop(0, false);
  return page;
}
function setupChat(h) {
  const page = h.page('chat'); page.onLoad(); page._visible = true; page._user = userId; page.setData({ sessionId: 'session', loading: false });
  return page;
}
test('map and list selections enter a stop; previous and next only browse and play', async () => {
  for (const action of ['marker', 'browse']) {
    const h = harness(), page = setupTour(h), next = page.data.stops[1].id;
    page[action](action === 'marker' ? { detail: { markerId: 2 } } : { currentTarget: { dataset: { index: 1 } } });
    assert.equal(h.requests[0].options.data.stageId, next); assert.equal(h.requests[0].options.data.action, 'start');
    h.requests[0].ok({ ...plain(page.data.visit), currentStageId: next }); await tick();
    assert.equal(page.data.browsing, false); assert.equal(h.audioContexts.length, 1);
    page.previous(); assert.equal(page.data.browsing, true); assert.equal(h.audioContexts.length, 2); assert.equal(h.requests.length, 1);
    h.audioContexts[1].emit('Ended'); await tick(); assert.equal(h.requests.length, 1);
  }
});
test('foreground restores playing audio once and never resumes a user pause or another stop', () => {
  const h = harness(), page = setupTour(h); page.play(); h.audioContexts[0].currentTime = 17;
  page.onHide(); assert.equal(h.load('services/audio').snapshot().playing, false); page.onShow();
  assert.equal(h.load('services/audio').snapshot().playing, true); assert.equal(h.audioContexts.length, 1);
  page.togglePlay(); page.onHide(); page.onShow(); assert.equal(h.load('services/audio').snapshot().playing, false);
  page.togglePlay(); page.onHide(); page.showStop(1, true); page.onShow(); assert.equal(h.load('services/audio').snapshot().playing, false);
});
test('overlay answer completion and close restore the same position without restarting narration', () => {
  const h = harness(), page = setupTour(h); page.play(); h.audioContexts[0].currentTime = 14;
  page.ask(); assert.equal(page.data.chatOpen, true); assert.equal(h.load('services/audio').snapshot().playing, false);
  page.chatSettled(); assert.equal(h.audioContexts.length, 1); assert.equal(h.audioContexts[0].currentTime, 14);
  page.closeChat(); assert.equal(h.audioContexts.length, 1); assert.equal(h.load('services/audio').snapshot().playing, true);
});
test('map follows GCJ coordinates, ignores weak fixes and retains range outlines when hiding route', () => {
  const h = harness(), page = setupTour(h); let fix;
  h.load('services/location').watch = callback => { fix = callback; return () => {}; };
  page.setData({ following: true, locationEnabled: true, map: { longitude: 1, latitude: 2, markers: [], includePoints: [], polyline: ['boundary', 'route'], boundaryLines: ['boundary'] } });
  page._fullPolyline = ['boundary', 'route']; page.watchLocation();
  fix({ longitude: 116.3, latitude: 39.9, gcj: { longitude: 116.31, latitude: 39.91 }, accuracy: 10 });
  assert.equal(page.data.map.longitude, 116.31); assert.equal(page.data.map.latitude, 39.91);
  fix({ gcj: { longitude: 0, latitude: 0 }, accuracy: 100 }); assert.equal(page.data.map.longitude, 116.31);
  page.toggleRoute(); assert.deepEqual(plain(page.data.map.polyline), ['boundary']); page.toggleRoute(); assert.deepEqual(plain(page.data.map.polyline), ['boundary', 'route']);
  page.onHide();
});
test('tour voice release hands off immediately and sends once after recognition', async () => {
  const h = harness(), tour = setupTour(h); let navigations = 0; h.my.switchTab = () => navigations++;
  tour.play(); tour.startRecording({ touches: [{ clientY: 100 }] }); h.recorder.emit('Start'); tour.stopRecording();
  assert.equal(navigations, 1); assert.ok(h.app.globalData.voiceInput); assert.equal(h.load('services/audio').snapshot().playing, false);
  tour.onHide();
  const chat = h.page('chat'); chat.onLoad(); chat.onShow(); await tick();
  h.requests[0].ok([]); await tick();
  const stopped = h.recorder.emit('Stop', { tempFilePath: '/voice.audio' }); await tick();
  h.requests[1].ok({ text: '这是哪里？' }); await Promise.all(stopped); await tick();
  assert.equal(h.requests[2].options.data.title, '这是哪里？');
  h.requests[2].ok('session'); await tick();
  assert.equal(h.requests[3].options.data.message, '这是哪里？');
  h.requests[3].text(event('text.delta', { content: '沿途景点' }) + event('done', {})); await tick();
  chat.onHide();
});
test('tour voice swipe cancellation and hiding never upload or navigate on late callbacks', async () => {
  for (const cancel of ['cancelTouch', 'onHide']) {
    const h = harness(), page = setupTour(h); let navigations = 0; h.my.switchTab = () => navigations++;
    page.startRecording({ touches: [{ clientY: 100 }] }); page[cancel](); h.recorder.emit('Start');
    await Promise.all(h.recorder.emit('Stop', { tempFilePath: '/cancel.audio' }));
    assert.equal(h.requests.length, 0); assert.equal(navigations, 0); assert.ok(h.removed.includes('/cancel.audio'));
  }
});
test('chat recording stops an active answer and automatically sends recognized text once', async () => {
  const h = harness(), page = setupChat(h); page.setData({ text: '旧问题' }); const old = page.send(); await tick();
  await page.startRecording({ touches: [{ clientY: 100 }] }); assert.equal(h.requests[0].aborted, true);
  h.recorder.emit('Start'); page.stopRecording(); const stopped = h.recorder.emit('Stop', { tempFilePath: '/new.audio' }); await tick();
  h.requests[1].ok({ text: '新问题' }); await Promise.all(stopped); await tick();
  assert.equal(h.requests[2].options.data.message, '新问题'); assert.equal(page.data.recording, false);
  h.requests[2].text(event('done', {})); await tick(); await old; page.onHide();
});
test('streamed text and sentence audio play before completion and full response does not duplicate them', async () => {
  const h = harness(); h.my.chunked = true; const page = setupChat(h);
  page.setData({ text: '问题' }); const pending = page.send(); await tick();
  const first = event('text.delta', { content: '**第一句**。' }, '1') + event('audio.delta', { audio: '00ff', isFinal: true }, '2');
  const last = event('text.delta', { content: '第二句。' }, '3') + event('audio.delta', { audio: 'aabb', isFinal: true }, '4') + event('done', { assistantMessageId: 'assistant' }, '5');
  const bytes = Buffer.from(first);
  for (let offset = 0; offset < bytes.length; offset++) h.requests[0].chunk(Uint8Array.of(bytes[offset]).buffer);
  await tick();
  assert.equal(page.data.messages[1].content, '**第一句**。'); assert.equal(page.data.busy, true); assert.equal(h.audioContexts.length, 1); assert.equal(page.data.caption, '**第一句**。');
  h.audioContexts[0].emit('Ended'); assert.equal(h.load('services/audio').snapshot().playing, false);
  h.requests[0].chunk(last); await tick(); assert.equal(h.audioContexts.length, 2);
  h.requests[0].text(first + last); await pending;
  assert.equal(page.data.messages[1].content, '**第一句**。第二句。'); assert.equal(h.writes.length, 2); assert.equal(page.data.messages[1].audioPaths.length, 2);
  h.audioContexts[1].currentTime = 30; h.audioContexts[1].emit('TimeUpdate'); assert.equal(page.data.captionProgress, 50);
  page.onHide();
});
test('buffered fallback and stopped streams do not replay late audio', async () => {
  const h = harness(), page = setupChat(h); page.setData({ text: '问题' }); const pending = page.send(); await tick();
  h.requests[0].text(event('text.delta', { content: '答复。' }) + event('audio.delta', { audio: '00ff', isFinal: true }) + event('done', {})); await pending;
  assert.equal(h.audioContexts.length, 1); assert.equal(page.data.messages[1].content, '答复。'); page.onHide();
  const other = harness(); other.my.chunked = true; const cancelled = setupChat(other); cancelled.setData({ text: '停止' }); const cancelledRun = cancelled.send(); await tick();
  cancelled.cancel(); other.requests[0].chunk(event('audio.delta', { audio: '00ff', isFinal: true })); other.requests[0].text(event('done', {})); await cancelledRun; await tick();
  assert.equal(other.audioContexts.length, 0); assert.equal(other.writes.length, 0);
});
test('Markdown nodes render formatting while treating HTML and unsafe links as text', () => {
  const markdown = harness().load('core/markdown').markdownNodes;
  const nodes = plain(markdown('# 标题\n**加粗**和`代码`\n- 一项\n\n<script>alert(1)</script>\n\n[坏链接](javascript:alert)\n\n[资料](https://example.com)'));
  assert.equal(nodes[0].name, 'h1'); assert.equal(nodes[1].children[0].name, 'strong');
  assert.match(JSON.stringify(nodes), /<script>/); assert.doesNotMatch(JSON.stringify(nodes), /"href":"javascript/);
  assert.equal(nodes.at(-1).children[0].attrs.href, 'https://example.com');
  const table = plain(markdown('| 项目 | 状态 |\n| --- | --- |\n| 问答 | 完成 |'));
  assert.equal(table[0].name, 'table'); assert.match(JSON.stringify(table), /问答/);
});
test('embedded component expands without cancelling the answer and unmount releases resources', async () => {
  const h = harness(), component = h.component('chat'); component.didMount(); await tick(); h.requests[0].ok([]); await tick();
  assert.equal(component.data.embedded, true);
  component.setData({ sessionId: 'session', text: '问题' }); const pending = component.send(); await tick();
  component.toggleExpanded(); assert.equal(component.data.expanded, true); assert.equal(h.requests[1].aborted, false);
  component.toggleExpanded(); assert.equal(component.data.expanded, false); assert.equal(h.requests[1].aborted, false);
  component.didUnmount(); await pending; assert.equal(h.requests[1].aborted, true); assert.equal(component._visible, false);
});
test('failed answer retries the original question and native tap events never become message text', async () => {
  const h = harness(), page = setupChat(h); page.setData({ text: '原始问题' }); const pending = page.send({ type: 'tap' }); await tick();
  assert.equal(h.requests[0].options.data.message, '原始问题'); h.requests[0].reject({ errorMessage: '断网' }); await pending;
  assert.equal(page.data.messages[1].retryText, '原始问题'); page.retry({ currentTarget: { dataset: { index: 1 } } }); await tick();
  assert.equal(h.requests[1].options.data.message, '原始问题'); h.requests[1].text(event('text.delta', { content: '成功' }) + event('done', {})); await tick(); page.onHide();
});
test('malformed or truncated streamed data never leaves answer audio playing', async () => {
  const h = harness(); h.my.chunked = true; const page = setupChat(h); page.setData({ text: '问题' }); const pending = page.send(); await tick();
  h.requests[0].chunk(event('audio.delta', { audio: '00ff', isFinal: true })); await tick(); assert.equal(h.audioContexts.length, 1);
  h.requests[0].chunk('data: {broken}\n\n'); await pending; assert.equal(h.requests[0].aborted, true); assert.equal(h.load('services/audio').snapshot().playing, false); assert.ok(page.data.error); page.onHide();
});
test('all history types preserve string route IDs and reject missing route identities', () => {
  const h = harness(), page = h.page('records'); const id = '9223372036854775805'; let navigations = 0; h.my.switchTab = () => navigations++;
  for (const tab of [0, 1, 2, 3]) { page.setData({ tab, records: [{ routeId: id, locale: 'en' }] }); page.resume({ currentTarget: { dataset: { id } } }); assert.equal(h.app.globalData.selectedRoute, id); }
  assert.equal(navigations, 4); page.resume({ currentTarget: { dataset: { id: 123 } } }); assert.equal(navigations, 4); assert.ok(page.data.error);
});

test('a cancelled or completed old chat cannot stop a newer chat audio stream', async () => {
  const h = harness(); h.my.chunked = true;
  const { sendChat } = h.load('services/chat-run'), audio = h.load('services/audio');
  const hooks = { active: () => true, update() {}, files() {}, audioError() {} };
  const old = sendChat({ clientMessageId: 'old', enableAudio: true }, hooks);
  const cancelled = assert.rejects(old, /取消/); old.abort();
  const next = sendChat({ clientMessageId: 'next', enableAudio: true }, hooks);
  h.requests[1].chunk(event('text.delta', { content: '新回答' }) + event('audio.delta', { audio: '00ff', isFinal: true }));
  await cancelled; await tick();
  assert.equal(audio.snapshot().playing, true); assert.match(audio.snapshot().item.id, /^next/);
  h.requests[1].text(event('text.delta', { content: '新回答' }) + event('audio.delta', { audio: '00ff', isFinal: true }) + event('done', {})); await next;
  const newest = sendChat({ clientMessageId: 'newest', enableAudio: true }, hooks);
  h.requests[2].chunk(event('audio.delta', { audio: 'aabb', isFinal: true })); await tick();
  next.abort(); next.mute();
  assert.equal(audio.snapshot().playing, true); assert.match(audio.snapshot().item.id, /^newest/);
  h.requests[2].text(event('audio.delta', { audio: 'aabb', isFinal: true }) + event('done', {})); await newest;
});

test('an incomplete final UTF-8 byte rejects the response and stops streamed audio', async () => {
  const h = harness(); h.my.chunked = true; const page = setupChat(h); page.setData({ text: '问题' }); const pending = page.send(); await tick();
  const complete = event('audio.delta', { audio: '00ff', isFinal: true }) + event('done', {});
  h.requests[0].chunk(complete); await tick(); assert.equal(h.load('services/audio').snapshot().playing, true);
  h.requests[0].chunk(Uint8Array.of(0xe4).buffer); h.requests[0].text(complete); await pending;
  assert.match(page.data.error, /不完整/); assert.equal(h.load('services/audio').snapshot().playing, false);
  page.onHide();
});

test('standalone extra audio resumes after chat without completing the stop or replacing main checkpoint', () => {
  const h = harness(), page = setupTour(h), audio = h.load('services/audio'), storage = h.load('services/storage');
  page.play(); h.audioContexts.at(-1).currentTime = 11;
  page.data.stop.extraAudios = [{ id: 'extra', url: 'extra.mp3', title: '补充', position: 'before' }];
  page.playExtra({ currentTarget: { dataset: { id: 'extra' } } }); h.audioContexts.at(-1).currentTime = 7;
  page.ask(); audio.playQueue('chat', [{ id: 'answer', url: 'answer.mp3' }]); audio.stop('chat'); page.closeChat();
  assert.equal(audio.snapshot().item.id, 'extra'); h.audioContexts.at(-1).emit('CanPlay'); assert.equal(audio.snapshot().time, 7);
  h.audioContexts.at(-1).emit('Ended'); assert.equal(h.requests.length, 0);
  const checkpoint = storage.read(storage.scoped(userId, 'checkpoint')); assert.notEqual(checkpoint.itemId, 'extra'); assert.equal(checkpoint.time, 11);
});

test('failed history initialization keeps a recognized question as a draft instead of sending it', async () => {
  const h = harness(), page = h.page('chat'); page.onLoad(); page.setData({ sessionId: 'session' });
  h.app.globalData.voiceInput = { userId, promise: Promise.resolve('语音问题'), cancel() {} };
  page.onShow(); await tick(); h.requests[0].ok([{ id: 'session' }]); await tick();
  h.requests[1].reject({ errorMessage: '历史加载失败' }); await tick();
  assert.equal(h.requests.length, 2); assert.equal(page.data.text, '语音问题'); assert.equal(page.data.transcribing, false); assert.match(page.data.error, /历史加载失败/);
  page.onHide();
});
