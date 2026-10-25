import http from "node:http";
import https from "node:https";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const allowedPaths = new Set(["/api/AppUser/GuestLogin", "/api/ExhibitChat/sessions", "/api/ExhibitChat/history", "/api/ExhibitChat/transcribe", "/api/ExhibitChat/translate-with-audio"]);
const sharedFiles = new Set(["js/mic.js", "js/turn-detector.js", "js/audio-utils.js", "worklets/capture.worklet.js"]);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

export function resolveUpstreamUrl(apiBaseUrl, pathname, search = "") {
  const base = new URL(apiBaseUrl);
  base.pathname = `${base.pathname.replace(/\/+$/, "").replace(/\/api$/i, "")}${pathname}`;
  base.search = search;
  base.hash = "";
  return base.href;
}

export function createDemoServer(config) {
  const basePath = (config.basePath || "").replace(/\/$/, "");
  const upstreamBase = new URL(config.apiBaseUrl);
  if (!["http:", "https:"].includes(upstreamBase.protocol)) throw new Error("apiBaseUrl 必须使用 HTTP 或 HTTPS");
  const server = http.createServer(async (request, response) => {
    const controller = new AbortController();
    request.on("aborted", () => controller.abort());
    response.on("close", () => { if (!response.writableFinished) controller.abort(); });
    try {
      const url = new URL(request.url, "http://localhost");
      if (basePath && url.pathname === basePath) {
        response.writeHead(308, { Location: `${basePath}/${url.search}` });
        return response.end();
      }
      if (basePath && !url.pathname.startsWith(`${basePath}/`)) {
        response.writeHead(404);
        return response.end();
      }
      const pathname = url.pathname.slice(basePath.length);
      if (pathname.startsWith("/api/")) {
        const roomPath = /^\/api\/TranslationRooms(?:\/(?:host-vehicles|join|\d+(?:\/(?:leave|subscription|end|close))?))?$/.test(pathname);
        const allowedMethod = pathname.endsWith("/history") ? request.method === "GET"
          : pathname.endsWith("/sessions") ? ["GET", "POST"].includes(request.method)
          : roomPath && (/\/host-vehicles$/.test(pathname) || /\/\d+$/.test(pathname)) ? request.method === "GET"
          : request.method === "POST";
        if ((!allowedPaths.has(pathname) && !roomPath) || !allowedMethod) {
          response.writeHead(404);
          return response.end();
        }
        const headers = { Accept: request.headers.accept || "application/json" };
        for (const name of ["authorization", "content-type", "last-event-id"]) {
          if (request.headers[name]) headers[name] = request.headers[name];
        }
        const upstream = await fetch(resolveUpstreamUrl(upstreamBase.href, pathname, url.search), {
          method: request.method, headers, body: request.method === "POST" ? request : undefined,
          duplex: "half", signal: controller.signal, redirect: "error",
        });
        response.writeHead(upstream.status, {
          "Content-Type": upstream.headers.get("content-type") || "application/json",
          "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no",
        });
        response.flushHeaders();
        if (upstream.body) await pipeline(Readable.fromWeb(upstream.body), response);
        else response.end();
        return;
      }
      if (request.method !== "GET") {
        response.writeHead(405);
        return response.end();
      }
      const relative = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
      const shared = relative.startsWith("shared/");
      const filename = shared ? relative.slice(7) : relative;
      if (shared ? !sharedFiles.has(filename) : !["index.html", "styles.css", "app.js", "session.js", "sse.js", "player.js", "realtime.js", "pcm.js", "mic.js", "capture.worklet.js"].includes(filename)) {
        response.writeHead(404);
        return response.end();
      }
      const file = path.join(root, shared ? "../duplex-voice/public" : "public", filename);
      const data = await readFile(file);
      response.writeHead(200, { "Content-Type": mime[path.extname(file)], "Cache-Control": "no-store" });
      response.end(data);
    } catch (error) {
      if (controller.signal.aborted || response.destroyed) return;
      if (!response.headersSent) {
        response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ message: "后端连接失败，请检查 apiBaseUrl 和服务状态。" }));
      } else response.destroy(error);
    }
  });
  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const apiPath = pathname.slice(basePath.length);
    if (!pathname.startsWith(`${basePath}/api/`) || (apiPath !== '/api/ExhibitChat/translate-realtime'
        && !/^\/api\/TranslationRooms\/\d+\/(input|events)$/.test(apiPath))) {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return;
    }
    const target = new URL(resolveUpstreamUrl(upstreamBase.href, apiPath));
    const headers = { host: target.host, connection: "Upgrade", upgrade: "websocket" };
    for (const name of ["sec-websocket-key", "sec-websocket-version", "sec-websocket-protocol", "authorization", "origin"]) {
      if (request.headers[name]) headers[name] = request.headers[name];
    }
    const upstream = (target.protocol === "https:" ? https : http).request(target, { method: "GET", headers });
    const timeout = setTimeout(() => upstream.destroy(new Error("WebSocket handshake timeout")), 15000);
    let tunnel;
    function cleanup() {
      clearTimeout(timeout);
      upstream.destroy();
      tunnel?.destroy();
    }
    socket.on("error", cleanup);
    socket.on("end", cleanup);
    socket.on("close", cleanup);
    upstream.on("upgrade", (response, peer, upstreamHead) => {
      clearTimeout(timeout);
      console.log(`[实时翻译 WebSocket] 握手成功 HTTP 101：${target.origin}${target.pathname}`);
      tunnel = peer;
      if (socket.destroyed) return peer.destroy();
      const responseHeaders = ["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade"];
      for (const name of ["sec-websocket-accept", "sec-websocket-protocol"]) {
        if (response.headers[name]) responseHeaders.push(`${name}: ${response.headers[name]}`);
      }
      socket.write(`${responseHeaders.join("\r\n")}\r\n\r\n`);
      if (upstreamHead.length) socket.write(upstreamHead);
      if (head.length) peer.write(head);
      peer.on("error", () => socket.destroy());
      peer.on("close", () => socket.destroy());
      socket.pipe(peer).pipe(socket);
    });
    upstream.on("response", (response) => {
      clearTimeout(timeout);
      console.error(`[实时翻译 WebSocket] 上游拒绝握手 HTTP ${response.statusCode}：${target.origin}${target.pathname}；请检查 API 入口 Nginx 的 Upgrade、子协议转发及后端鉴权。`);
      socket.end(`HTTP/1.1 ${response.statusCode} ${http.STATUS_CODES[response.statusCode] || "Error"}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      response.resume();
    });
    upstream.on("error", (error) => {
      clearTimeout(timeout);
      console.error(`[实时翻译 WebSocket] 上游连接失败：${target.origin}${target.pathname}；${error.code || "连接错误或握手超时"}`);
      if (!socket.destroyed) socket.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
    });
    upstream.end();
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let local = {};
  try { local = JSON.parse(await readFile(path.join(root, "config.json"), "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const config = {
    host: process.env.TRANSLATION_HOST || local.host || "127.0.0.1",
    port: Number(process.env.TRANSLATION_PORT || local.port || 5179),
    basePath: process.env.TRANSLATION_BASE_PATH ?? local.basePath ?? "",
    apiBaseUrl: process.env.TRANSLATION_API_BASE_URL || local.apiBaseUrl || "http://localhost:5000",
  };
  createDemoServer(config).listen(config.port, config.host, () => {
    console.log(`实时翻译双工 Demo：http://${config.host}:${config.port}${config.basePath}/`);
    console.log(`后端：${config.apiBaseUrl}`);
  });
}
