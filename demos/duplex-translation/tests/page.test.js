import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("page associates semantic commits separately, replaces final text and drains after ending input", { timeout: 10000 }, async () => {
  class Element {
    constructor() { this.value = ""; this.children = []; this.dataset = {}; this.checked = false; this.selectedOptions = [{ textContent: "自动识别" }]; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    remove() {}
    scrollIntoView() {}
    set textContent(value) { this.content = value; this.children = []; }
    get textContent() { return this.content || ""; }
    classList = { add() {} };
  }
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map((match) => [match[1], new Element()]));
  elements.get("museum").value = "610000000000000001";
  elements.get("language").value = "de";
  elements.get("language").selectedOptions = [{ textContent: "德语" }];
  elements.get("source-language").value = "ja";
  elements.get("source-language").selectedOptions = [{ textContent: "日语" }];
  const nodes = [];
  class AudioNode {
    connect(next) { return next; }
    disconnect() {}
    gain = { value: 1 };
  }
  class Worklet extends AudioNode {
    constructor() {
      super();
      nodes.push(this);
      this.port = { postMessage: () => queueMicrotask(() => this.port.onmessage?.({ data: { stopped: true } })) };
    }
  }
  class Socket {
    static last;
    constructor(url, protocols) { Socket.last = this; this.url = url; this.protocols = protocols; this.sent = []; this.readyState = 0; this.bufferedAmount = 0; }
    send(value) { this.sent.push(value); }
    close() { this.closed = true; this.onclose?.(); }
    emit(type, sequence, payload = {}) { this.onmessage({ data: JSON.stringify({ type, sequence, payload }) }); }
  }
  const saved = new Map();
  function stub(name, value) { saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { value, configurable: true, writable: true }); }
  let sessions = 0;
  let mediaStopped = false;
  let stoppedSources = 0;
  const playback = [];
  stub("document", { getElementById: (id) => elements.get(id), createElement: () => new Element() });
  stub("window", { addEventListener() {} });
  stub("location", { href: "http://localhost:5179/demo/", protocol: "http:" });
  stub("navigator", { userAgent: "test", mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() { mediaStopped = true; } }] }) } });
  stub("AudioContext", class {
    sampleRate = 48000;
    currentTime = 0;
    audioWorklet = { addModule: async () => {} };
    async resume() {}
    createGain() { return new AudioNode(); }
    createMediaStreamSource() { return new AudioNode(); }
    async decodeAudioData() { return { duration: 10 }; }
    createBufferSource() {
      const source = new AudioNode();
      source.start = (at) => playback.push({ at, duration: source.buffer.duration });
      source.stop = () => { stoppedSources += 1; };
      return source;
    }
  });
  stub("AudioWorkletNode", Worklet);
  stub("WebSocket", Socket);
  stub("fetch", async (url) => {
    if (url.endsWith("translate-with-audio")) {
      const events = [
        { type: "audio.started", payload: { format: "mp3", sampleRate: 32000 } },
        { type: "audio.delta", payload: { audio: "0102", isFinal: true } },
        { type: "audio.done", payload: {} },
        { type: "done", payload: {} },
      ];
      return new Response(events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
    }
    return { ok: true, json: async () => ({ data: url.endsWith("GuestLogin") ? { accessToken: "test-token" } : { id: `${++sessions}` } }) };
  });
  async function settle() { await new Promise(setImmediate); }
  try {
    await import(`../public/app.js?page-test=${Date.now()}`);
    await settle();
    elements.get("mic").onclick();
    await settle();
    const socket = Socket.last;
    assert.ok(socket);
    assert.equal(nodes.length, 0);
    socket.readyState = 1;
    socket.onopen();
    const start = JSON.parse(socket.sent[0]);
    assert.equal(start.sourceLanguage, "ja");
    assert.equal(start.targetLanguage, "de");
    assert.equal(sessions, 2);
    socket.emit("session.started", undefined, { sampleRate: 16000, channels: 1, format: "pcm_s16le" });
    await settle();
    assert.equal(nodes.length, 1);
    function feed() { nodes[0].port.onmessage({ data: { frame: new Float32Array(4800).fill(0.2) } }); }
    feed();
    socket.emit("transcript.final", 1, { text: "Unfinished" });
    socket.emit("transcript.final", 2, { text: "sentence." });
    socket.emit("translation.committed", 1, { text: "Unfinished sentence.", sourceFrom: 1, sourceTo: 2, reason: "semantic" });
    socket.emit("text.delta", 1, { content: "Draft" });
    socket.emit("translation.final", 1, { text: "Final." });
    socket.emit("done", 1);
    const entry = elements.get("thread").children[0];
    assert.equal(entry.children[1].children[0].children[1].textContent, "Unfinished sentence.");
    assert.equal(entry.children[1].children[1].children[1].textContent, "Final.");
    const before = socket.sent.length;
    feed();
    assert.ok(socket.sent.length > before);
    socket.emit("segment.error", 3, { stage: "asr", message: "skip" });
    assert.equal(socket.closed, undefined);
    elements.get("mic").onclick();
    await settle();
    assert.ok(mediaStopped);
    assert.deepEqual(JSON.parse(socket.sent.at(-1)), { type: "input.end" });
    assert.equal(socket.closed, undefined);
    socket.emit("translation.committed", 2, { text: "Tail.", sourceFrom: 4, sourceTo: 4, reason: "input_end" });
    socket.emit("translation.final", 2, { text: "End." });
    socket.emit("done", 2);
    socket.emit("session.done");
    assert.equal(elements.get("mic").disabled, false);
    assert.equal(elements.get("thread").children.length, 2);
    assert.match(elements.get("metrics").textContent, /完成 2 段/);
    socket.close();
    elements.get("audio").checked = true;
    elements.get("text").value = "First translation";
    elements.get("text-form").onsubmit({ preventDefault() {} });
    await settle();
    assert.equal(playback.length, 1);
    assert.equal(elements.get("send").disabled, false);
    elements.get("text").value = "Second translation";
    elements.get("text-form").onsubmit({ preventDefault() {} });
    await settle();
    assert.equal(playback.length, 2);
    assert.equal(stoppedSources, 0);
    assert.equal(playback[1].at, playback[0].at + playback[0].duration);
    elements.get("mic").onclick();
    await settle();
    assert.equal(stoppedSources, 0);
    Socket.last.readyState = 1;
    Socket.last.onopen();
    Socket.last.emit("session.started", undefined, { sampleRate: 16000, channels: 1, format: "pcm_s16le" });
    await settle();
    Socket.last.emit("audio.started", 1, { format: "mp3", sampleRate: 32000 });
    Socket.last.emit("audio.delta", 1, { audio: "0304", isFinal: true });
    Socket.last.emit("audio.done", 1);
    await settle();
    assert.equal(playback.length, 3);
    assert.equal(playback[2].at, playback[1].at + playback[1].duration);
    assert.equal(stoppedSources, 0);
    elements.get("interrupt").onclick();
    assert.equal(stoppedSources, 3);
    elements.get("cancel").onclick();
    await settle();
  } finally {
    Socket.last?.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
