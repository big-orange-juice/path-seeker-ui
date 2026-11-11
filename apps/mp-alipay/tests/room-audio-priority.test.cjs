const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId } = require('./harness.cjs');
const room = { roomId: '9223372036854775805', code: '12345678', isHost: false, status: 'open', epochId: '1' };

function setup(context, status = 'open') {
  context.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: Date.now() });
  const h = harness(), handlers = {};
  for (const name of ['Open', 'Message', 'Close', 'Error']) {
    h.my['onSocket' + name] = callback => { handlers[name] = callback; };
    h.my['offSocket' + name] = callback => { if (handlers[name] === callback) delete handlers[name]; };
  }
  h.my.connectSocket = () => {};
  h.my.closeSocket = () => {};
  h.my.sendSocketMessage = options => options.success({});
  h.my.createVideoContext = () => ({ play() {}, pause() {}, seek() {} });
  const session = h.load('services/translation-session'), page = h.page('tour'), audio = h.load('services/audio');
  const stop = { id: 'stop', name: '银锭桥', images: [], extraAudios: [],
    guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'chapter', audioUrl: '/scenic.mp3' }] }] };
  page._rev = 0; page._visible = true; page._user = userId; page._places = [];
  page.setData({ route: { id: 'route' }, stops: [stop], tourStage: 'navigation', following: false,
    visit: { visitId: 'visit', routeId: 'route', status: 1, currentStageId: 'stop', completedStageIds: [] } });
  page.showStop(0, false);
  session.attach({ ...room, status }, 'en');
  handlers.Open();
  const emit = event => handlers.Message({ data: JSON.stringify(event) });
  emit({ type: 'subscription.ready', targetLanguage: 'en', subscriptionVersion: 1, payload: { room: { ...room, status }, startSequence: 1 } });
  const unsubscribe = session.subscribe(() => page.syncRoomPlayback());
  context.after(() => { unsubscribe(); session.disconnect(); page.onUnload(); });
  const segment = (type, payload = {}, sequence = 1, epochId = '2') => emit({ type, roomId: room.roomId, epochId, sequence, targetLanguage: 'en', subscriptionVersion: 1, payload });
  return { h, session, page, audio, emit, segment };
}

test('an open room allows scenic playback and a driver restart pauses and resumes the same chapter at its time', async context => {
  const { h, session, page, audio, segment } = setup(context);
  assert.equal(page.roomAudioActive(), false);
  page.play();
  assert.equal(session.snapshot().paused, false);
  audio.seek(19, 'tour');
  segment('room.started');
  assert.equal(audio.snapshot().owner, 'translation-room');
  assert.equal(page._roomResume.time, 19);
  assert.equal(page._roomResume.items[0].id, 'chapter');
  segment('room.paused', { reason: 'host_paused' });
  assert.equal(page.roomAudioActive(), true);
  segment('room.input.drained');
  assert.equal(audio.snapshot().owner, 'tour');
  assert.equal(audio.snapshot().item.id, 'chapter');
  assert.equal(audio.snapshot().time, 19);
  assert.equal(audio.snapshot().playing, true);
  assert.equal(session.snapshot().paused, false);
  assert.equal(h.requests.length, 0);
});

test('pause waits for committed translation, asynchronous file creation and the last translated audio to finish', async context => {
  const { h, page, audio, segment } = setup(context, 'live');
  const deferredWrites = [];
  h.my.getFileSystemManager = () => ({
    writeFile: options => deferredWrites.push(options), unlink: options => options.success({})
  });
  segment('room.started');
  segment('room.paused');
  segment('transcript.final', { text: '这里是银锭桥' });
  segment('room.input.drained');
  assert.equal(page.roomAudioActive(), true);
  segment('translation.committed', { text: '这里是银锭桥' });
  segment('audio.started', { format: 'mp3' });
  segment('audio.delta', { audio: 'aabb', isFinal: true });
  segment('audio.done');
  segment('translation.final', { text: 'This is Yinding Bridge.' });
  await tick();
  assert.equal(deferredWrites.length, 1);
  assert.equal(page.roomAudioActive(), true);
  page.play(); assert.equal(audio.snapshot().owner, 'translation-room');
  deferredWrites[0].success({}); await tick();
  assert.equal(audio.snapshot().playing, true);
  assert.equal(page.roomAudioActive(), true);
  h.audioContexts.at(-1).emit('Ended');
  assert.equal(page.roomAudioActive(), false);
  page.play();
  assert.equal(audio.snapshot().owner, 'tour');
  assert.equal(audio.snapshot().item.id, 'chapter');
});

test('late translated audio interrupts scenic playback and restores it after the tail finishes', async context => {
  const { h, page, audio, segment } = setup(context);
  page.play(); audio.seek(23, 'tour');
  segment('audio.started', { format: 'mp3' });
  assert.equal(page._roomResume.time, 23);
  assert.equal(audio.snapshot().owner, 'translation-room');
  segment('audio.delta', { audio: 'aabb', isFinal: true });
  segment('audio.done'); await tick();
  assert.equal(audio.snapshot().owner, 'translation-room');
  h.audioContexts.at(-1).emit('Ended');
  assert.equal(audio.snapshot().owner, 'tour');
  assert.equal(audio.snapshot().time, 23);
  assert.equal(audio.snapshot().playing, true);
});

test('an old input-drained event cannot release a newer paused input round', context => {
  const { page, segment } = setup(context);
  segment('room.started', {}, 1, '3');
  segment('room.paused', {}, 1, '3');
  segment('room.input.drained', {}, 1, '2');
  assert.equal(page.roomAudioActive(), true);
  segment('room.input.drained', { epochId: '2' }, 1, '3');
  assert.equal(page.roomAudioActive(), true);
  segment('room.input.drained', {}, 1, '3');
  assert.equal(page.roomAudioActive(), false);
});

test('visitor mute remains explicit while scenic playback and new driver speech come and go', async context => {
  const { h, session, page, audio, segment } = setup(context, 'live');
  session.togglePause(); page.play();
  assert.equal(audio.snapshot().owner, 'tour');
  segment('room.started');
  segment('audio.started');
  segment('audio.delta', { audio: 'aabb', isFinal: true });
  segment('audio.done'); await tick();
  assert.equal(session.snapshot().paused, true);
  assert.equal(audio.snapshot().owner, 'tour');
  assert.equal(audio.snapshot().playing, true);
  assert.equal(h.requests.length, 0);
});

test('extra audio and video yield an idle room and respect active driver priority', context => {
  const { session, page, audio, segment } = setup(context);
  page.playExtraItem({ id: 'extra', url: '/extra.mp3', kind: 'after' });
  assert.equal(session.snapshot().paused, false);
  assert.equal(audio.snapshot().owner, 'tour');
  segment('room.started');
  page.playExtraItem({ id: 'video', url: '/extra.mp4', kind: 'interlude-video' });
  assert.equal(audio.snapshot().owner, 'translation-room');
  segment('room.paused'); segment('room.input.drained');
  assert.equal(audio.snapshot().item.id, 'extra');
  page.playExtraItem({ id: 'video', url: '/extra.mp4', kind: 'interlude-video' });
  assert.equal(audio.snapshot().item.id, 'video');
  assert.equal(session.snapshot().paused, false);
});

test('immediate room closure releases active translated audio and resumes the interrupted scenic chapter', async context => {
  const { page, audio, segment } = setup(context);
  page.play(); audio.seek(12, 'tour');
  segment('room.started');
  segment('audio.started');
  segment('audio.delta', { audio: 'aabb', isFinal: true });
  segment('audio.done'); await tick();
  assert.equal(audio.snapshot().owner, 'translation-room');
  segment('room.closed', { mode: 'immediate' });
  assert.equal(page.roomAudioActive(), false);
  assert.equal(audio.snapshot().owner, 'tour');
  assert.equal(audio.snapshot().time, 12);
  assert.equal(audio.snapshot().playing, true);
});
