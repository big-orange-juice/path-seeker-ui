import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { readSse } from "../public/sse.js";
import { createTranslationPlayer } from "../public/player.js";
import { createDemoServer, resolveUpstreamUrl } from "../server/index.js";

test("upstream URL accepts site and API bases without duplicating the API prefix", () => {
  for (const base of ["https://example.com/path-seeker", "https://example.com/path-seeker/", "https://example.com/path-seeker/api", "https://example.com/path-seeker/api/"]) {
    assert.equal(resolveUpstreamUrl(base, "/api/AppUser/GuestLogin"), "https://example.com/path-seeker/api/AppUser/GuestLogin");
    assert.equal(resolveUpstreamUrl(base, "/api/ExhibitChat/history", "?sessionId=2076894321939976192"), "https://example.com/path-seeker/api/ExhibitChat/history?sessionId=2076894321939976192");
  }
  assert.equal(resolveUpstreamUrl("http://localhost:5000", "/api/AppUser/GuestLogin"), "http://localhost:5000/api/AppUser/GuestLogin");
});

test("SSE handles byte-split UTF-8, CRLF boundaries, comments and multiline data", async () => {
  const content = ': heartbeat\r\nid: 2076894321939976192\r\nevent: text.delta\r\ndata: {"payload":\r\ndata: {"content":"青铜器"}}\r\n\r\nevent: done\ndata: {"payload":{}}\n\n';
  const bytes = new TextEncoder().encode(content);
  const stream = new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } });
  const events = [];
  await readSse(stream, (event) => events.push(event));
  assert.equal(events.length, 2);
  assert.equal(events[0].data.payload.content, "青铜器");
  assert.equal(events[0].id, "2076894321939976192");
  assert.equal(events[1].event, "done");
});

test("SSE error cancels the reader instead of leaving a request open", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('event: error\ndata: {"payload":{"message":"失败"}}\n\n'));
  }, cancel() { cancelled = true; } });
  await assert.rejects(readSse(stream, () => { throw new Error("失败"); }), /失败/);
  assert.equal(cancelled, true);
});

function fakeAudioContext() {
  const decodes = [];
  const played = [];
  return {
    currentTime: 0, destination: {}, decodes, played,
    decodeAudioData(bytes) { return new Promise((resolve) => decodes.push({ bytes: [...new Uint8Array(bytes)], resolve })); },
    createBufferSource() { return { connect() {}, disconnect() {}, stop() {}, start(at) { played.push({ at, buffer: this.buffer }); } }; },
  };
}

test("room audio queue has a configured delay limit and asks for explicit reconnect", async () => {
  const context = fakeAudioContext(), errors = [];
  const player = createTranslationPlayer(context, () => {}, error => errors.push(error));
  player.configure({ maxQueueSeconds: 120 });
  player.push({ audio: 'aabb', isFinal: true });
  await Promise.resolve();
  context.decodes[0].resolve({ duration: 121 });
  await new Promise(setImmediate);
  assert.equal(context.played.length, 0);
  assert.equal(player.busy(), false);
  assert.match(errors[0].message, /积压/);
});

test("MP3 chunks merge until final, play serially and account for queued decoding", async () => {
  const ctx = fakeAudioContext();
  const errors = [];
  const player = createTranslationPlayer(ctx, () => {}, (error) => errors.push(error));
  player.push({ audio: "0102", isFinal: false });
  assert.equal(ctx.decodes.length, 0);
  player.push({ audio: "0304", isFinal: true });
  player.push({ audio: "0506", isFinal: true });
  await Promise.resolve();
  assert.equal(player.busy(), true);
  assert.deepEqual(ctx.decodes[0].bytes, [1, 2, 3, 4]);
  ctx.decodes[0].resolve({ duration: 1 });
  await new Promise(setImmediate);
  assert.equal(ctx.decodes.length, 2);
  ctx.decodes[1].resolve({ duration: 2 });
  await new Promise(setImmediate);
  assert.equal(ctx.played.length, 2);
  assert.ok(ctx.played[1].at >= ctx.played[0].at + 1);
  assert.equal(errors.length, 0);
  player.stop();
});

test("interruption rejects late decode results without disturbing the new turn", async () => {
  const ctx = fakeAudioContext();
  const player = createTranslationPlayer(ctx, () => {}, assert.fail);
  player.push({ audio: "0102", isFinal: true });
  await Promise.resolve();
  player.stop();
  player.push({ audio: "0304", isFinal: true });
  await Promise.resolve();
  ctx.decodes[0].resolve({ duration: 10, old: true });
  await new Promise(setImmediate);
  assert.equal(ctx.played.length, 0);
  assert.equal(player.busy(), true);
  ctx.decodes[1].resolve({ duration: 1 });
  await new Promise(setImmediate);
  assert.equal(ctx.played.length, 1);
  assert.equal(ctx.played[0].buffer.old, undefined);
  player.stop();
  assert.equal(player.busy(), false);
});

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

test("proxy preserves string IDs, authentication, SSE streaming and cancellation", { timeout: 10000 }, async () => {
  const received = [];
  let disconnected;
  const disconnect = new Promise((resolve) => { disconnected = resolve; });
  const upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received.push({ url: request.url, headers: request.headers, body: Buffer.concat(chunks).toString() });
    response.on("close", disconnected);
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.write('event: text.delta\ndata: {"payload":{"content":"Hello"}}\n\n');
  });
  const base = await listen(upstream);
  const demo = createDemoServer({ apiBaseUrl: base, basePath: "/translate" });
  const url = await listen(demo);
  try {
    const headers = { Authorization: "Bearer test-token", "Content-Type": "application/json", "Last-Event-ID": "event-123" };
    const controller = new AbortController();
    const body = { sessionId: "2076894321939976192", clientMessageId: "unique", message: "你好", targetLanguage: "en", enableAudio: true };
    const response = await fetch(`${url}/translate/api/ExhibitChat/translate-with-audio`, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    const reader = response.body.getReader();
    const chunk = await reader.read();
    assert.match(new TextDecoder().decode(chunk.value), /Hello/);
    assert.equal(received[0].headers.authorization, "Bearer test-token");
    assert.equal(received[0].headers["last-event-id"], "event-123");
    assert.deepEqual(JSON.parse(received[0].body), body);
    controller.abort();
    await disconnect;
    assert.equal((await fetch(`${url}/translate/api/ExhibitChat/send-with-audio`, { method: "POST" })).status, 404);
    assert.equal((await fetch(`${url}/translate/config.json`)).status, 404);
    for (const asset of ["", "app.js", "styles.css", "realtime.js", "pcm.js", "mic.js", "capture.worklet.js", "shared/js/mic.js", "shared/js/turn-detector.js", "shared/worklets/capture.worklet.js"]) {
      assert.equal((await fetch(`${url}/translate/${asset}`)).status, 200, asset);
    }
  } finally { await close(demo); await close(upstream); }
});

test("proxy uploads WAV multipart and exposes backend validation failures", { timeout: 10000 }, async () => {
  let uploaded;
  const upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    uploaded = { headers: request.headers, body: Buffer.concat(chunks).toString() };
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ message: "只支持 WAV 语音文件" }));
  });
  const base = await listen(upstream);
  const demo = createDemoServer({ apiBaseUrl: base });
  const url = await listen(demo);
  try {
    const form = new FormData();
    form.append("file", new Blob(["RIFF-test-audio"], { type: "audio/wav" }), "speech.wav");
    const response = await fetch(`${url}/api/ExhibitChat/transcribe`, { method: "POST", headers: { Authorization: "Bearer test" }, body: form });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).message, "只支持 WAV 语音文件");
    assert.match(uploaded.headers["content-type"], /multipart\/form-data; boundary=/);
    assert.match(uploaded.body, /name="file"; filename="speech.wav"/);
    assert.match(uploaded.body, /RIFF-test-audio/);
  } finally { await close(demo); await close(upstream); }
});
