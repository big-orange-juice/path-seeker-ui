/**
 * 冒烟脚本：不打开浏览器，直接验证服务端链路。
 * 流程：连 SSE -> 发一轮文字对话 -> 收到第一段音频后主动 /api/barge-in -> 校验 interrupted。
 * 用法：node scripts/smoke.mjs   （mock 模式也能跑：DEMO_MOCK=1 node scripts/smoke.mjs）
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let port = Number(process.env.PORT || 0);
let basePath = process.env.DEMO_BASE_PATH ?? "";
try {
  const config = JSON.parse(readFileSync(path.join(rootDir, "config.json"), "utf8"));
  port = port || Number(config.server?.port || 5178);
  if (process.env.DEMO_BASE_PATH === undefined) basePath = config.server?.basePath || "";
} catch {
  port = port || 5178;
}
const BASE = `http://127.0.0.1:${port}${basePath ? (basePath.startsWith("/") ? basePath : `/${basePath}`) : ""}`;
const session = `smoke-${Date.now().toString(36)}`;
console.log(`目标：${BASE}`);

const events = [];
const audioBytes = [];
let interrupted = false;

const response = await fetch(`${BASE}/api/events?session=${session}`);
if (!response.ok) {
  console.error(`SSE 连接失败：HTTP ${response.status}`);
  process.exit(1);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let turnKey = "smoke-1";
let postedAt = 0;
let firstTextAt = null;
let firstAudioAt = null;
let bargeInSent = false;

const reading = (async () => {
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index = buffer.indexOf("\n\n");
    while (index >= 0) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      index = buffer.indexOf("\n\n");
      const eventName = /^event: (.+)$/m.exec(block)?.[1];
      const dataLine = /^data: (.+)$/m.exec(block)?.[1];
      if (!eventName || !dataLine) continue;
      handleEvent(eventName, JSON.parse(dataLine));
    }
  }
})();

function handleEvent(name, data) {
  events.push(name);
  if (name === "text.delta" && firstTextAt === null) {
    firstTextAt = Date.now() - postedAt;
    console.log(`[事件] 首句文本 ${firstTextAt}ms：${data.text}`);
  }
  if (name === "audio.chunk" && data.hex) {
    if (firstAudioAt === null) {
      firstAudioAt = Date.now() - postedAt;
      console.log(`[事件] 首段音频 ${firstAudioAt}ms（${data.hex.length / 2} 字节）`);
    }
    audioBytes.push(data.hex.length / 2);
    if (!bargeInSent && firstAudioAt !== null && Date.now() - postedAt > 900) {
      bargeInSent = true;
      console.log("[动作] 发送 /api/barge-in 模拟用户插话");
      void fetch(`${BASE}/api/barge-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, turnKey }),
      });
    }
  }
  if (name === "interrupted") {
    interrupted = true;
    console.log(`[事件] interrupted（${data.reason}）`);
  }
  if (name === "error") {
    console.log(`[事件] error：${data.message}`);
  }
  if (name === "turn.done") {
    console.log(`[事件] turn.done：总耗时 ${data.totalMs}ms`);
  }
}

await new Promise((resolve) => setTimeout(resolve, 400));
postedAt = Date.now();
turnKey = `smoke-${postedAt}`;
const turnResponse = await fetch(`${BASE}/api/turn`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ session, turnKey, text: "你好，请用一句话介绍这个双工语音 demo，我会在你说话时打断你。" }),
});
console.log(`[动作] POST /api/turn -> ${turnResponse.status}`);

await new Promise((resolve) => setTimeout(resolve, 9000));
await reader.cancel().catch(() => {});
await reading.catch(() => {});

const totalAudio = audioBytes.reduce((sum, size) => sum + size, 0);
console.log("\n========== 冒烟结果 ==========");
console.log(`事件序列：${events.join(" -> ")}`);
console.log(`首句文本延迟：${firstTextAt ?? "—"} ms`);
console.log(`首段音频延迟：${firstAudioAt ?? "—"} ms`);
console.log(`打断是否生效：${interrupted ? "是" : "否（可能音频已播完才触发）"}`);
console.log(`累计音频字节：${totalAudio}`);
process.exit(interrupted && firstTextAt && firstAudioAt ? 0 : 2);
