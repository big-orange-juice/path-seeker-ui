const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId } = require('./harness.cjs');

function setup(context, sourceLanguage = 'zh-CN', targetLanguage = 'en') {
  context.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: Date.now() });
  const h = harness(), handlers = {};
  for (const name of ['Open', 'Message', 'Close', 'Error']) {
    h.my['onSocket' + name] = callback => { handlers[name] = callback; };
    h.my['offSocket' + name] = callback => { if (handlers[name] === callback) delete handlers[name]; };
  }
  h.my.connectSocket = () => {};
  h.my.closeSocket = () => {};
  h.my.sendSocketMessage = options => options.success({});
  const session = h.load('services/translation-session'), page = h.page('tour'), audio = h.load('services/audio');
  const stop = { id: '9223372036854775804', name: '银锭桥', images: [], extraAudios: [],
    guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'chapter', audioUrl: '/scenic.mp3' }] }] };
  page._rev = 0; page._visible = true; page._user = userId; page._places = [];
  page.setData({ route: { id: 'route' }, stops: [stop], tourStage: 'navigation', following: false,
    visit: { visitId: 'visit', routeId: 'route', status: 1, currentStageId: stop.id, completedStageIds: [] } });
  page.showStop(0, false);
  const room = { roomId: '9223372036854775805', code: '12345678', isHost: false, status: 'open', sourceLanguage, epochId: '9223372036854775803' };
  session.attach(room, targetLanguage); handlers.Open();
  const emit = value => handlers.Message({ data: JSON.stringify(value) });
  emit({ type: 'subscription.ready', targetLanguage, subscriptionVersion: 1, payload: { room, startSequence: 1 } });
  const unsubscribe = session.subscribe(() => page.syncRoomPlayback());
  context.after(() => { unsubscribe(); session.disconnect(); page.onUnload(); });
  const segment = (type, sequence, payload = {}) => emit({ type, roomId: room.roomId, epochId: room.epochId,
    sequence, targetLanguage, subscriptionVersion: 1, payload });
  page.play(); audio.seek(17, 'tour');
  segment('room.started', 0, { provider: 'doubao' });
  return { h, session, page, audio, segment };
}

test('Doubao source and translation with different sequences release scenic playback after the translated tail', async context => {
  const { h, session, page, audio, segment } = setup(context);
  segment('transcript.final', 1, { text: '这里是银锭桥', provider: 'doubao' });
  segment('translation.committed', 2, { text: '', provider: 'doubao' });
  segment('audio.started', 2, { format: 'mp3' });
  segment('audio.delta', 2, { audio: 'aabb', isFinal: true });
  segment('audio.done', 2);
  segment('translation.final', 2, { text: 'This is Yinding Bridge.', provider: 'doubao' });
  segment('room.paused', 2, { reason: 'host_paused' });
  segment('room.input.drained', 2);
  await tick();
  assert.equal(session.snapshot().translationPending, false);
  assert.equal(page.roomAudioActive(), true, 'the translated audio tail still holds priority');
  h.audioContexts.at(-1).emit('Ended');
  assert.equal(page.roomAudioActive(), false);
  assert.equal(audio.snapshot().owner, 'tour');
  assert.equal(audio.snapshot().item.id, 'chapter');
  assert.equal(audio.snapshot().time, 17);
  assert.equal(audio.snapshot().playing, true);
});

test('input drained still waits for every committed Doubao translation when sources use separate sequences', context => {
  const { session, page, audio, segment } = setup(context);
  segment('transcript.final', 1, { text: '第一句', provider: 'doubao' });
  segment('translation.committed', 2, { text: '', provider: 'doubao' });
  segment('transcript.final', 3, { text: '第二句', provider: 'doubao' });
  segment('translation.committed', 4, { text: '', provider: 'doubao' });
  segment('translation.final', 2, { text: 'First sentence.', provider: 'doubao' });
  segment('room.paused', 4, { reason: 'host_paused' });
  segment('room.input.drained', 4);
  assert.equal(session.snapshot().translationPending, true);
  assert.equal(page.roomAudioActive(), true);
  assert.equal(audio.snapshot().owner, 'translation-room');
  segment('translation.final', 4, { text: 'Second sentence.', provider: 'doubao' });
  assert.equal(session.snapshot().translationPending, false);
  assert.equal(page.roomAudioActive(), false);
  assert.equal(audio.snapshot().owner, 'tour');
  assert.equal(audio.snapshot().time, 17);
});

test('legacy sources keep priority before their translation commit arrives', context => {
  const { session, page, audio, segment } = setup(context);
  segment('transcript.final', 1, { text: '这里是银锭桥' });
  segment('room.paused', 1, { reason: 'host_paused' });
  segment('room.input.drained', 1);
  assert.equal(session.snapshot().translationPending, true);
  assert.equal(page.roomAudioActive(), true);
  segment('translation.committed', 1, { text: '这里是银锭桥' });
  segment('translation.final', 1, { text: 'This is Yinding Bridge.' });
  assert.equal(session.snapshot().translationPending, false);
  assert.equal(page.roomAudioActive(), false);
  assert.equal(audio.snapshot().owner, 'tour');
  assert.equal(audio.snapshot().time, 17);
});

test('failed Doubao translation releases priority without retaining its separate source sequence', context => {
  const { session, page, audio, segment } = setup(context);
  segment('transcript.final', 1, { text: '这里是银锭桥', provider: 'doubao' });
  segment('translation.committed', 2, { text: '', provider: 'doubao' });
  segment('room.paused', 2, { reason: 'host_paused' });
  segment('room.input.drained', 2);
  assert.equal(page.roomAudioActive(), true);
  segment('language.error', 2, { code: 'empty_translation', message: '本段未生成译文' });
  assert.equal(session.snapshot().translationPending, false);
  assert.equal(page.roomAudioActive(), false);
  assert.equal(audio.snapshot().owner, 'tour');
});

for (const [sourceLanguage, targetLanguage] of [['zh-CN', 'zh-CN'], ['zh-CN', 'yue'], ['ru', 'ja'], ['en', 'en']]) {
  test('Doubao source ' + sourceLanguage + ' to legacy target ' + targetLanguage + ' waits for its delayed translation', async context => {
    const { h, session, page, audio, segment } = setup(context, sourceLanguage, targetLanguage);
    segment('transcript.final', 1, { text: '这里是银锭桥', provider: 'doubao' });
    segment('room.paused', 1, { reason: 'host_paused' });
    segment('room.input.drained', 1);
    assert.equal(session.snapshot().translationPending, true, 'legacy fallback must wait even before its worker commits');
    assert.equal(page.roomAudioActive(), true);
    assert.equal(audio.snapshot().owner, 'translation-room');
    segment('translation.committed', 1, { text: '这里是银锭桥' });
    segment('audio.started', 1, { format: 'mp3' });
    segment('audio.delta', 1, { audio: 'aabb', isFinal: true });
    segment('audio.done', 1);
    segment('translation.final', 1, { text: '讲解译文' });
    await tick();
    assert.equal(session.snapshot().translationPending, false);
    assert.equal(page.roomAudioActive(), true, 'the fallback audio tail still holds priority');
    h.audioContexts.at(-1).emit('Ended');
    assert.equal(page.roomAudioActive(), false);
    assert.equal(audio.snapshot().owner, 'tour');
    assert.equal(audio.snapshot().item.id, 'chapter');
    assert.equal(audio.snapshot().time, 17);
  });
}
