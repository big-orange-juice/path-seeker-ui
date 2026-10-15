const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, userId } = require('./harness.cjs');
function frames(h) {
  const callbacks = new Set();
  h.recorder.onFrameRecorded = callback => callbacks.add(callback);
  h.recorder.offFrameRecorded = callback => callbacks.delete(callback);
  return buffer => [...callbacks].forEach(callback => callback({ frameBuffer: buffer }));
}
function pcm(amplitude, count = 160) {
  const bytes = new Uint8Array(count * 2);
  for (let index = 0; index < count; index++) { const sample = index % 2 ? amplitude : -amplitude; bytes[index * 2] = sample & 255; bytes[index * 2 + 1] = sample >> 8 & 255; }
  return bytes.buffer;
}
test('voice detector ignores silence and brief spikes, then accepts sustained voice', () => {
  const detector = harness().load('services/barge-in').createDetector();
  for (let index = 0; index < 30; index++) assert.equal(detector(pcm(0)), false);
  for (let index = 0; index < 10; index++) assert.equal(detector(pcm(5000)), false);
  assert.equal(detector(pcm(0)), false);
  for (let index = 0; index < 21; index++) assert.equal(detector(pcm(5000)), false);
  assert.equal(detector(pcm(5000)), true);
});
test('monitor stops once on speech, never uploads detection frames and releases recorder ownership', async () => {
  const h = harness(), emit = frames(h), service = h.load('services/barge-in'); let interruptions = 0;
  const monitor = service.monitor(() => interruptions++, error => assert.fail(error.message)); h.recorder.emit('Start');
  for (let index = 0; index < 30; index++) emit(pcm(0));
  for (let index = 0; index < 25; index++) emit(pcm(5000));
  assert.equal(interruptions, 1); assert.equal(h.recorder.stops, 1); assert.equal(h.requests.length, 0);
  const stopping = monitor.stop(); h.recorder.emit('Stop', { tempFilePath: '/detector.pcm' }); await stopping;
  assert.ok(h.removed.includes('/detector.pcm'));
  const recorder = h.load('services/speech').recorder(() => {}, () => {}, () => {}); recorder.start(); assert.equal(h.recorder.starts.length, 2); recorder.destroy(); h.recorder.emit('Error', { error: 7 });
});
test('unsupported realtime frames fail without requesting microphone', () => {
  const h = harness(), bargeIn = h.load('services/barge-in'); let error;
  assert.equal(bargeIn.supported(), false); assert.equal(bargeIn.monitor(() => {}, reason => { error = reason; }), null);
  assert.match(error.message, /按住说话/); assert.equal(h.recorder.starts.length, 0);
});
test('hide before detector native start still stops the microphone and does not upload', async () => {
  const h = harness(); frames(h); const page = h.page('chat'); page.onLoad(); page._visible = true; page._user = userId;
  page.setData({ bargeInEnabled: true }); page.startBargeIn(); page.onHide();
  h.recorder.emit('Start'); assert.equal(h.recorder.stops, 1); h.recorder.emit('Stop', { tempFilePath: '/hidden.pcm' }); await tick();
  assert.equal(h.requests.length, 0); assert.ok(h.removed.includes('/hidden.pcm'));
});
test('manual voice input waits for detector stop and quick release does not start a new microphone', async () => {
  const h = harness(); frames(h); const page = h.page('chat'); page.onLoad(); page._visible = true; page._user = userId;
  page.setData({ bargeInEnabled: true }); page.startBargeIn(); h.recorder.emit('Start');
  const starting = page.startRecording({ touches: [{ clientY: 100 }] }); page.stopRecording(); h.recorder.emit('Stop', { tempFilePath: '/done.pcm' }); await starting;
  assert.equal(h.recorder.starts.length, 1); assert.equal(page.data.recording, false); page.onHide();
});
