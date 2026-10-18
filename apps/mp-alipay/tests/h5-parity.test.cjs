const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, plain, userId } = require('./harness.cjs');
const event = (type, payload, eventId) => 'data: ' + JSON.stringify({ type, payload, ...(eventId ? { eventId } : {}) }) + '\n\n';
function setupTour(h) {
  const page = h.page('tour');
  page._rev = 0; page._user = userId; page._visible = true; page._places = [];
  const stops = ['9223372036854775804', '9223372036854775803'].map((id, index) => ({ id, name: '站' + index, order: index, longitude: 116.38, latitude: 39.93, images: [], guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'c-' + id, title: '故事', text: '正文', audioUrl: 'chapter.mp3' }] }] }));
  page.setData({ tourStage: 'navigation', route: { id: '9223372036854775805', locale: 'zh' }, stops, autoplay: false, loading: false, chatOpen: false, visit: { visitId: 'visit', routeId: '9223372036854775805', status: 1, currentStageId: stops[0].id, completedStageIds: [] } });
  page._detail = { coordinateSystem: 1 }; page.showStop(0, false);
  return page;
}
function setupChat(h) {
  const page = h.page('chat'); page.onLoad(); page._visible = true; page._user = userId; page.setData({ sessionId: 'session', loading: false });
  return page;
}

test('navigation requests buildings and focuses the selected map marker instead of fitting the route', () => {
  const h = harness(), page = setupTour(h), updates = [];
  h.my.createMapContext = () => ({
    updateComponents: value => updates.push(value),
    getMapProperties: options => options.success({ is3d: 1 }),
    includePoints: () => {}
  });
  page.setData({ map: { longitude: 116, latitude: 39, markers: [{ id: 1, longitude: 116.4, latitude: 39.95 }, { id: 2, longitude: 116.5, latitude: 39.96 }], includePoints: [{ longitude: 116, latitude: 39 }] } });
  page.focusNavigationMap();
  assert.equal(updates[0].setting.enableBuilding, 1);
  assert.equal(updates[0].setting.tiltGesturesEnabled, 1);
  assert.equal(updates[0].scale, 18); assert.equal(updates[0].longitude, 116.4);
  assert.equal(page.data.mapScale, 18); assert.equal(page.data.mapSkew, 50);
  assert.equal(page.data.map.longitude, 116.4); assert.deepEqual(plain(page.data.map.includePoints), []);
  page.overview(); assert.equal(page.data.mapSkew, 0); assert.equal(page.data.map.includePoints.length, 2);
  page.setData({ stopIndex: 1 }); page.focusNavigationMap(); assert.equal(page.data.map.longitude, 116.5);
  page.ask(); page.closeChat(); assert.equal(page.data.mapScale, 18); assert.equal(page.data.mapSkew, 50);
});

test('camera update waits for the view commit and is reapplied when the map initializes', () => {
  const h = harness(), page = setupTour(h), updates = [], commits = [];
  const setData = page.setData.bind(page);
  page.setData = (value, callback) => { setData(value); if (callback) commits.push(callback); };
  h.my.createMapContext = () => ({ updateComponents: value => updates.push(value) });
  page.focusNavigationMap(); assert.equal(updates.length, 0);
  commits.shift()(); assert.equal(updates.length, 1); assert.equal(updates[0].scale, 18);
  page.mapReady(); assert.equal(updates.length, 2); assert.equal(updates[1].scale, 18);
  page._visible = false; page.mapReady(); assert.equal(updates.length, 2);
});

test('3D engine flag does not mask an unapplied pitch and late readbacks are ignored', () => {
  const h = harness(), page = setupTour(h); let readback;
  h.my.createMapContext = () => ({
    getMapProperties: options => options.success({ is3d: true }),
    getSkew: options => { readback = options.success; }
  });
  page.focusNavigationMap(); readback({ skew: 0 });
  assert.equal(page._mapProperties.is3d, true);
  assert.deepEqual(plain(page._mapCamera), { requestedSkew: 50, actualSkew: 0 });
  page.inspectMapCamera(); readback({ skew: 50 }); assert.equal(page._mapCamera.actualSkew, 50);
  page.inspectMapCamera(); page._visible = false; readback({ skew: 0 }); assert.equal(page._mapCamera.actualSkew, 50);
  page._visible = true; page.inspectMapCamera(); page.setData({ mapSkew: 0 }); readback({ skew: 0 }); assert.equal(page._mapCamera.actualSkew, 50);
});

test('native 2D engine is reported without blocking navigation and missing map APIs remain usable', () => {
  const h = harness(), page = setupTour(h), notices = [];
  h.my.createMapContext = () => ({ getMapProperties: options => options.success({ is3d: 0 }) });
  h.my.showToast = options => notices.push(options.content);
  page.focusNavigationMap(); assert.equal(notices.length, 1); assert.equal(page.data.mapScale, 18);
  delete h.my.createMapContext; page.focusNavigationMap();
  page.setData({ tourStage: 'overview', mapScale: 15 }); page.focusNavigationMap(); assert.equal(page.data.mapScale, 15);
});
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
test('background mode keeps narration across hide, and legacy mode pauses then restores', () => {
  const h = harness(), page = setupTour(h), config = h.load('config'), audio = h.load('services/audio');
  assert.equal(config.background, true);
  page.play(); h.audioContexts[0].currentTime = 17;
  page.onHide(); assert.equal(audio.snapshot().playing, true, 'hide keeps playing'); page.onShow();
  assert.equal(audio.snapshot().playing, true, 'show keeps playing'); assert.equal(h.audioContexts.length, 1, 'no new context');
  page.togglePlay(); assert.equal(audio.snapshot().playing, false, 'toggle pauses');
  page.onHide(); page.onShow(); assert.equal(audio.snapshot().playing, false, 'paused stays paused');
  config.background = false;
  const legacy = harness(), page2 = setupTour(legacy), audio2 = legacy.load('services/audio');
  legacy.load('config').background = false;
  page2.play(); legacy.audioContexts[0].currentTime = 17;
  page2.onHide(); assert.equal(audio2.snapshot().playing, false, 'legacy hide pauses'); page2.onShow();
  assert.equal(audio2.snapshot().playing, true, 'legacy show resumes'); assert.equal(legacy.audioContexts.length, 1, 'legacy no new context');
  page2.togglePlay(); page2.onHide(); page2.onShow(); assert.equal(audio2.snapshot().playing, false, 'legacy pause stays');
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
  const h = harness(), tour = setupTour(h); let navigations = 0; h.my.navigateTo = () => navigations++;
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
    const h = harness(), page = setupTour(h); let navigations = 0; h.my.navigateTo = () => navigations++;
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
test('chat recording resets the native recorder after transcription failure', async () => {
  const h = harness(), page = setupChat(h);
  await page.startRecording({ touches: [{ clientY: 100 }] });
  h.recorder.emit('Start'); page.stopRecording();
  const stopped = h.recorder.emit('Stop', { tempFilePath: '/failed.audio' }); await tick();
  h.requests[0].reject({ errorMessage: '语音服务暂不可用' }); await Promise.all(stopped); await tick();
  assert.equal(page.data.recording, false);
  assert.equal(page.data.transcribing, false);
  assert.equal(page._recorder, null);
  await page.startRecording({ touches: [{ clientY: 100 }] });
  assert.equal(h.recorder.starts.length, 2);
  page.cancelTouch();
  h.recorder.emit('Stop', { tempFilePath: '/cancelled.audio' });
  page.onHide();
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
test('chunked mode keeps consuming chunks when success reports headers with no body', async () => {
  const h = harness(); h.my.chunked = true; const page = setupChat(h);
  page.setData({ text: '问题' }); const pending = page.send(); await tick();
  // 支付宝真机：分块请求的 success 会先带着空 body 到达，真正的 SSE 分块在其后。
  h.requests[0].head(); await tick();
  assert.equal(page.data.busy, true); assert.equal(page.data.messages[1].pending, true); assert.equal(h.requests[0].aborted, false);
  h.requests[0].chunk(event('text.delta', { content: '分块答复。' }, '1')); await tick();
  assert.equal(page.data.messages[1].content, '分块答复。'); assert.equal(page.data.busy, true);
  h.requests[0].chunk(event('done', { assistantMessageId: 'assistant' }, '2')); await tick();
  await pending;
  assert.equal(page.data.messages[1].pending, false); assert.equal(page.data.busy, false);
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
  component.setData = () => assert.fail('unmounted component must not update its view');
  component.didUnmount(); await pending; assert.equal(h.requests[1].aborted, true); assert.equal(component._visible, false);
});

test('closing chat during initialization ignores late history and a fresh component can open', async () => {
  const h = harness(), component = h.component('chat');
  component.didMount(); await tick();
  component.setData = () => assert.fail('unmounted component must not update its view');
  component.didUnmount(); h.requests[0].ok([]); await tick();
  const reopened = h.component('chat'); reopened.didMount(); await tick();
  h.requests[1].ok([]); await tick();
  assert.equal(reopened._visible, true); assert.equal(reopened.data.loading, false);
  reopened.didUnmount();
});

test('hidden chat resets transient state on show without retaining deleted audio paths', async () => {
  const h = harness(), page = setupChat(h);
  page.setData({ busy: true, recording: true, transcribing: true, messages: [{ pending: true, audioPaths: ['deleted.mp3'] }] });
  page.onHide(); page.onShow(); await tick(); h.requests[0].ok([]); await tick();
  assert.equal(page.data.busy, false); assert.equal(page.data.recording, false); assert.equal(page.data.transcribing, false);
  assert.equal(page.data.messages[0].pending, false); assert.deepEqual(plain(page.data.messages[0].audioPaths), []);
  page.onHide();
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
  const h = harness(), page = h.page('records'); const id = '9223372036854775805'; let navigations = 0; h.my.reLaunch = () => navigations++;
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
