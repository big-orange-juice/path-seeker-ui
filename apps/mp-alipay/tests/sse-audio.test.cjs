const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness.cjs');
const event = (type, payload, eventId) => 'data: ' + JSON.stringify({ type, payload, eventId }) + '\n\n';
test('SSE deduplicates event IDs, accepts multiline payload and empty final audio chunk', () => {
  const { parseSSE, answerFrom } = harness().load('core/sse');
  const response = '\uFEFF' + event('text.delta', { content: 'Hello' }, '1') + event('text.delta', { content: 'Hello' }, '1') + 'data: {"type":"text.delta",\ndata: "payload":{"content":" world"}}\n\n' + event('audio.delta', { audio: '00ff' }) + event('audio.delta', { audio: '', isFinal: true }) + event('done', { assistantMessageId: '9223372036854775806' });
  const answer = answerFrom(parseSSE(response.replace(/\n/g, '\r\n')));
  assert.equal(answer.content, 'Hello world'); assert.equal(answer.id, '9223372036854775806'); assert.deepEqual(plain(answer.audio), [{ hex: '00ff', format: 'mp3' }]);
});
test('incomplete answers and invalid audio do not play as complete replies', () => {
  const { parseSSE, answerFrom } = harness().load('core/sse');
  assert.match(answerFrom(parseSSE(event('text.delta', { content: 'partial' }))).error, /中断/);
  assert.throws(() => parseSSE('data: {broken\n\n'), /不完整/);
  const bad = answerFrom(parseSSE(event('audio.delta', { audio: 'xx', isFinal: true }) + event('done', {})));
  assert.equal(bad.audio.length, 0); assert.match(bad.audioError, /不支持/);
  const interrupted = answerFrom(parseSSE(event('audio.delta', { audio: 'aaff', isFinal: true }) + event('audio.error', { message: 'TTS failed' }) + event('done', {})));
  assert.equal(interrupted.audio.length, 0); assert.equal(interrupted.audioError, 'TTS failed');
});
test('incremental SSE parser keeps incomplete frames until the next chunk', () => {
  const { createSSEStreamParser, answerFrom } = harness().load('core/sse');
  const parser = createSSEStreamParser();
  const first = parser.push('data: {"type":"text.delta","payload":{"content":"分"');
  assert.equal(first.length, 0);
  const second = parser.push('}}\n\ndata: {"type":"done","payload":{}}\n\n');
  assert.equal(answerFrom(second).content, '分');
  assert.equal(answerFrom(second).done, true);
  assert.equal(parser.pending(), false);
});
test('audio queue order and completion resist callbacks from disposed contexts', () => {
  const h = harness(), audio = h.load('services/audio'); let finished = 0;
  audio.playQueue('tour', [{ id: 'before', url: 'before' }, { id: 'chapter', url: 'chapter' }], { finished: () => finished++ });
  const first = h.audioContexts[0], stale = first.callbacks('Ended')[0]; first.emit('Ended');
  assert.equal(h.audioContexts[1].src, 'chapter'); assert.equal(first.destroyed, true);
  stale(); assert.equal(audio.snapshot().index, 1); assert.equal(finished, 0);
  h.audioContexts[1].emit('Ended'); assert.equal(finished, 1); assert.equal(audio.snapshot().playing, false);
});
test('chat owns playback exclusively; stopping tour cannot stop chat', () => {
  const h = harness(), audio = h.load('services/audio');
  audio.playQueue('tour', [{ id: '1', url: 'tour' }]); const stale = h.audioContexts[0].callbacks('Ended')[0];
  audio.playQueue('chat', [{ id: '2', url: 'chat' }]); audio.stop('tour'); stale();
  assert.equal(audio.snapshot().owner, 'chat'); assert.equal(audio.snapshot().index, 0); assert.equal(audio.snapshot().playing, true);
  audio.pause(); assert.equal(audio.snapshot().playing, false); audio.resume('chat'); assert.equal(audio.snapshot().playing, true);
  audio.seek(-5, 'chat'); assert.equal(h.audioContexts[1].currentTime, 0); audio.seek(200, 'chat'); assert.equal(h.audioContexts[1].currentTime, 60);
});
test('checkpoint seek waits for canPlay and missing or failed audio cannot auto-complete', () => {
  const h = harness(), audio = h.load('services/audio'), tour = h.load('core/tour');
  const queue = [{ id: '1', kind: 'chapter', url: 'one' }];
  audio.playQueue('tour', queue, {}, { time: 12 }); assert.equal(h.audioContexts[0].currentTime, 0);
  h.audioContexts[0].emit('CanPlay'); assert.equal(h.audioContexts[0].currentTime, 12);
  h.audioContexts[0].emit('Error', { errorMessage: 'network' }); assert.equal(tour.canCompleteAudio(queue, audio.snapshot().failed, false), false);
  audio.resume('tour'); assert.equal(h.audioContexts.length, 2); assert.equal(audio.snapshot().failed, false);
  let finished = false; audio.playQueue('tour', [{ kind: 'chapter', url: null }], { finished: () => finished = true });
  assert.equal(finished, false); assert.equal(audio.snapshot().failed, true);
  assert.equal(tour.canCompleteAudio(queue, false, true), false);
});

test('failed optional audio is skipped while a successfully played narration can complete', () => {
  const h = harness(), audio = h.load('services/audio'), tour = h.load('core/tour'); let result;
  const queue = [{ id: 'before', kind: 'before', url: null }, { id: 'chapter', kind: 'chapter', url: 'chapter' }, { id: 'after', kind: 'after', url: 'after' }];
  audio.playQueue('tour', queue, { finished: state => result = state });
  assert.equal(h.audioContexts[0].src, 'chapter'); h.audioContexts[0].emit('Ended'); h.audioContexts[1].emit('Error', { errorMessage: 'missing optional audio' });
  assert.equal(result.failed, false); assert.equal(tour.canCompleteAudio(queue, result.failed, false), true);
});

test('an ended callback after a narration error cannot falsely advance the queue', () => {
  const h = harness(), audio = h.load('services/audio'); let finished = 0;
  audio.playQueue('tour', [{ id: 'chapter', kind: 'chapter', url: 'chapter' }], { finished: () => finished++ });
  h.audioContexts[0].emit('Error', { errorMessage: 'failed' }); h.audioContexts[0].emit('Ended');
  assert.equal(finished, 0); assert.equal(audio.snapshot().index, 0);
});

test('stream preloads the next file without playing it and switches to the prepared context', () => {
  const h = harness(), audio = h.load('services/audio');
  const token = audio.beginStream('translation-room', {});
  audio.appendStream(token, { url: 'first' });
  audio.appendStream(token, { url: 'second' });
  const [first, second] = h.audioContexts;
  assert.equal(second.src, 'second');
  assert.equal(audio.snapshot().item.url, 'first');
  assert.equal(audio.snapshot().playing, true);
  first.emit('Ended');
  assert.equal(h.audioContexts.length, 2);
  assert.equal(audio.snapshot().item.url, 'second');
  assert.equal(second.destroyed, false);
  audio.stop();
  assert.equal(second.destroyed, true);
});

test('stopping a queue disposes prepared audio and stale callbacks cannot resume it', () => {
  const h = harness(), audio = h.load('services/audio');
  audio.playQueue('tour', [{ url: 'first' }, { url: 'second' }]);
  const [first, prepared] = h.audioContexts, stale = first.callbacks('Ended')[0];
  audio.stop(); stale();
  assert.equal(prepared.destroyed, true);
  assert.equal(audio.snapshot().owner, '');
});

test('paused streams stay silent when audio arrives and can resume after an empty queue', () => {
  const h = harness(), audio = h.load('services/audio');
  const token = audio.beginStream('translation-room', {});
  audio.pause(); audio.appendStream(token, { url: 'first' });
  assert.equal(audio.snapshot().playing, false);
  audio.resume('translation-room'); assert.equal(audio.snapshot().playing, true);
  h.audioContexts[0].emit('Ended');
  audio.pause(); audio.resume('translation-room');
  audio.appendStream(token, { url: 'second' });
  assert.equal(audio.snapshot().playing, true);
});

test('preload errors and a single-context platform fall back without interrupting current playback', () => {
  for (const limited of [false, true]) {
    const h = harness(), audio = h.load('services/audio'); let errors = 0;
    const create = h.my.createInnerAudioContext;
    if (limited) h.my.createInnerAudioContext = () => {
      if (h.audioContexts.some(item => !item.destroyed)) throw Error('resource limit');
      return create();
    };
    audio.playQueue('tour', [{ url: 'first' }, { url: 'second' }], { error: () => errors++ });
    if (!limited) h.audioContexts[1].emit('Error', { errorMessage: 'preload failed' });
    assert.equal(audio.snapshot().playing, true);
    h.audioContexts[0].emit('Ended');
    assert.equal(audio.snapshot().item.url, 'second');
    assert.equal(audio.snapshot().playing, true);
    assert.equal(errors, 0);
  }
});
