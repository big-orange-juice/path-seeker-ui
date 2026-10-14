const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick } = require('./harness.cjs');
test('manual WAV multipart preserves every byte and declares file MIME and filename', () => {
  const h = harness(), speech = h.load('services/speech');
  const body = Buffer.from(speech.multipartWav(h.wavBuffer(), 'boundary'));
  const header = Buffer.from('--boundary\r\nContent-Disposition: form-data; name="file"; filename="question.wav"\r\nContent-Type: audio/wav\r\n\r\n');
  assert.deepEqual(body.subarray(0, header.length), header);
  assert.deepEqual(body.subarray(header.length, header.length + h.wav.length), h.wav);
  assert.equal(body.subarray(header.length + h.wav.length).toString(), '\r\n--boundary--\r\n');
  assert.throws(() => speech.multipartWav(new ArrayBuffer(10 * 1024 * 1024 + 1), 'b'), /过大/);
  assert.throws(() => speech.multipartWav(new ArrayBuffer(12), 'b'), /WAV/);
});
test('destroy before delayed recorder start still stops microphone and cleans cancelled temp file', async () => {
  const h = harness(), speech = h.load('services/speech'); let result = false;
  const r = speech.recorder(() => {}, () => result = true, () => {}); r.start(); r.destroy();
  h.recorder.emit('Start'); assert.equal(h.recorder.stops, 1);
  await Promise.all(h.recorder.emit('Stop', { tempFilePath: '/cancelled.audio' }));
  assert.ok(h.removed.includes('/cancelled.audio')); assert.equal(h.requests.length, 0); assert.equal(result, false); assert.equal(h.recorder.callbacks('Start').length, 0);
});
test('quick touch release waits for native start and cancellation never uploads audio', async () => {
  const h = harness(), r = h.load('services/speech').recorder(() => {}, () => {}, () => {});
  r.start(); r.stop(true); assert.equal(h.recorder.stops, 0); h.recorder.emit('Start'); assert.equal(h.recorder.stops, 1);
  await Promise.all(h.recorder.emit('Stop', { tempFilePath: '/quick.audio' })); assert.equal(h.requests.length, 0); assert.ok(h.removed.includes('/quick.audio')); r.destroy();
});
test('idle recorder listeners ignore another owner and recorder rejects overlapping starts', () => {
  const h = harness(), speech = h.load('services/speech'); let idleState = 0, activeState = 0;
  const idle = speech.recorder(() => idleState++, () => {}, () => {}), active = speech.recorder(() => activeState++, () => {}, () => {});
  active.start(); assert.throws(() => idle.start(), /尚未结束/); h.recorder.emit('Start');
  assert.equal(idleState, 0); assert.equal(activeState, 1); assert.equal(h.recorder.stops, 0);
  active.destroy(); h.recorder.emit('Error', { error: 7 }); idle.destroy();
});
test('short/denied native recorder errors are actionable and release ownership', () => {
  const h = harness(), errors = [], r = h.load('services/speech').recorder(() => {}, () => {}, e => errors.push(e));
  r.start(); h.recorder.emit('Error', { error: 7 }); assert.match(errors[0].message, /至少一秒/);
  r.start(); h.recorder.emit('Error', { error: 10 }); assert.equal(errors[1].denied, true); r.destroy();
});
test('successful recording transcribes to text and cleans original file after response', async () => {
  const h = harness(), results = [], states = [], r = h.load('services/speech').recorder((...s) => states.push(s), s => results.push(s), e => { throw e; });
  r.start(); h.recorder.emit('Start'); r.stop(); const stops = h.recorder.emit('Stop', { tempFilePath: '/question.audio' }); await tick();
  assert.match(h.requests[0].options.headers['Content-Type'], /multipart\/form-data/); assert.equal(h.requests[0].options.data.byteLength > h.wav.length, true);
  h.requests[0].ok({ text: '景点的历史是什么？' }); await Promise.all(stops);
  assert.deepEqual(results, ['景点的历史是什么？']); assert.deepEqual(states, [[true, false], [false, true]]); assert.ok(h.removed.includes('/question.audio')); r.destroy();
});
test('page destruction during file read prevents a later transcription upload', async () => {
  const h = harness(); let read;
  h.my.getFileSystemManager = () => ({ readFile(p) { read = p; }, unlink(p) { h.removed.push(p.filePath); p.success({}); } });
  const r = h.load('services/speech').recorder(() => {}, () => assert.fail('closed result'), () => assert.fail('closed error'));
  r.start(); h.recorder.emit('Start'); const stops = h.recorder.emit('Stop', { tempFilePath: '/closed.audio' }); await tick(); r.destroy(); read.success({ data: h.wavBuffer() }); await Promise.all(stops);
  assert.equal(h.requests.length, 0); assert.ok(h.removed.includes('/closed.audio'));
});
