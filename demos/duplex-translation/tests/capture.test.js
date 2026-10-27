import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { startTranslationMic } from "../public/mic.js";
import { createPcmEncoder } from "../public/pcm.js";

const source = await readFile(new URL("../public/capture.worklet.js", import.meta.url), "utf8");

function processor(rate) {
  let Capture;
  const messages = [];
  runInNewContext(source, {
    sampleRate: rate,
    Float32Array,
    AudioWorkletProcessor: class {
      port = { postMessage: (message, transfer = []) => messages.push(structuredClone(message, { transfer })) };
    },
    registerProcessor: (name, constructor) => { Capture = constructor; },
  });
  return { capture: new Capture(), messages };
}

for (const rate of [16000, 44100, 48000]) {
  test(`worklet aggregates 20ms transferable frames and drains every sample at ${rate}Hz`, () => {
    const { capture, messages } = processor(rate);
    const original = Float32Array.from({ length: rate + 78 }, (_, index) => index / rate);
    for (let offset = 0; offset < original.length; offset += 128) capture.process([[original.slice(offset, offset + 128)]], [[]]);
    assert.equal(messages.length, 50);
    capture.port.onmessage({ data: { type: "stop", flush: true } });
    const stopped = messages.pop();
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.samples, original.length);
    assert.equal(stopped.sequence, messages.length);
    let offset = 0;
    for (const [sequence, message] of messages.entries()) {
      assert.equal(message.sequence, sequence);
      assert.equal(message.startSample, offset);
      assert.deepEqual(message.frame, original.slice(offset, offset + message.frame.length));
      offset += message.frame.length;
    }
    assert.equal(offset, original.length);
    capture.process([[new Float32Array(128)]], [[]]);
    assert.equal(messages.length, stopped.sequence);
  });
}

test("cancel discards the worklet's incomplete frame", () => {
  const { capture, messages } = processor(48000);
  capture.process([[new Float32Array(128)]], [[]]);
  capture.port.onmessage({ data: { type: "stop", flush: false } });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].stopped, true);
  assert.equal(messages[0].samples, 0);
});

function microphone(context, onFrame, onError) {
  const track = new EventTarget();
  track.stop = () => { track.released = true; };
  const { capture, messages } = processor(48000);
  const node = { connect: next => next, disconnect() {}, port: {
    postMessage(data) {
      capture.port.onmessage({ data });
      queueMicrotask(() => {
        for (const message of messages.splice(0)) node.port.onmessage?.({ data: message });
      });
    },
  } };
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) } } });
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioWorkletNode");
  Object.defineProperty(globalThis, "AudioWorkletNode", { configurable: true, value: class { constructor() { return node; } } });
  context.after(() => {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
    if (original) Object.defineProperty(globalThis, "AudioWorkletNode", original);
    else Reflect.deleteProperty(globalThis, "AudioWorkletNode");
  });
  const audio = { sampleRate: 48000, destination: {}, audioWorklet: { addModule: async () => {} },
    createGain: () => ({ gain: {}, disconnect() {}, connect: next => next }),
    createMediaStreamSource: () => ({ connect: next => next, disconnect() {} }),
  };
  return { start: () => startTranslationMic(audio, onFrame, { onError }), capture, node, track };
}

test("normal microphone stop delivers the last worklet frame before resolving", { timeout: 2000 }, async context => {
  const frames = [];
  const fixture = microphone(context, frame => frames.push(frame));
  const capture = await fixture.start();
  fixture.capture.process([[new Float32Array(128).fill(0.5)]], [[]]);
  await capture.stop();
  assert.equal(frames.length, 1);
  assert.equal(frames[0].length, 128);
  assert.equal(capture.getStats().samples, 128);
  assert.equal(fixture.track.released, true);
});

test("microphone requests system playback cancellation only when the track advertises all mode", async context => {
  const fixture = microphone(context, () => {});
  const requests = [];
  fixture.track.getCapabilities = () => ({ echoCancellation: [true, false, "all"] });
  fixture.track.applyConstraints = async constraints => { requests.push(constraints); };
  fixture.track.getSettings = () => ({ echoCancellation: "all", noiseSuppression: true });
  const capture = await fixture.start();
  assert.deepEqual(requests, [{ echoCancellation: { exact: "all" } }]);
  assert.equal(capture.getStats().audioSettings.echoCancellation, "all");
  await capture.stop();
});

test("microphone keeps boolean AEC when stronger cancellation is unsupported or rejected", async context => {
  for (const supported of [false, true]) {
    const fixture = microphone(context, () => {});
    let attempts = 0;
    fixture.track.getCapabilities = () => ({ echoCancellation: supported ? [true, "all"] : [true, false] });
    fixture.track.applyConstraints = async () => { attempts++; throw Error("Unsupported constraint"); };
    fixture.track.getSettings = () => ({ echoCancellation: true });
    const capture = await fixture.start();
    assert.equal(attempts, supported ? 1 : 0);
    assert.equal(capture.getStats().audioSettings.echoCancellation, true);
    await capture.stop();
    assert.equal(fixture.track.released, true);
  }
});

test("cancelling the microphone discards the final frame and releases tracks", { timeout: 2000 }, async context => {
  const frames = [];
  const fixture = microphone(context, frame => frames.push(frame));
  const capture = await fixture.start();
  fixture.capture.process([[new Float32Array(128)]], [[]]);
  await capture.stop({ flush: false });
  assert.equal(frames.length, 0);
  assert.equal(fixture.track.released, true);
});

test("microphone rejects discontinuous frames and reports a revoked track", { timeout: 2000 }, async context => {
  const errors = [];
  const frames = [];
  const fixture = microphone(context, frame => frames.push(frame), error => errors.push(error));
  const capture = await fixture.start();
  fixture.node.port.onmessage({ data: { frame: new Float32Array(960), sequence: 1, startSample: 960 } });
  assert.equal(frames.length, 0);
  assert.match(errors[0].message, /不连续/);
  await capture.stop({ flush: false });
  const revoked = microphone(context, () => {}, error => errors.push(error));
  const next = await revoked.start();
  revoked.track.dispatchEvent(new Event("ended"));
  assert.match(errors[1].message, /中断/);
  await next.stop({ flush: false });
});

test("microphone detects stalled frames without treating a hidden page as proof of failure", { timeout: 2000 }, async context => {
  let now = 0;
  const errors = [];
  context.mock.method(performance, "now", () => now);
  context.mock.timers.enable({ apis: ["setInterval"] });
  const fixture = microphone(context, () => {}, error => errors.push(error));
  const capture = await fixture.start();
  now = 1700;
  context.mock.timers.tick(1750);
  assert.equal(errors.length, 1);
  await capture.stop({ flush: false });
});

function encode(rate, input, block = 128) {
  const packets = [];
  const encoder = createPcmEncoder(rate, packet => packets.push(Buffer.from(packet)));
  for (let offset = 0; offset < input.length; offset += block) encoder.feed(input.subarray(offset, offset + block));
  encoder.flush();
  const result = Buffer.concat(packets);
  return Float64Array.from({ length: result.length / 2 }, (_, index) => result.readInt16LE(index * 2) / 32768);
}

test("FIR resampling suppresses aliasing and preserves speech-band energy at fractional rates", () => {
  for (const rate of [44100, 48000, 96000]) {
    const tone = frequency => Float32Array.from({ length: rate / 5 }, (_, index) => 0.5 * Math.sin(2 * Math.PI * frequency * index / rate));
    const rms = samples => Math.sqrt(samples.slice(160, -160).reduce((total, value) => total + value * value, 0) / (samples.length - 320));
    const low = encode(rate, tone(1000));
    const high = encode(rate, tone(9000));
    assert.ok(Math.abs(low.length - 3200) <= 1);
    assert.ok(Math.abs(rms(low) - Math.sqrt(0.125)) < 0.003);
    assert.ok(20 * Math.log10(rms(high) / rms(low)) < -45, String(rate));
    assert.deepEqual(low, encode(rate, tone(1000), 997));
  }
});

test("16k PCM bypass is exact and repeated flush never duplicates samples", () => {
  const input = Float32Array.from({ length: 1777 }, (_, index) => index % 2 ? -1 : 1);
  const packets = [];
  const encoder = createPcmEncoder(16000, packet => packets.push(Buffer.from(packet)));
  encoder.feed(input);
  encoder.flush();
  encoder.flush();
  const output = Buffer.concat(packets);
  assert.equal(output.length, input.length * 2);
  for (let index = 0; index < input.length; index++) assert.equal(output.readInt16LE(index * 2), input[index] < 0 ? -32768 : 32767);
});
