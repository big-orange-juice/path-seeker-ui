const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, userId, plain, tick } = require('./harness.cjs');

function setup() {
  const h = harness(), page = h.page('tour');
  page._rev = 0; page._user = userId; page._visible = true; page._places = [];
  const stop = { id: 'stage', name: '本站', images: [{ id: 'a', url: '/a.jpg' }, { id: 'b', url: '/b.jpg', caption: '第二张' }], video: '/stage.mp4', extraAudios: [], guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'chapter', audioUrl: '/chapter.mp3', text: '讲解', order: 1 }] }] };
  page.setData({ route: { id: 'route' }, stops: [stop], loading: false, busy: false }); page._detail = { coordinateSystem: 1 };
  page.showStop(0, true);
  return { h, page, stop, audio: h.load('services/audio'), tour: h.load('core/tour') };
}

test('整站视频在解说后、后置音频前播放，跳过额外音频仍保留节点视频', () => {
  const { tour, stop } = setup();
  stop.extraAudios = [{ id: 'after', position: 'after', order: 1, url: '/after.mp3' }];
  const narration = stop.guideNarrations[0];
  assert.deepEqual(plain(tour.queueFor(stop, narration)).map(item => item.id), ['chapter', 'stop-video-stage', 'after']);
  assert.deepEqual(plain(tour.queueFor(stop, narration, { skipExtra: true })).map(item => item.id), ['chapter', 'stop-video-stage']);
  assert.deepEqual(plain(tour.queueFor({ ...stop, video: null }, narration)).map(item => item.id), ['chapter', 'after']);
});

test('解说结束自动打开视频，暂停续播有效，切站后旧视频事件不能推进新队列', () => {
  const { h, page, audio } = setup();
  const controls = [];
  h.my.createVideoContext = () => ({ pause() { controls.push('pause'); }, play() { controls.push('play'); } });
  page.play(); h.audioContexts[0].emit('Ended');
  const video = plain(page.data.videoItem);
  assert.equal(video.url, '/stage.mp4'); assert.equal(video.paused, false);
  const event = { currentTarget: { dataset: { generation: video.generation, id: video.id } } };
  page.videoPlay(event); assert.equal(audio.snapshot().playing, true);
  page.togglePlay(); assert.deepEqual(controls, ['pause']);
  page.videoPause(event); page.togglePlay(); assert.deepEqual(controls, ['pause', 'play']);
  page.videoEnded(event); assert.equal(audio.snapshot().item, null); assert.equal(page.data.videoItem, null);
  page.playStopVideo(); const stale = plain(page.data.videoItem);
  page.showStop(0, true); page.play();
  page.videoEnded({ currentTarget: { dataset: { generation: stale.generation, id: stale.id } } });
  assert.equal(audio.snapshot().item.id, 'chapter'); assert.equal(audio.snapshot().index, 0);
});

test('轮播切换边界、预览当前图片与换站归零保持一致', () => {
  const { h, page } = setup(); let preview;
  h.my.previewImage = value => { preview = value; };
  page.previousImage(); assert.equal(page.data.imageIndex, 0);
  page.nextImage(); page.nextImage(); assert.equal(page.data.imageIndex, 1);
  page.previewImages({ currentTarget: { dataset: { index: 1 } } });
  assert.deepEqual(plain(preview), { urls: ['/a.jpg', '/b.jpg'], current: 1 });
  page.changeImage({ detail: { current: 0 } }); assert.equal(page.data.imageIndex, 0);
  page.changeImage({ detail: { current: 99 } }); assert.equal(page.data.imageIndex, 0);
  page.nextImage(); page.showStop(0, true); assert.equal(page.data.imageIndex, 0);
});

test('仅有节点视频时仍可播放，手动看视频不会提交完成进度', () => {
  const { h, page, stop, audio } = setup();
  stop.guideNarrations = []; page.showStop(0, false);
  assert.equal(page.data.canPlayStop, true);
  page.play(); assert.equal(page.data.videoItem.url, '/stage.mp4');
  page.skipVideo(); assert.equal(audio.snapshot().item, null); assert.equal(h.requests.length, 0);
});

test('切换到空解说的讲解员后，节点视频仍可播放', () => {
  const { page } = setup();
  page.setData({ guides: [{ guideId: 'empty-guide', chapters: [] }] });
  page.chooseGuide({ detail: { value: 0 } });
  assert.equal(page.data.canPlayStop, true);
  page.play(); assert.equal(page.data.videoItem.url, '/stage.mp4');
});

test('原生全屏保持播放位置，退出不切队列，结束或切站会退出全屏并隔离旧事件', () => {
  const { h, page, audio } = setup();
  const calls = [];
  h.my.createVideoContext = id => ({ requestFullScreen(options) { calls.push({ id, direction: options.direction }); }, exitFullScreen() { calls.push('exit'); } });
  page.playStopVideo();
  const video = plain(page.data.videoItem);
  const event = { currentTarget: { dataset: { generation: video.generation, id: video.id } }, detail: { fullScreen: true, currentTime: 17, duration: 60 } };
  page.videoPlay(event); page.videoTime(event);
  page.fullscreenVideo();
  assert.deepEqual(calls, [{ id: 'tour-interlude-video', direction: 90 }]);
  assert.equal(audio.snapshot().time, 17); assert.equal(audio.snapshot().playing, true);
  page.videoFullscreenChange(event); assert.equal(page._videoFullscreen, true);
  page.videoFullscreenChange({ ...event, detail: { fullScreen: false } });
  assert.equal(page._videoFullscreen, false); assert.equal(audio.snapshot().time, 17);
  page.videoFullscreenChange(event); page.videoEnded(event);
  assert.equal(calls.at(-1), 'exit'); assert.equal(page.data.videoItem, null);
  page.playStopVideo();
  page.videoFullscreenChange(event); assert.equal(page._videoFullscreen, false);
  const nextEvent = { currentTarget: { dataset: { generation: page.data.videoItem.generation, id: page.data.videoItem.id } }, detail: { fullScreen: true } };
  page.videoFullscreenChange(nextEvent); page.showStop(0, true);
  assert.equal(calls.filter(call => call === 'exit').length, 2);
  const before = calls.length; page.fullscreenVideo(); assert.equal(calls.length, before);
});

test('原生全屏不可用时提示并保留当前视频', () => {
  const { h, page, audio } = setup();
  const toasts = [];
  h.my.showToast = options => toasts.push(options.content);
  page.playStopVideo(); const itemId = audio.snapshot().item.id;
  h.my.createVideoContext = () => ({}); page.fullscreenVideo();
  assert.equal(toasts[0], page.data.messages.videoFullscreenUnavailable);
  h.my.createVideoContext = () => ({ requestFullScreen(options) { options.fail(); } }); page.fullscreenVideo();
  assert.equal(toasts.length, 2); assert.equal(audio.snapshot().item.id, itemId);
});

test('视频出现时收起播放队列，视频期间不能展开队列，结束或跳过后可重新打开', () => {
  for (const finish of ['ended', 'skip']) {
    const { h, page, audio } = setup();
    page.play(); page.toggleQueue();
    assert.equal(page.data.queueOpen, true);
    h.audioContexts[0].emit('Ended');
    const video = plain(page.data.videoItem);
    assert.equal(page.data.queueOpen, false);
    const event = { currentTarget: { dataset: { generation: video.generation, id: video.id } }, detail: { currentTime: 12, duration: 60 } };
    page.videoPlay(event); page.videoTime(event);
    const before = plain(audio.snapshot());
    page.toggleQueue();
    assert.equal(page.data.queueOpen, false);
    assert.deepEqual(plain(audio.snapshot()), before);
    assert.equal(page.data.videoItem.generation, video.generation);
    if (finish === 'skip') page.skipVideo(); else page.videoEnded(event);
    assert.equal(page.data.videoItem, null);
    page.toggleQueue(); assert.equal(page.data.queueOpen, true);
  }
});

test('手动观看节点视频同样收起播放队列', () => {
  const { page } = setup();
  page.toggleQueue(); assert.equal(page.data.queueOpen, true);
  page.playStopVideo();
  assert.equal(page.data.videoItem.url, '/stage.mp4');
  assert.equal(page.data.queueOpen, false);
});

test('单独视频结束或跳过后恢复被打断的讲解位置，不提前完成本站', () => {
  for (const finish of ['ended', 'skip', 'error']) {
    const { h, page, audio } = setup();
    page.play(); h.audioContexts.at(-1).currentTime = 23;
    page.playStopVideo(); const video = plain(page.data.videoItem);
    const event = { currentTarget: { dataset: { generation: video.generation, id: video.id } } };
    if (finish === 'skip') page.skipVideo(); else if (finish === 'error') page.videoError(event); else page.videoEnded(event);
    assert.equal(audio.snapshot().item.id, 'chapter');
    assert.equal(audio.snapshot().time, 23);
    h.audioContexts.at(-1).emit('CanPlay');
    assert.equal(audio.snapshot().time, 23); assert.equal(h.requests.length, 0);
  }
});

test('后台结束的单独音频在返回页面后恢复主讲解，而不是重播补充音频', () => {
  const { h, page, audio } = setup();
  page.setData({ visit: { visitId: 'visit', status: 1, completedStageIds: [] }, stops: [page.data.stop, { ...page.data.stop, id: 'next' }], autoplay: true, tourStage: 'navigation' });
  page.play(); h.audioContexts.at(-1).currentTime = 19;
  page.enqueueCandidates([{ id: 'next', index: 1, distance: 3, order: 2 }]);
  page.playExtraItem({ id: 'extra', url: '/extra.mp3', kind: 'after' });
  page.onHide(); h.audioContexts.at(-1).emit('Ended');
  assert.equal(audio.snapshot().item, null);
  page.onShow(); assert.equal(audio.snapshot().item.id, 'chapter');
  assert.equal(audio.snapshot().time, 19); assert.equal(h.requests.length, 0);
  page.onUnload();
});

test('正式行程的视频独立站自然播完会完成本站并接续排队站，跳过或失败不冒充完成', async () => {
  for (const finish of ['ended', 'skip', 'error']) {
    const { h, page, stop } = setup();
    stop.guideNarrations = [];
    const next = { ...stop, id: 'next', video: '/next.mp4' };
    const visit = { visitId: 'visit', routeId: 'route', status: 1, currentStageId: 'stage', completedStageIds: [] };
    page.setData({ visit, stops: [stop, next], autoplay: true, tourStage: 'navigation' }); page.showStop(0, false);
    page.enqueueCandidates([{ id: 'next', index: 1, distance: 3, order: 2 }]); page.play();
    const video = plain(page.data.videoItem);
    const event = { currentTarget: { dataset: { generation: video.generation, id: video.id } } };
    if (finish === 'skip') page.skipVideo(); else if (finish === 'error') page.videoError(event); else page.videoEnded(event);
    if (finish !== 'ended') { assert.equal(h.requests.length, 0); assert.equal(page.data.browsing, false); continue; }
    assert.equal(h.requests[0].options.data.action, 'complete'); assert.equal(h.requests[0].options.data.completionSource, 2);
    h.requests[0].ok({ ...visit, completedStageIds: ['stage'] }); await tick();
    assert.equal(h.requests[1].options.data.action, 'start'); assert.equal(h.requests[1].options.data.stageId, 'next');
    h.requests[1].ok({ ...visit, currentStageId: 'next', completedStageIds: ['stage'] }); await tick();
    assert.equal(page.data.videoItem.url, '/next.mp4'); assert.equal(page.data.busy, false);
  }
});
