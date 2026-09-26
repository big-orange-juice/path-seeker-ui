/**
 * 供应商自检：用 config.json 里的真实密钥逐项验证链路，不打印任何密钥。
 * 覆盖：DeepSeek 流式首字 / MiniMax 流式合成（当前音色）/ 词级时间戳探测 / 音色归属 / ASR 回环识别。
 * 用法：node scripts/check-providers.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { streamChat } from "../server/deepseek.js";
import { synthesizeSentence, transcribeWav } from "../server/minimax.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(path.join(rootDir, "config.json"), "utf8"));
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}：${detail}`);
}

function joinUrl(baseUrl, pathname) {
  return `${String(baseUrl).replace(/\/+$/, "")}${pathname}`;
}

/* 1. DeepSeek 流式对话 */
async function checkDeepSeek() {
  const startedAt = Date.now();
  let firstChunkAt = null;
  let text = "";
  try {
    for await (const delta of streamChat({
      config,
      messages: [
        { role: "system", content: config.deepseek.systemPrompt },
        { role: "user", content: "用一句话打个招呼" },
      ],
      signal: AbortSignal.timeout(30000),
    })) {
      if (firstChunkAt === null) firstChunkAt = Date.now() - startedAt;
      text += delta;
    }
    record("DeepSeek 流式对话", Boolean(text), `首字 ${firstChunkAt}ms / 共 ${text.length} 字 / 共 ${Date.now() - startedAt}ms`);
    return text;
  } catch (error) {
    record("DeepSeek 流式对话", false, error.message);
    return "";
  }
}

/* 2. MiniMax 流式合成（走服务端同一份代码） */
async function checkTtsStream({ subtitle = false, label = "MiniMax 流式合成" } = {}) {
  const startedAt = Date.now();
  let firstChunkAt = null;
  let bytes = 0;
  const metas = [];
  try {
    for await (const chunk of synthesizeSentence({
      config: { ...config, minimax: { ...config.minimax, subtitle } },
      text: "这是双工语音演示的合成链路自检，如果你能听到这句话，说明音色和密钥配置正确。",
      signal: AbortSignal.timeout(30000),
    })) {
      if (chunk.hex && firstChunkAt === null) firstChunkAt = Date.now() - startedAt;
      bytes += chunk.hex.length / 2;
      if (chunk.meta && metas.length < 3) metas.push(JSON.stringify(chunk.meta).slice(0, 400));
    }
    record(label, bytes > 0, `首包 ${firstChunkAt}ms / ${bytes} 字节 / 格式 ${config.minimax.format}@${config.minimax.sampleRate} / 音色 ${config.minimax.voiceId}`);
    if (subtitle) {
      record("词级时间戳（subtitle）", metas.length > 0, metas.length ? metas.join(" | ") : "未在流式分片里发现时间戳字段");
    }
  } catch (error) {
    record(label, false, error.message);
  }
}

/* 3. 音色归属：确认 voiceId 在当前账号下可见 */
async function checkVoiceOwnership() {
  try {
    const response = await fetch(joinUrl(config.minimax.baseUrl, "/v1/get_voice"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.minimax.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ voice_type: "all" }),
      signal: AbortSignal.timeout(20000),
    });
    const payload = await response.json();
    if (payload.base_resp && payload.base_resp.status_code !== 0) {
      record("音色归属查询", false, `接口返回：${payload.base_resp.status_msg}`);
      return;
    }
    const dump = JSON.stringify(payload);
    const found = dump.includes(config.minimax.voiceId);
    record(
      "音色归属查询",
      found,
      found
        ? `账号下已找到音色 ${config.minimax.voiceId}`
        : `账号列表里没有 ${config.minimax.voiceId}，合成可能报"音色不存在"（若合成项已通过可忽略）`,
    );
  } catch (error) {
    record("音色归属查询", false, `跳过（${error.message}）`);
  }
}

/* 4. ASR 回环：先用非流式合成一段 WAV，再把它丢给识别接口 */
async function checkAsrRoundTrip() {
  let wavBuffer;
  try {
    const response = await fetch(joinUrl(config.minimax.baseUrl, config.minimax.ttsPath), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.minimax.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.minimax.ttsModel,
        text: "你好，这是一段用来验证语音识别接口的测试音频。",
        stream: false,
        output_format: "hex",
        voice_setting: { voice_id: config.minimax.voiceId, speed: 1, vol: 1, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: "wav", channel: 1 },
      }),
      signal: AbortSignal.timeout(40000),
    });
    const payload = await response.json();
    if (!response.ok || (payload.base_resp && payload.base_resp.status_code !== 0)) {
      record("ASR 回环（准备 WAV）", false, `合成 WAV 失败：${JSON.stringify(payload.base_resp || payload).slice(0, 200)}`);
      return;
    }
    wavBuffer = Buffer.from(payload.data.audio, "hex");
    record("ASR 回环（准备 WAV）", wavBuffer.length > 44, `WAV ${wavBuffer.length} 字节`);
  } catch (error) {
    record("ASR 回环（准备 WAV）", false, error.message);
    return;
  }

  const startedAt = Date.now();
  try {
    const text = await transcribeWav({
      config,
      wavBuffer,
      signal: AbortSignal.timeout(60000),
    });
    record("MiniMax 语音识别", Boolean(text), `耗时 ${Date.now() - startedAt}ms / 识别文本：${text || "（空）"}`);
  } catch (error) {
    record("MiniMax 语音识别", false, `${error.message}（若为 404/参数错误，说明该域名下识别接口不可用，需要换 baseUrl 或改用流式识别）`);
  }
}

console.log(`配置文件：${path.join(rootDir, "config.json")}`);
console.log(`MiniMax：${config.minimax.baseUrl} / 合成模型 ${config.minimax.ttsModel} / 音色 ${config.minimax.voiceId}\n`);

await checkDeepSeek();
await checkTtsStream();
await checkTtsStream({ subtitle: true, label: "MiniMax 流式合成（带 subtitle 探测）" });
await checkVoiceOwnership();
await checkAsrRoundTrip();

const failed = results.filter((item) => !item.ok);
console.log(`\n========== 汇总：${results.length - failed.length}/${results.length} 项通过 ==========`);
if (failed.length) {
  for (const item of failed) console.log(`- ${item.name}：${item.detail}`);
  process.exit(1);
}
