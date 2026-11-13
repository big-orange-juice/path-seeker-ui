const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { harness } = require('./harness.cjs');

function setup() {
  const fixture = harness(), manager = fixture.my.createInnerAudioContext();
  fixture.my.getBackgroundAudioManager = () => manager;
  Object.defineProperty(manager, 'src', { set() { manager.play(); } });
  fixture.load('app');
  const audio = fixture.load('services/audio'), preference = fixture.load('services/background-listening');
  return { fixture, manager, audio, preference };
}

test('screen-off listening replaces the old action and remembers the selection', () => {
  const { fixture, preference } = setup();
  const page = fixture.page('tour');
  assert.equal(preference.enabled(), true);
  page.toggleScreenOffListening();
  assert.equal(page.data.screenOffListening, false);
  assert.equal(preference.enabled(), false);
  const fresh = harness();
  fresh.storage.set('path-seeker:alipay:v1:screen-off-listening', fixture.storage.get('path-seeker:alipay:v1:screen-off-listening'));
  assert.equal(fresh.load('services/background-listening').enabled(), false);
  page.toggleScreenOffListening();
  assert.equal(page.data.screenOffListening, true);
  const template = fs.readFileSync(path.resolve(__dirname, '../dist/pages/tour/index.axml'), 'utf8');
  assert.match(template, /onTap="toggleScreenOffListening"/);
  assert.doesNotMatch(template, /onTap="returnToNow"/);
});

test('disabled listening pauses on app hide and rejects late Play and resume attempts', () => {
  const { fixture, manager, audio, preference } = setup();
  preference.setEnabled(false);
  audio.playLive('tour', { id: 'session', url: 'https://media.test/live' });
  assert.equal(audio.snapshot().playing, true);
  fixture.app.onHide();
  assert.equal(audio.snapshot().playing, false);
  manager.emit('Play'); audio.resume('tour');
  assert.equal(audio.snapshot().playing, false);
  fixture.app.onShow();
  assert.equal(audio.snapshot().playing, false);
  audio.resume('tour');
  assert.equal(audio.snapshot().playing, true);
  audio.stop();
});

test('enabled listening keeps current playback on app hide', () => {
  const { fixture, audio } = setup();
  audio.playLive('tour', { id: 'session', url: 'https://media.test/live' });
  fixture.app.onHide();
  assert.equal(audio.snapshot().playing, true);
  fixture.app.onShow(); audio.stop();
});

test('late room audio and replacement streams cannot start while hidden with listening disabled', () => {
  const { fixture, audio, preference } = setup();
  preference.setEnabled(false);
  fixture.app.onHide();
  const stream = audio.beginStream('translation-room', {});
  audio.appendStream(stream, { id: 'voice', url: '/data/voice.mp3' });
  assert.equal(audio.snapshot().playing, false);
  assert.equal(audio.snapshot().requested, false);
  audio.playLive('tour', { id: 'late-session', url: 'https://media.test/live' });
  assert.equal(audio.snapshot().playing, false);
  assert.equal(audio.snapshot().requested, false);
  audio.stop();
});
