const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId, plain } = require('./harness.cjs');

const ids = { roomId: '9223372036854775805', routeId: '9223372036854775804', visitId: '9223372036854775803', stageId: '9223372036854775802' };
const video = { id: 'stop-video-' + ids.stageId, url: 'https://media.test/video.mp4', title: '插播视频', kind: 'interlude-video' };
async function setup(context, following = false) {
  const fixture = harness(), manager = fixture.my.createInnerAudioContext();
  fixture.my.getBackgroundAudioManager = () => manager;
  fixture.my.createVideoContext = () => ({ pause() {}, play() {}, seek() {} });
  fixture.load('config').diagnostics = false;
  let sources = 0;
  Object.defineProperty(manager, 'src', { set(value) { this.url = value; this.currentTime = 0; sources++; this.play(); } });
  const translation = fixture.load('services/translation-session');
  translation.snapshot = () => ({ room: { roomId: ids.roomId, status: 'paused', isHost: false }, following, disconnected: false });
  const page = fixture.page('tour'), service = fixture.load('services/tour-audio-session'), audio = fixture.load('services/audio');
  page._rev = 0; page._user = userId; page._visible = true; page._places = [];
  const stop = { id: ids.stageId, name: '测试节点', images: [], extraAudios: [], video: video.url, videoAttachmentId: '9223372036854775000', videoTriggerPercent: 70,
    guideNarrations: [{ guideId: '9223372036854775801', locale: 'zh', chapters: [{ id: 'chapter', durationSeconds: 100, audioUrl: 'https://media.test/chapter.mp3' }] }] };
  const visit = { visitId: ids.visitId, routeId: ids.routeId, status: 1, completedStageIds: [], visitedStageIds: [] };
  page.setData({ route: { id: ids.routeId }, stops: [stop], visit, tourStage: 'navigation', autoplay: true, locationEnabled: true });
  page.showStop(0, true);
  let state = { sessionId: 'session', streamId: 'stream-1', revision: 1, status: 'streaming', visitId: ids.visitId, routeId: ids.routeId,
    stageId: ids.stageId, itemId: 'chapter', paused: false, held: false, queue: [{ stageId: ids.stageId, status: 'playing' }], visit,
    mediaTimeSeconds: 95, itemTimeSeconds: 95, itemDurationSeconds: 100,
    timeline: [{ start: 0, end: 95, kind: 'route', stageId: ids.stageId, itemId: 'chapter', itemStart: 0, duration: 100, contentKey: 'content-v1' }] };
  context.after(() => { service.stop(); if (page._serverSubscription) page._serverSubscription(); });
  page._serverSubscription = service.subscribe(value => page.applyServerAudio(value));
  page.startNextSequence();
  fixture.requests[0].ok({ sessionId: 'session', mediaUrl: '/TourAudioSessions/session/media.mp3?ticket=test', state });
  await tick();
  function reply(request, values = {}) { state = { ...state, ...values, revision: state.revision + 1 }; request.ok(state); }
  function time(seconds) { manager.currentTime = seconds; manager.emit('TimeUpdate'); }
  function event() { return { currentTarget: { dataset: { id: video.id, generation: page.data.videoItem.generation } } }; }
  return { fixture, page, service, audio, manager, reply, time, event, sources: () => sources };
}

test('跟随模式以实际收听70%触发一次，不使用服务端95%的生成进度', async context => {
  const v = await setup(context, true);
  assert.equal(v.page.driverManaged(), true);
  v.time(69); await tick();
  assert.equal(v.fixture.requests.length, 1);
  v.time(70); v.time(70.1); v.time(71); await tick();
  const hold = v.fixture.requests[1];
  assert.equal(hold.options.data.command, 'video-hold');
  assert.equal(hold.options.data.stageId, ids.stageId);
  assert.equal(hold.options.data.mediaTimeSeconds, 70);
  assert.equal(v.fixture.requests.length, 2);
  v.reply(hold, { held: true }); await tick();
  assert.equal(v.page.data.videoItem.url, video.url);
  assert.equal(v.audio.snapshot().owner, 'tour-extra');
  assert.equal(v.manager.stopped, true);
});

for (const finish of ['ended', 'skip', 'error']) {
  test(`跟随模式视频${finish}仅发送一次专用续播，不发送断网重连或完成节点`, async context => {
    const v = await setup(context, true);
    v.time(70); await tick();
    v.reply(v.fixture.requests[1], { held: true }); await tick();
    const event = v.event(); v.page.videoPlay(event);
    if (finish === 'ended') v.page.videoEnded(event);
    else if (finish === 'skip') v.page.skipVideo();
    else v.page.videoError(event);
    v.page.videoEnded(event); await tick();
    assert.equal(v.fixture.requests[2].options.data.command, 'video-resume');
    v.reply(v.fixture.requests[2], { held: false, status: 'disconnected' }); await tick();
    assert.equal(v.sources(), 2);
    assert.equal(v.audio.snapshot().owner, 'tour');
    assert.equal(v.page.data.videoItem, null);
    assert.equal(v.fixture.requests.filter(r => r.options.data?.command === 'video-resume').length, 1);
    assert.ok(!v.fixture.requests.some(r => ['reconnect', 'complete'].includes(r.options.data?.command)));
    v.page.maybeStartVideoInterlude({ kind: 'route', stageId: ids.stageId, itemId: 'chapter', itemTimeSeconds: 75, itemDurationSeconds: 100 });
    await tick(); assert.equal(v.fixture.requests.length, 3);
  });
}

test('整站多章节累计70%，忽略前后音频，缺少总时长时不猜测', () => {
  const h = harness(), module = h.load('core/tour-video-interlude');
  const stop = { video: '/v.mp4', videoTriggerPercent: 70 };
  const narration = { chapters: [{ id: 'a', order: 1, durationSeconds: 60 }, { id: 'b', order: 2, durationSeconds: 40 }] };
  assert.equal(module.progress(stop, narration, 'b', 10, 40), 70);
  assert.equal(module.progress(stop, narration, 'a', 42, 60), 42);
  assert.equal(module.progress(stop, narration, 'before', 70, 100), null);
  assert.equal(module.progress(stop, { chapters: [{ id: 'a' }, { id: 'b' }] }, 'a', 70, 100), null);
  assert.equal(module.progress({ ...stop, videoTriggerPercent: null }, narration, 'b', 10, 40), null);
});

test('配置插播的视频不再在队尾重复播放，空值保留旧顺序', () => {
  const h = harness(), tour = h.load('core/tour');
  const stop = { id: 's', name: 's', video: '/v.mp4', videoTriggerPercent: 70 };
  const narration = { chapters: [{ id: 'a', audioUrl: '/a.mp3' }] };
  assert.deepEqual(plain(tour.queueFor(stop, narration)).map(i => i.id), ['a']);
  assert.deepEqual(plain(tour.queueFor({ ...stop, videoTriggerPercent: null }, narration)).map(i => i.id), ['a', 'stop-video-s']);
});

test('插播开始即按行程与附件去重，页面重建保留去重，新行程重新触发', async context => {
  const v = await setup(context, true);
  v.time(70); await tick();
  const module = v.fixture.load('core/tour-video-interlude');
  delete v.page._videoInterludes;
  assert.equal(module.claim(v.page, v.page.data.stop), false);
  v.page.data.visit.visitId = 'new-visit';
  assert.equal(module.claim(v.page, v.page.data.stop), true);
});

test('页面隐藏取消视频，普通释放继续保留真实重连预算，旧ended不能专用续播', async context => {
  const v = await setup(context, true);
  v.time(70); await tick(); v.reply(v.fixture.requests[1], { held: true }); await tick();
  const event = v.event();
  v.page.onHide(); v.page.videoEnded(event); await tick();
  assert.equal(v.page.data.videoItem, null);
  assert.equal(v.page._serverExtraRequest, null);
  assert.ok(v.fixture.requests.some(r => r.options.data?.command === 'release'));
  assert.ok(!v.fixture.requests.some(r => r.options.data?.command === 'video-resume'));
});

test('问答抢占取消视频，迟到的结束事件不能恢复讲解', async context => {
  const v = await setup(context, true);
  v.time(70); await tick(); v.reply(v.fixture.requests[1], { held: true }); await tick();
  const event = v.event(); v.page.suspendForAsk(); v.page.videoEnded(event); await tick();
  assert.equal(v.page.data.videoItem, null);
  assert.equal(v.fixture.requests.at(-1).options.data.command, 'hold');
  assert.ok(!v.fixture.requests.some(r => r.options.data?.command === 'video-resume'));
});

test('hold回执晚于页面隐藏时不展示视频，并释放服务端hold', async context => {
  const v = await setup(context, true);
  v.time(70); await tick(); v.page.onHide();
  v.reply(v.fixture.requests[1], { held: true }); await tick();
  for (let i = 2; i < v.fixture.requests.length; i++) {
    const r = v.fixture.requests[i];
    if (r.options.data?.command === 'release') break;
    v.reply(r); await tick();
  }
  assert.ok(!v.page.data.videoItem);
  assert.ok(v.fixture.requests.some(r => r.options.data?.command === 'release'));
});

test('息屏前未到70%时后台继续讲解，不创建视频，回前台同站可补触发', async context => {
  const v = await setup(context, true);
  v.time(69); v.page._visible = false;
  v.time(70); v.time(80); await tick();
  assert.ok(!v.page.data.videoItem);
  assert.equal(v.fixture.requests.length, 1);
  v.page._visible = true; v.time(81); await tick();
  assert.equal(v.fixture.requests[1].options.data.command, 'video-hold');
});

test('系统音频抢占中取消视频并保持暂停，迟到的ended不能自动恢复', async context => {
  const v = await setup(context, true);
  let begin;
  v.fixture.my.onAudioInterruptionBegin = callback => { begin = callback; };
  v.fixture.my.onAudioInterruptionEnd = () => {};
  v.fixture.load('services/audio-interruption').init();
  v.time(70); await tick(); v.reply(v.fixture.requests[1], { held: true }); await tick();
  const event = v.event();
  begin(); await tick();
  assert.equal(v.fixture.requests.at(-1).options.data.command, 'pause');
  v.reply(v.fixture.requests.at(-1), { paused: true }); await tick();
  v.page.videoEnded(event); await tick();
  assert.equal(v.page.data.videoItem, null);
  assert.ok(!v.fixture.requests.some(r => r.options.data?.command === 'video-resume'));
});

test('未入房本地播放器70%插播结束，从同一章原位置恢复', () => {
  const h = harness(), page = h.page('tour'), audio = h.load('services/audio');
  h.my.createVideoContext = () => ({ pause() {}, play() {}, seek() {} });
  page._rev = 0; page._user = userId; page._visible = true; page._places = [];
  const stop = { id: ids.stageId, name: '节点', images: [], video: video.url, videoTriggerPercent: 70,
    guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'chapter', audioUrl: '/a.mp3', durationSeconds: 100 }] }] };
  page.setData({ route: { id: ids.routeId }, stops: [stop], visit: { visitId: ids.visitId, status: 1 }, tourStage: 'navigation' });
  page.showStop(0, true); page.play();
  const manager = h.audioContexts[0]; manager.duration = 100; manager.currentTime = 70; manager.emit('TimeUpdate');
  assert.equal(page.data.videoItem.url, video.url);
  const event = { currentTarget: { dataset: { id: page.data.videoItem.id, generation: page.data.videoItem.generation } } };
  page.videoPlay(event); page.videoEnded(event);
  assert.equal(audio.snapshot().item.id, 'chapter');
  assert.equal(audio.snapshot().time, 70);
  audio.stop();
});

