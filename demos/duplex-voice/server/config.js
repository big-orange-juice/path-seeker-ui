/**
 * 配置加载：所有密钥只从本机 config.json 读取，服务端不向浏览器下发密钥。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULTS = {
  server: { port: 5178, host: "0.0.0.0", basePath: "", https: { enabled: false, keyFile: "", certFile: "" } },
  mock: { enabled: false },
  deepseek: {
    apiKey: "",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
    temperature: 0.7,
    maxTokens: 400,
    thinking: false,
    systemPrompt: "你是一个语音助手，回答会被朗读出来。要求：口语化、简洁，每次回答 1-3 句话。",
  },
  minimax: {
    apiKey: "",
    baseUrl: "https://api.minimax.cn",
    ttsPath: "/v1/t2a_v2",
    asrPath: "/v1/speech_to_text",
    ttsModel: "speech-2.8-turbo",
    voiceId: "male-qn-qingse",
    speed: 1,
    vol: 1,
    pitch: 0,
    emotion: "",
    sampleRate: 32000,
    bitrate: 128000,
    format: "mp3",
    subtitle: false,
    asrModel: "asr-1.0",
    asrLanguage: "zh",
  },
  voice: {
    speechStartMs: 150,
    silenceEndMs: 650,
    preRollMs: 300,
    postRollMs: 200,
    maxUtteranceMs: 20000,
    minRms: 0.012,
    bargeInRms: 0.03,
    bargeInHoldMs: 220,
    noiseFloorMultiplier: 3,
  },
};

function merge(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && typeof base[key] === "object") {
      result[key] = merge(base[key], value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export function loadConfig() {
  const configPath = process.env.DEMO_CONFIG ? path.resolve(process.env.DEMO_CONFIG) : path.join(rootDir, "config.json");
  let raw;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`读取配置失败：${configPath}（${error.message}）。请先从 config.example.json 复制一份 config.json。`);
  }

  const config = merge(DEFAULTS, raw);
  // 环境变量兜底，方便临时替换密钥不写进文件，也方便 pm2/systemd 注入
  if (process.env.MINIMAX_API_KEY) config.minimax.apiKey = process.env.MINIMAX_API_KEY;
  if (process.env.DEEPSEEK_API_KEY) config.deepseek.apiKey = process.env.DEEPSEEK_API_KEY;
  if (process.env.DEMO_MOCK === "1") config.mock.enabled = true;
  if (process.env.DEMO_PORT) config.server.port = Number(process.env.DEMO_PORT);
  if (process.env.DEMO_HOST) config.server.host = process.env.DEMO_HOST;
  if (process.env.DEMO_BASE_PATH !== undefined) config.server.basePath = process.env.DEMO_BASE_PATH;

  // basePath 归一化："path-seeker/duplex/" -> "/path-seeker/duplex"（反向代理到子路径时用）
  const rawBase = String(config.server.basePath || "").trim();
  config.server.basePath = rawBase && rawBase !== "/" ? `/${rawBase.replace(/^\/+|\/+$/g, "")}` : "";

  return { ...config, rootDir, configPath };
}

export function describeConfigStatus(config) {
  const lines = [];
  lines.push(`配置：${config.configPath}`);
  lines.push(`MiniMax Key：${config.minimax.apiKey ? "已填写" : "缺失"}`);
  lines.push(`DeepSeek Key：${config.deepseek.apiKey ? "已填写" : "缺失"}`);
  if (config.mock.enabled) lines.push("模式：mock（不调用真实模型，用假音频验证链路）");
  else if (!config.minimax.apiKey || !config.deepseek.apiKey) {
    lines.push("提示：密钥未填全时请把 config.json 里的 mock.enabled 改成 true，可先验证打断与字幕同步链路。");
  }
  return lines.join("\n");
}
