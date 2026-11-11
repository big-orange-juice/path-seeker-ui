const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, userId } = require('./harness.cjs');

function setup() {
  const fixture = harness();
  const manager = fixture.my.createInnerAudioContext();
  fixture.audioContexts.length = 0;
  delete manager.destroy;
  let source = '', assignments = 0;
  Object.defineProperty(manager, 'src', {
    get: () => source,
    set(value) { source = value; assignments++; manager.play(); }
  });
  fixture.my.getBackgroundAudioManager = () => manager;
  return { fixture, manager, audio: fixture.load('services/audio'), assignments: () => assignments };
}

test('tour HTTPS audio uses the native background singleton and isolates old item events', () => {
  const { fixture, manager, audio } = setup();
  let completed = 0;
  audio.playQueue('tour', [{ id: 'one', title: '第一段', url: 'https://media.test/one.mp3' }, { id: 'two', title: '第二段', url: 'https://media.test/two.mp3' }], { finished: () => completed++ });
  assert.equal(fixture.audioContexts.length, 0);
  assert.equal(manager.title, '第一段');
  assert.equal(audio.snapshot().playing, true);
  const staleEnded = manager.callbacks('Ended')[0], staleError = manager.callbacks('Error')[0];
  manager.emit('Ended');
  assert.equal(manager.title, '第二段');
  staleEnded(); staleError({ errorMessage: 'late' });
  assert.equal(audio.snapshot().index, 1);
  assert.equal(audio.snapshot().failed, false);
  manager.emit('Ended');
  assert.equal(completed, 1);
  assert.equal(manager.callbacks('Ended').length, 0);
});

test('native panel pause survives foreground restoration and native play can resume it', () => {
  const { fixture, manager, audio } = setup();
  const page = fixture.page('tour');
  page._user = userId;
  const key = page.contextKey();
  page._visible = true;
  audio.playQueue('tour', [{ id: 'one', url: 'https://media.test/one.mp3' }], { change: state => page.updatePlaybackProgress(state, key) });
  const checkpoint = page.capturePlayback();
  manager.currentTime = 14;
  manager.emit('Pause');
  assert.equal(audio.snapshot().requested, false);
  assert.equal(page._userPaused, true);
  assert.equal(page.restorePlayback(checkpoint), false);
  manager.emit('Ended');
  assert.equal(audio.snapshot().index, 0);
  manager.emit('Play');
  assert.equal(audio.snapshot().playing, true);
  assert.equal(page._userPaused, false);
  assert.equal(audio.snapshot().time, 14);
  audio.stop();
});

test('an explicitly paused stream cannot auto-start when the background src setter plays', () => {
  const { manager, audio } = setup();
  const token = audio.beginStream('tour', {});
  audio.pause();
  audio.appendStream(token, { id: 'one', url: 'https://media.test/one.mp3' });
  assert.equal(audio.snapshot().playing, false);
  assert.equal(audio.snapshot().nativePaused, false);
  manager.emit('Play');
  assert.equal(audio.snapshot().playing, false);
  audio.resume('tour');
  assert.equal(audio.snapshot().playing, true);
  audio.stop();
});

test('background playback sets the saved start time and reassigns repeated sources', () => {
  const { manager, audio, assignments } = setup();
  audio.playQueue('tour', [{ id: 'one', url: 'https://media.test/repeat.mp3' }, { id: 'two', url: 'https://media.test/repeat.mp3' }], {}, { time: 12 });
  assert.equal(manager.startTime, 12);
  manager.emit('CanPlay');
  assert.equal(manager.currentTime, 12);
  manager.emit('Ended');
  assert.equal(manager.startTime, 0);
  assert.equal(assignments(), 2);
  audio.stop();
});

test('room temp files, disabled background playback and missing native API retain inner audio', () => {
  for (const mode of ['room', 'disabled', 'missing']) {
    const { fixture, manager, audio } = setup();
    if (mode === 'disabled') fixture.load('config').backgroundAudio = false;
    if (mode === 'missing') delete fixture.my.getBackgroundAudioManager;
    audio.playQueue(mode === 'room' ? 'translation-room' : 'tour', [{ id: 'one', url: mode === 'room' ? '/data/room.mp3' : 'https://media.test/one.mp3' }]);
    assert.equal(fixture.audioContexts.length, 1);
    assert.equal(manager.src, '');
    audio.stop();
    assert.equal(fixture.audioContexts[0].destroyed, true);
  }
});

test('switching owners removes singleton listeners and rejects its delayed controls', () => {
  const { fixture, manager, audio } = setup();
  audio.playQueue('tour', [{ id: 'one', url: 'https://media.test/one.mp3' }]);
  const stalePause = manager.callbacks('Pause')[0];
  audio.playQueue('chat', [{ id: 'answer', url: '/data/answer.mp3' }]);
  stalePause();
  assert.equal(manager.callbacks('Pause').length, 0);
  assert.equal(audio.snapshot().owner, 'chat');
  assert.equal(audio.snapshot().playing, true);
  assert.equal(fixture.audioContexts.length, 1);
  audio.stop();
});
