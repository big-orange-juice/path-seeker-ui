const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness.cjs');

function setup() {
  const fixture = harness(), handlers = {}, registrations = [];
  fixture.my.onAudioInterruptionBegin = callback => { handlers.begin = callback; registrations.push('begin'); };
  fixture.my.onAudioInterruptionEnd = callback => { handlers.end = callback; registrations.push('end'); };
  const manager = fixture.my.createInnerAudioContext();
  let assignments = 0;
  Object.defineProperty(manager, 'src', { set() { assignments++; manager.play(); } });
  fixture.my.getBackgroundAudioManager = () => manager;
  const interruption = fixture.load('services/audio-interruption'), audio = fixture.load('services/audio');
  return { fixture, handlers, registrations, manager, interruption, audio, assignments: () => assignments };
}

test('official interruption callbacks register once and require manual resume after end', () => {
  const { handlers, interruption, registrations } = setup();
  interruption.init(); interruption.init();
  assert.deepEqual(registrations, ['begin', 'end']);
  assert.equal(interruption.snapshot().supported, true);
  handlers.end();
  assert.equal(interruption.blocked(), false);
  handlers.begin(); handlers.begin();
  assert.deepEqual(plain(interruption.snapshot()), { supported: true, active: true, resumeRequired: true, version: 1 });
  assert.equal(interruption.resumeManually(), false);
  handlers.end(); handlers.end();
  assert.equal(interruption.snapshot().active, false);
  assert.equal(interruption.blocked(), true);
  assert.equal(interruption.resumeManually(), true);
  assert.equal(interruption.blocked(), false);
});

test('missing or partially registered APIs preserve the existing player without a stuck interruption', () => {
  const absent = harness();
  assert.equal(absent.load('services/audio-interruption').snapshot().supported, false);
  let begin;
  const partial = harness();
  partial.my.onAudioInterruptionBegin = callback => { begin = callback; };
  partial.my.onAudioInterruptionEnd = () => { throw Error('not available'); };
  const interruption = partial.load('services/audio-interruption');
  begin();
  assert.equal(interruption.snapshot().supported, false);
  assert.equal(interruption.blocked(), false);
});

test('native play, errors and progress cannot restart or fail audio during or after interruption', () => {
  const { handlers, manager, interruption, audio, assignments } = setup();
  let failures = 0;
  audio.playLive('tour', { id: 'live', url: 'https://media.test/live' }, { error() { failures++; } });
  handlers.begin();
  assert.equal(audio.snapshot().playing, false);
  manager.emit('Play');
  manager.currentTime = 4; manager.paused = false; manager.emit('TimeUpdate');
  manager.emit('Error', { errorMessage: 'system interruption' });
  audio.resume('tour');
  assert.equal(audio.snapshot().playing, false);
  assert.equal(audio.snapshot().failed, false);
  assert.equal(failures, 0);
  handlers.end();
  manager.emit('Play'); audio.resume('tour');
  assert.equal(audio.snapshot().playing, false);
  assert.equal(assignments(), 1);
  interruption.resumeManually(); audio.resume('tour');
  assert.equal(audio.snapshot().playing, true);
  audio.stop();
});

test('replacement sources and late room chunks cannot acquire audio while manual resume is required', () => {
  const { handlers, interruption, audio, assignments, fixture } = setup();
  handlers.begin(); handlers.end();
  audio.playLive('tour', { id: 'late', url: 'https://media.test/late' });
  assert.equal(assignments(), 0);
  const count = fixture.audioContexts.length;
  const token = audio.beginStream('translation-room');
  audio.appendStream(token, { id: 'late-room', url: '/data/late.mp3' });
  assert.equal(fixture.audioContexts.length, count);
  assert.equal(audio.snapshot().requested, false);
  assert.equal(interruption.blocked(), true);
  interruption.resumeManually(); audio.resume('translation-room');
  assert.equal(audio.snapshot().playing, true);
  audio.stop();
});

test('a delayed video play after interruption is paused and cannot bypass the audio guard', () => {
  const { handlers, audio, interruption } = setup();
  const controls = [];
  audio.playQueue('tour', [{ id: 'video', url: '/scene.mp4', kind: 'interlude-video' }], {
    video() {}, videoControl(value) { controls.push(value); }
  });
  const token = audio.snapshot().generation;
  audio.videoEvent('play', token, 'video');
  handlers.begin(); handlers.end();
  audio.videoEvent('play', token, 'video');
  assert.equal(audio.snapshot().playing, false);
  assert.equal(controls.at(-1), 'pause');
  assert.equal(interruption.blocked(), true);
  audio.stop();
});

test('room listening stays muted after interruption until the visitor explicitly resumes it', () => {
  const { fixture, handlers, audio, interruption } = setup();
  fixture.load('services/translation-room').connect = () => ({
    close() {}, pause(value) { if (value) audio.pause(); else audio.resume('translation-room'); }
  });
  const translation = fixture.load('services/translation-session');
  translation.attach({ roomId: '9223372036854775803', code: '12345678', isHost: false, status: 'live' }, 'zh');
  audio.playQueue('translation-room', [{ id: 'speech', url: '/speech.mp3' }]);
  handlers.begin();
  assert.equal(translation.snapshot().paused, true);
  translation.togglePause();
  assert.equal(audio.snapshot().playing, false);
  handlers.end();
  assert.equal(translation.snapshot().paused, true);
  translation.togglePause();
  assert.equal(interruption.blocked(), false);
  assert.equal(translation.snapshot().paused, false);
  assert.equal(audio.snapshot().playing, true);
  translation.disconnect(); audio.stop();
});
