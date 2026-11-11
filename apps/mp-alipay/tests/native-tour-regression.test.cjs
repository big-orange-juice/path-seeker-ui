const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId } = require('./harness.cjs');

function setup(context) {
  const fixture = harness();
  fixture.load('config').serverTourAudio = false;
  const manager = fixture.my.createInnerAudioContext();
  fixture.audioContexts.length = 0;
  delete manager.destroy;
  let source = '', assignments = 0;
  Object.defineProperty(manager, 'src', { get: () => source, set(value) { source = value; assignments++; manager.currentTime = manager.startTime || 0; manager.play(); } });
  fixture.my.getBackgroundAudioManager = () => manager;
  fixture.my.createVideoContext = () => ({ play() {}, pause() {}, seek() {} });
  const page = fixture.page('tour'), audio = fixture.load('services/audio');
  const stops = ['first', 'second'].map((id, index) => ({ id, name: id, order: index + 1, images: [], extraAudios: [],
    guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'chapter-' + id, audioUrl: 'https://media.test/' + id + '.mp3' }] }] }));
  const visit = { visitId: '9223372036854775801', routeId: '9223372036854775802', currentStageId: 'first', status: 1, completedStageIds: [], visitedStageIds: [] };
  page._rev = 0; page._visible = true; page._user = userId; page._places = [];
  page.setData({ route: { id: visit.routeId }, stops, tourStage: 'navigation', visit, autoplay: true });
  page.showStop(0, false);
  context.after(() => page.onUnload());
  return { fixture, page, audio, manager, visit, assignments: () => assignments };
}

test('native scenic completion updates the visit once and starts the queued next stop without server audio sessions', async context => {
  const { fixture, page, audio, manager, visit } = setup(context);
  assert.equal(fixture.load('config').serverTourAudio, false);
  page.sequenceStatus('first', 'playing', 0); page.sequenceStatus('second', 'queued', 1); page.play();
  const oldEnd = manager.callbacks('Ended')[0];
  manager.emit('Ended'); oldEnd();
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0].options.data.action, 'complete');
  fixture.requests[0].ok({ ...visit, completedStageIds: ['first'] }); await tick();
  assert.equal(fixture.requests[1].options.data.action, 'start');
  assert.equal(fixture.requests[1].options.data.stageId, 'second');
  fixture.requests[1].ok({ ...visit, currentStageId: 'second', completedStageIds: ['first'] }); await tick();
  assert.equal(audio.snapshot().item.id, 'chapter-second');
  assert.equal(audio.snapshot().playing, true);
  oldEnd();
  assert.equal(audio.snapshot().item.id, 'chapter-second');
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.audioContexts.length, 0);
  assert.ok(fixture.requests.every(request => !/TourAudioSessions|AudioContinuityProbe/.test(request.options.url)));
});

test('native narration yields to an answer and restores its saved chapter position when chat closes', context => {
  const { fixture, page, audio, manager } = setup(context);
  page.play(); manager.currentTime = 23; page.ask();
  audio.playQueue('chat', [{ id: 'answer', url: '/data/answer.mp3' }]);
  assert.equal(audio.snapshot().owner, 'chat');
  fixture.audioContexts.at(-1).emit('Ended');
  page.closeChat(); manager.emit('CanPlay');
  assert.equal(audio.snapshot().owner, 'tour');
  assert.equal(audio.snapshot().item.id, 'chapter-first');
  assert.equal(audio.snapshot().time, 23);
  assert.equal(audio.snapshot().playing, true);
  assert.equal(fixture.requests.length, 0);
});

test('hidden native narration resumes after a room interruption and rejects late old controls', context => {
  const { fixture, page, audio, manager } = setup(context);
  page.play(); manager.currentTime = 17; page.onHide();
  const stalePause = manager.callbacks('Pause')[0];
  let roomBusy = true;
  fixture.load('services/translation-session').snapshot = () => ({ audioPlaying: roomBusy });
  page.syncRoomPlayback();
  audio.playQueue('translation-room', [{ id: 'room-audio', url: '/data/room.mp3' }]);
  roomBusy = false; audio.stop('translation-room'); page.syncRoomPlayback(); manager.emit('CanPlay');
  stalePause();
  assert.equal(page._visible, false);
  assert.equal(audio.snapshot().owner, 'tour');
  assert.equal(audio.snapshot().playing, true);
  assert.equal(audio.snapshot().time, 17);
  assert.equal(fixture.requests.length, 0);
});

test('native panel pause and stop survive foreground restoration without completing a scenic stop', context => {
  for (const event of ['Pause', 'Stop']) {
    const { fixture, page, audio, manager, assignments } = setup(context);
    page.play(); manager.currentTime = 11; manager.emit(event); page.onHide(); page.onShow();
    manager.emit('Ended');
    assert.equal(audio.snapshot().playing, false, event);
    assert.equal(audio.snapshot().item.id, 'chapter-first', event);
    assert.equal(assignments(), 1, event);
    assert.equal(fixture.requests.length, 0, event);
    manager.emit('Play');
    assert.equal(audio.snapshot().playing, true, event);
    assert.equal(audio.snapshot().time, 11, event);
  }
});

test('native media error never completes a visit and explicit retry can restore normal playback', context => {
  const { fixture, page, audio, manager, assignments } = setup(context);
  page.play();
  manager.emit('Error', { errorMessage: 'connection lost' });
  manager.emit('Ended');
  assert.equal(fixture.requests.length, 0);
  assert.equal(audio.snapshot().failed, true);
  assert.equal(assignments(), 1);
  page.togglePlay();
  assert.equal(audio.snapshot().failed, false);
  assert.equal(audio.snapshot().playing, true);
  assert.equal(assignments(), 2);
});
