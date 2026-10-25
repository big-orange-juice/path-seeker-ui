const test = require('node:test');
const assert = require('node:assert/strict');
const { wavPcm, base64 } = require('../dist/core/room-pcm');
const { RoomEventCursor } = require('../dist/shared/translation-room');
const { harness, tick } = require('./harness.cjs');

function wav(sampleRate = 16000) {
  const bytes = new ArrayBuffer(52), view = new DataView(bytes);
  const text = (offset, value) => { [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0))); };
  text(0, 'RIFF'); view.setUint32(4, 44, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, 8, true); view.setInt16(44, -32768, true); view.setInt16(46, 32767, true);
  return bytes;
}
test('native WAV extraction preserves signed PCM and base64 used by Alipay sockets', () => {
  const source = wav(), pcm = wavPcm(source);
  assert.equal(new DataView(pcm).getInt16(0, true), -32768);
  assert.equal(new DataView(pcm).getInt16(2, true), 32767);
  assert.equal(base64(pcm), Buffer.from(pcm).toString('base64'));
  assert.throws(() => wavPcm(wav(44100)), /16 kHz/);
  assert.throws(() => wavPcm(source.slice(0, 48)), /不完整/);
});
test('Alipay joins from the next complete segment and excludes stale subscription audio', () => {
  const cursor = new RoomEventCursor();
  cursor.accept({ type: 'subscription.ready', targetLanguage: 'en', subscriptionVersion: 4, payload: { startSequence: 11 } });
  assert.equal(cursor.accept({ type: 'audio.delta', targetLanguage: 'en', subscriptionVersion: 4, sequence: 10 }), false);
  assert.equal(cursor.accept({ type: 'audio.delta', targetLanguage: 'ja', subscriptionVersion: 3, sequence: 12 }), false);
  assert.equal(cursor.accept({ type: 'audio.delta', targetLanguage: 'en', subscriptionVersion: 4, sequence: 11 }), true);
});

function socketHarness() {
  const fixture = harness(), handlers = {}, sent = [];
  for (const name of ['Open', 'Message', 'Close', 'Error']) {
    fixture.my['onSocket' + name] = callback => { handlers[name] = callback; };
    fixture.my['offSocket' + name] = callback => { if (handlers[name] === callback) delete handlers[name]; };
  }
  fixture.my.connectSocket = options => { fixture.socketOptions = options; };
  fixture.my.sendSocketMessage = options => { sent.push(options); options.success({}); };
  fixture.my.closeSocket = () => {};
  fixture.my.getFileSystemManager = () => ({
    readFile(options) { options.success({ data: wav() }); },
    writeFile(options) { fixture.writes.push(options); options.success({}); },
    unlink(options) { fixture.removed.push(options.filePath); options.success({}); }
  });
  return { fixture, handlers, sent, service: fixture.load('services/translation-room') };
}

test('Alipay normal room end preserves queued playback and immediate close stops it', async () => {
  for (const mode of ['normal', 'immediate']) {
    const { fixture, handlers, service } = socketHarness(), errors = [];
    const connection = service.connect({ roomId: '9223372036854775805', isHost: false }, { event() {}, error: error => errors.push(error), disconnected() {} });
    try {
      handlers.Open();
      assert.match(fixture.socketOptions.url, /9223372036854775805\/events$/);
      assert.equal(fixture.socketOptions.protocols[1], 'bearer.access');
      const emit = event => handlers.Message({ data: JSON.stringify(event) });
      emit({ type: 'subscription.ready', targetLanguage: 'en', subscriptionVersion: 2, payload: { startSequence: 11 } });
      emit({ type: 'audio.delta', targetLanguage: 'en', subscriptionVersion: 2, sequence: 10, payload: { audio: 'ffff', isFinal: true } });
      emit({ type: 'audio.delta', targetLanguage: 'en', subscriptionVersion: 2, sequence: 11, payload: { audio: 'aabb', isFinal: true } });
      await tick();
      assert.equal(fixture.writes.length, 1);
      assert.equal(fixture.audioContexts.length, 1);
      emit({ type: 'room.closed', subscriptionVersion: 2, payload: { mode } });
      await tick();
      assert.equal(fixture.audioContexts[0].stopped, mode === 'immediate');
      assert.equal(errors.length, 0);
      connection.close(true);
      assert.equal(fixture.audioContexts[0].stopped, true);
    } finally { connection.close(true); }
  }
});

test('Alipay host shares one socket, uploads PCM in order and releases mic after delayed start', async () => {
  const { fixture, handlers, sent, service } = socketHarness(), errors = [];
  const connection = service.connect({ roomId: '42', isHost: true }, { event() {}, error: error => errors.push(error), disconnected() {} });
  try {
    handlers.Open(); await connection.startRecording();
    assert.equal(JSON.parse(sent[0].data).type, 'input.start');
    fixture.recorder.emit('Start');
    fixture.recorder.emit('Stop', { tempFilePath: '/tmp/first.wav' });
    await tick();
    assert.equal(fixture.recorder.starts.length, 2);
    assert.equal(sent[1].isBuffer, true);
    assert.equal(sent[1].data, Buffer.from(wavPcm(wav())).toString('base64'));
    connection.close(true);
    const before = fixture.recorder.stops;
    fixture.recorder.emit('Start');
    assert.equal(fixture.recorder.stops, before + 1);
    fixture.recorder.emit('Stop', { tempFilePath: '/tmp/last.wav' });
    await tick();
    assert.equal(fixture.load('services/speech').reserveRecorder({}), true);
    assert.equal(errors.length, 0);
  } finally { connection.close(true); }
});
