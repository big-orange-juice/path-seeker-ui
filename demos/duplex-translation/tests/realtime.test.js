import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createRealtimeConnection } from "../public/realtime.js";
import { createPcmEncoder } from "../public/pcm.js";
import { createDemoServer } from "../server/index.js";

class FakeSocket {
  static last;
  constructor(url, protocols) {
    FakeSocket.last = this;
    this.url = url;
    this.protocols = protocols;
    this.readyState = 0;
    this.bufferedAmount = 0;
    this.sent = [];
  }
  send(data) { this.sent.push(data); }
  close() { this.closed = true; this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen(); }
  event(type, payload = {}, sequence = 1) { this.onmessage({ data: JSON.stringify({ type, payload, sequence }) }); }
}
function connection() {
  const events = [];
  const closes = [];
  const start = { sessionId: "2076894321939976192", sourceLanguage: "ja", targetLanguage: "de", enableAudio: true };
  const client = createRealtimeConnection({ url: "ws://localhost/demo/api/ExhibitChat/translate-realtime", token: "Bearer test.jwt.token", start,
    WebSocketClass: FakeSocket, onEvent: (event) => events.push(event), onClose: (event) => closes.push(event) });
  return { client, socket: FakeSocket.last, events, closes, start };
}
const started = { sampleRate: 16000, channels: 1, format: "pcm_s16le" };

test("WebSocket auth uses subprotocols; audio starts only after session.started", async () => {
  const { client, socket, start } = connection();
  assert.deepEqual(socket.protocols, ["translation", "bearer.test.jwt.token"]);
  assert.ok(!socket.url.includes("test.jwt"));
  client.sendPcm(new ArrayBuffer(1600));
  assert.equal(socket.sent.length, 0);
  socket.open();
  assert.deepEqual(JSON.parse(socket.sent[0]), start);
  client.sendPcm(new ArrayBuffer(1600));
  assert.equal(socket.sent.length, 1);
  socket.event("session.started", started);
  await client.ready;
  client.sendPcm(new ArrayBuffer(1600));
  assert.equal(socket.sent[1].byteLength, 1600);
  socket.event("session.done");
  socket.close();
});

test("per-segment completion and errors never stop continuous upload; end drains output", async () => {
  const { client, socket, events } = connection();
  socket.open();
  socket.event("session.started", started);
  await client.ready;
  for (const type of ["transcript.final", "translation.committed", "text.delta", "translation.final", "done", "segment.error", "error", "audio.delta"]) {
    socket.event(type, { text: "hello", sourceFrom: 2, sourceTo: 3 });
    const before = socket.sent.length;
    client.sendPcm(new ArrayBuffer(1600));
    assert.equal(socket.sent.length, before + 1, type);
  }
  client.flush();
  assert.deepEqual(JSON.parse(socket.sent.at(-1)), { type: "input.flush" });
  client.sendPcm(new ArrayBuffer(100));
  client.end();
  assert.deepEqual(JSON.parse(socket.sent.at(-1)), { type: "input.end" });
  const sent = socket.sent.length;
  client.sendPcm(new ArrayBuffer(1600));
  assert.equal(socket.sent.length, sent);
  assert.ok(!socket.closed);
  socket.event("input.ended");
  socket.event("translation.final", { text: "tail" }, 5);
  assert.equal(events.at(-1).payload.text, "tail");
  assert.ok(!socket.closed);
  socket.event("session.done");
  socket.close();
});

test("upload backpressure and invalid PCM fail explicitly instead of losing audio", async () => {
  const { client, socket } = connection();
  socket.open();
  socket.event("session.started", started);
  await client.ready;
  assert.throws(() => client.sendPcm(new ArrayBuffer(65538)), /64 KiB/);
  assert.throws(() => client.sendPcm(new ArrayBuffer(3)), /16bit/);
  socket.bufferedAmount = 256001;
  assert.throws(() => client.sendPcm(new ArrayBuffer(1600)), /积压/);
  client.cancel();
});

test("PCM encoder preserves duration across worklet boundaries at 48k and 44.1k", () => {
  for (const rate of [48000, 44100, 16000]) {
    const packets = [];
    const encoder = createPcmEncoder(rate, (packet) => packets.push(packet));
    const samples = new Float32Array(rate).fill(0.5);
    for (let offset = 0; offset < samples.length; offset += 128) encoder.feed(samples.slice(offset, offset + 128));
    encoder.flush();
    const length = packets.reduce((total, packet) => total + packet.byteLength, 0);
    assert.ok(Math.abs(length - 32000) <= 2, `${rate}: ${length}`);
    assert.ok(packets.every((packet) => packet.byteLength <= 1600 && packet.byteLength % 2 === 0));
    assert.equal(new DataView(packets[0]).getInt16(0, true), 16384);
  }
});

test("PCM encoder flushes tail before input.end and continues after manual flush", () => {
  const packets = [];
  const encoder = createPcmEncoder(16000, (packet) => packets.push(packet));
  encoder.feed(new Float32Array(480).fill(-1));
  assert.equal(packets.length, 0);
  encoder.flush();
  assert.equal(packets[0].byteLength, 960);
  assert.equal(new DataView(packets[0]).getInt16(0, true), -32768);
  encoder.feed(new Float32Array(800).fill(1));
  encoder.flush();
  assert.equal(packets[1].byteLength, 1600);
  assert.equal(new DataView(packets[1]).getInt16(0, true), 32767);
});

test("WebSocket proxy preserves deployment prefix, subprotocol auth and binary traffic", { timeout: 10000 }, async () => {
  let received;
  let peer;
  const backend = http.createServer();
  backend.on("upgrade", (request, socket) => {
    received = { path: request.url, protocols: request.headers["sec-websocket-protocol"] };
    peer = socket;
    socket.on("end", () => socket.destroy());
    const accept = createHash("sha1").update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\nSec-WebSocket-Protocol: translation\r\n\r\n`);
    socket.on("data", (bytes) => socket.write(bytes));
  });
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const demo = createDemoServer({ apiBaseUrl: `http://127.0.0.1:${backend.address().port}/path-seeker/api`, basePath: "/demo" });
  demo.listen(0, "127.0.0.1");
  await once(demo, "listening");
  let client;
  try {
    const request = http.request(`http://127.0.0.1:${demo.address().port}/demo/api/ExhibitChat/translate-realtime`, { headers: {
      Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==", "Sec-WebSocket-Version": "13",
      "Sec-WebSocket-Protocol": "translation, bearer.test-token",
    } });
    request.end();
    const [response, socket] = await once(request, "upgrade");
    client = socket;
    assert.equal(response.headers["sec-websocket-protocol"], "translation");
    assert.equal(received.path, "/path-seeker/api/ExhibitChat/translate-realtime");
    assert.equal(received.protocols, "translation, bearer.test-token");
    const bytes = Buffer.from([0x82, 0x02, 0x01, 0x02]);
    const next = once(socket, "data");
    socket.write(bytes);
    assert.deepEqual((await next)[0], bytes);
    const disconnected = once(peer, "close");
    socket.destroy();
    await disconnected;
  } finally {
    client?.destroy();
    peer?.destroy();
    demo.closeAllConnections();
    backend.closeAllConnections();
    await Promise.all([new Promise((resolve) => demo.close(resolve)), new Promise((resolve) => backend.close(resolve))]);
  }
});
