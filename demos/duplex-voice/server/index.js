/**
 * Demo 服务端：
 * - 托管 public/ 下的 H5 页面（无构建步骤，浏览器原生 ES Module）
 * - GET  /api/events?session=xxx  SSE 下行（服务端 -> 浏览器）
 * - POST /api/turn                上行一轮对话（文字或整段 WAV 的 base64）
 * - POST /api/barge-in            打断（浏览器 VAD 判定用户开口时立即调用）
 * - POST /api/reset               清空会话历史
 * 密钥只在服务端使用，浏览器永远拿不到供应商 Key。
 */
import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describeConfigStatus, loadConfig } from "./config.js";
import { VoiceSession } from "./orchestrator.js";

const config = loadConfig();
const publicDir = path.join(config.rootDir, "public");
const basePath = config.server.basePath || "";
const sessions = new Map();
const MAX_BODY = 8 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const server = createServer();

function createServer() {
  const handler = (req, res) => {
    handle(req, res).catch((error) => {
      console.error("请求处理失败：", error);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("服务器内部错误");
    });
  };
  if (config.server.https?.enabled) {
    return https.createServer(
      {
        key: readFileSync(path.resolve(config.server.https.keyFile)),
        cert: readFileSync(path.resolve(config.server.https.certFile)),
      },
      handler,
    );
  }
  return http.createServer(handler);
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(url.pathname);

  // 反向代理到子路径时（如 /path-seeker/duplex/），先剥掉前缀
  if (basePath) {
    if (pathname === basePath) {
      res.writeHead(301, { Location: `${basePath}/${url.search}` });
      res.end();
      return;
    }
    if (!pathname.startsWith(`${basePath}/`)) return sendText(res, 404, "页面不存在");
    pathname = pathname.slice(basePath.length) || "/";
  }

  if (pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, uptime: Math.round(process.uptime()), sessions: sessions.size });
  }
  if (pathname === "/api/events") return handleEvents(req, res, url);
  if (pathname.startsWith("/api/")) return handleApi(req, res, pathname);
  return serveStatic(res, pathname);
}

function handleEvents(req, res, url) {
  const id = url.searchParams.get("session") || `s-${Math.random().toString(36).slice(2)}`;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 2000\n\n");

  // 同一 session 只保留最新连接（刷新页面后旧连接自动让位）
  const previous = sessions.get(id);
  if (previous) previous.dispose();

  const sendFrame = (frame) => {
    if (res.writableEnded) return;
    res.write(`event: ${frame.event}\ndata: ${JSON.stringify(frame.data ?? {})}\n\n`);
  };

  const session = new VoiceSession({ id, config, sendFrame });
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": hb\n\n");
  }, 15000);
  session.dispose = () => {
    clearInterval(heartbeat);
    session.abortCurrent({ notify: false, reason: "dispose" });
    if (sessions.get(id) === session) sessions.delete(id);
    if (!res.writableEnded) {
      try {
        res.end();
      } catch {
        // 连接已断开，忽略
      }
    }
  };

  sessions.set(id, session);
  req.on("close", () => {
    clearInterval(heartbeat);
    // 短时间内的重连（比如刷新）沿用同一个 session，避免历史丢失
    setTimeout(() => {
      if (sessions.get(id) === session) session.dispose();
    }, 15000);
  });

  session.hello();
}

async function handleApi(req, res, pathname) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "只支持 POST" });

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 413, { error: error.message });
  }

  const session = sessions.get(String(body.session || ""));
  if (!session) return sendJson(res, 404, { error: "会话不存在或已断开，请刷新页面" });

  if (pathname === "/api/turn") {
    const turnKey = String(body.turnKey || `${Date.now()}`);
    void session.handleTurn({
      turnKey,
      text: body.text || "",
      audioBase64: body.audioBase64 || "",
      heardText: body.heardText || "",
    });
    return sendJson(res, 202, { ok: true, turnKey });
  }
  if (pathname === "/api/barge-in") {
    const interrupted = session.abortCurrent({ reason: "user" });
    return sendJson(res, 200, { ok: true, interrupted });
  }
  if (pathname === "/api/reset") {
    session.reset();
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 404, { error: "接口不存在" });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("请求体过大（超过 8MB），请缩短单次说话时长"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("请求体不是合法 JSON"));
      }
    });
    req.on("error", (error) => reject(error));
  });
}

function sendJson(res, status, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(data);
}

async function serveStatic(res, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(publicDir, relative);
  if (!filePath.startsWith(publicDir)) return sendText(res, 403, "禁止访问");

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch {
    sendText(res, 404, "页面不存在");
  }
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

const protocol = config.server.https?.enabled ? "https" : "http";
server.listen(config.server.port, config.server.host, () => {
  console.log("双工语音 Demo 已启动");
  console.log(describeConfigStatus(config));
  console.log(`监听：${config.server.host}:${config.server.port}${basePath || "/"}`);
  const hostForUrl = config.server.host === "0.0.0.0" || config.server.host === "::" ? "localhost" : config.server.host;
  console.log(`打开：${protocol}://${hostForUrl}:${config.server.port}${basePath}/`);
  if (!config.server.https?.enabled) {
    console.log("提示：手机通过局域网 IP 访问时浏览器会禁用麦克风，需要开 https 或给该域名放行非安全来源。");
  }
});
