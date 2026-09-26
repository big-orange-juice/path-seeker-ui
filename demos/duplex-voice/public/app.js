/**
 * 页面主控：
 * - 上行：麦克风 -> AudioWorklet 帧 -> VAD 切轮 -> 上传整段 WAV（16k）
 * - 下行：SSE 收事件 -> 文本按句渲染 / 音频入播放器排期
 * - 打断：本地 VAD 判定"用户开口"时立刻停播 + 通知服务端 abort，不等服务端往返
 */
import { createPlayer } from "./js/player.js";
import { startMicCapture } from "./js/mic.js";
import { createTurnDetector } from "./js/turn-detector.js";
import { formatMs, hexToBytes, toBase64 } from "./js/audio-utils.js";

const $ = (id) => document.getElementById(id);
const els = {
  conn: $("conn-pill"),
  model: $("model-pill"),
  thread: $("thread"),
  empty: $("empty"),
  toggle: $("toggle"),
  textForm: $("text-form"),
  textInput: $("text-input"),
  hint: $("hint"),
  log: $("log"),
  tape: $("tape"),
  interrupts: $("m-interrupts"),
  asr: $("m-asr"),
  firstText: $("m-first-text"),
  firstAudio: $("m-first-audio"),
};

const PHASE_TEXT = {
  idle: "开始后直接说话；助手说话时也可以开口打断。",
  listening: "在听……说完停顿一下我就回答。",
  thinking: "正在识别、思考……",
  speaking: "正在说话——你现在开口就能打断我。",
};

const sessionId = `s-${(crypto.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/-/g, "")}`;
// 全部接口都用相对路径：页面可以挂在根路径，也可以挂在反向代理的子路径下
const API_BASE = "./";
const state = {
  running: false,
  phase: "idle",
  audio: { format: "mp3", sampleRate: 32000, voiceId: "—" },
  voiceOptions: { speechStartMs: 150, silenceEndMs: 650, preRollMs: 300, postRollMs: 200, maxUtteranceMs: 20000, minRms: 0.012, bargeInRms: 0.03, bargeInHoldMs: 220, noiseFloorMultiplier: 3 },
  currentTurnKey: null,
  turnStartedAt: 0,
  heardParts: [],
  pendingHeardText: "",
  metrics: { interrupts: 0, asr: null, firstText: null, firstAudio: null },
  activeBubble: null, // { turnKey, content, meta, sentences: Map }
  micLevel: 0,
  debug: { lastProgress: null, events: [] },
};

let ctx = null;
let mic = null;
let detector = null;
let player = null;

/* ---------------- 音频初始化 ---------------- */

async function ensureAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
    player = createPlayer({ ctx, onProgress: handleProgress, onNotice: (text) => pushNotice(text, "warn") });
    player.configure(state.audio);
  }
  if (ctx.state !== "running") {
    try {
      await ctx.resume();
    } catch {
      // 忽略，等下一次手势
    }
  }
  await player.unlock();
}

/* ---------------- 网络 ---------------- */

function postJson(path, body) {
  return fetch(`${API_BASE}api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (response) => {
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `HTTP ${response.status}`);
    }
    return response.json();
  });
}

const es = new EventSource(`${API_BASE}api/events?session=${encodeURIComponent(sessionId)}`);
es.addEventListener("open", () => setConn("已连接"));
es.onerror = () => setConn("重连中…");

es.addEventListener("hello", (event) => {
  const data = JSON.parse(event.data);
  state.audio = data.audio || state.audio;
  state.voiceOptions = data.voice || state.voiceOptions;
  player?.configure(state.audio);
  els.model.textContent = `${data.model || "—"} / ${state.audio.voiceId}`;
  logLine(`hello：format=${state.audio.format} sampleRate=${state.audio.sampleRate} mock=${data.mock}`);
});

es.addEventListener("turn.start", (event) => {
  const data = JSON.parse(event.data);
  logLine(`turn.start ${data.turnKey}（${data.source}）`);
});

es.addEventListener("asr.start", () => {
  if (!state.activeBubble) return;
  setBubbleMeta(state.activeBubble, "识别中…");
});

es.addEventListener("asr.result", (event) => {
  const data = JSON.parse(event.data);
  if (data.turnKey !== state.currentTurnKey) return;
  state.metrics.asr = data.ms ?? null;
  updateHud();
  if (state.activeBubble) setBubbleMeta(state.activeBubble, `识别：${data.text || "（空）"}`);
  logLine(`asr.result ${data.ms}ms：${data.text}`);
});

es.addEventListener("user.text", (event) => {
  const data = JSON.parse(event.data);
  if (data.turnKey !== state.currentTurnKey) return;
  appendUserMessage(data.text);
});

es.addEventListener("text.delta", (event) => {
  const data = JSON.parse(event.data);
  if (data.turnKey !== state.currentTurnKey) return;
  if (state.metrics.firstText === null) {
    state.metrics.firstText = performance.now() - state.turnStartedAt;
    updateHud();
  }
  appendSentence(data.turnKey, data.index, data.text);
});

es.addEventListener("audio.chunk", (event) => {
  const data = JSON.parse(event.data);
  if (data.turnKey !== state.currentTurnKey) return;
  if (state.metrics.firstAudio === null && data.hex) {
    state.metrics.firstAudio = performance.now() - state.turnStartedAt;
    updateHud();
  }
  player?.pushChunk({
    index: data.index,
    bytes: hexToBytes(data.hex),
    isFinal: data.isFinal,
    turn: data.turnKey,
  });

  // MiniMax 打开 subtitle 后会随分片下发词级时间戳（毫秒），用它把字幕升级成真实对齐
  const timing = extractWordTimings(data.meta);
  if (timing) {
    wordTimings.set(timingKey(data.turnKey, data.index), timing);
    upgradeSentenceToWords(data.turnKey, data.index);
  }
});

function timingKey(turnKey, index) {
  return `${turnKey}:${index}`;
}

function extractWordTimings(meta) {
  const words = meta?.timestamped_words;
  if (!Array.isArray(words) || !words.length) return null;
  return { text: String(meta.text ?? ""), words };
}

es.addEventListener("interrupted", (event) => {
  const data = JSON.parse(event.data);
  logLine(`interrupted ${data.turnKey}（${data.reason}）`);
  if (data.turnKey === state.currentTurnKey) {
    finishAssistantTurn({ interrupted: true });
    player?.stopAll();
    state.currentTurnKey = null;
    setPhase("listening");
  }
});

es.addEventListener("turn.done", (event) => {
  const data = JSON.parse(event.data);
  logLine(`turn.done 总耗时 ${data.totalMs}ms（ASR ${data.asrMs ?? "—"} / 首字 ${data.firstTextMs ?? "—"} / 首音 ${data.firstAudioMs ?? "—"}）`);
  if (data.turnKey !== state.currentTurnKey) return;
  state.currentTurnKey = null;
  // 正常播完的轮次不需要回填 heardText，避免下一轮把完整回答当成"只听到"的片段
  state.heardParts = [];
  heardIndexes.clear();
  // 注意：turn.done 只代表"音频已全部下发"，可能还在解码/排队/播放，此时不能没收字幕气泡
  debugPush(`turn.done busy=${player?.isBusy()} speaking=${player?.isSpeaking()}`);
  if (!player?.isBusy()) {
    finishAssistantTurn({});
    setPhase("listening");
  }
});

es.addEventListener("error", (event) => {
  if (!event.data) return;
  const data = JSON.parse(event.data);
  if (data.turnKey && state.currentTurnKey && data.turnKey !== state.currentTurnKey) return;
  pushNotice(data.message || "服务端返回错误", "error");
  state.currentTurnKey = null;
  setPhase("listening");
});

es.addEventListener("session.reset", () => {
  els.thread.querySelectorAll(".msg").forEach((node) => node.remove());
  els.empty.hidden = false;
});

/* ---------------- 上行：VAD -> 一轮对话 ---------------- */

function handleMicFrame(frame, rms) {
  state.micLevel = rms;
  if (!detector) return;
  detector.feed(frame, rms, { playbackActive: player?.isSpeaking() ?? false });
}

function handleSpeechStart({ duringPlayback }) {
  if (duringPlayback) triggerBargeIn("vad");
  setPhase("listening");
}

function handleSpeechEnd({ wav, seconds }) {
  if (!state.running) return;
  logLine(`本地收集到 ${seconds.toFixed(2)}s 语音，上传识别`);
  startTurn({
    audioBase64: toBase64(wav),
  });
}

function triggerBargeIn(reason) {
  const turnKey = state.currentTurnKey;
  const wasSpeaking = player?.isSpeaking() ?? false;
  if (!turnKey && !wasSpeaking) return;

  state.metrics.interrupts += 1;
  updateHud();
  state.pendingHeardText = collectHeardText();

  // 顺序很关键：先给气泡打上"被打断"标记，再停播。
  // stopAll() 会同步回调一次 speaking=false，如果先停播，气泡会先被当成"正常播完"收走。
  finishAssistantTurn({ interrupted: wasSpeaking });
  player?.stopAll();
  state.currentTurnKey = null;
  setPhase("listening");
  logLine(`本地打断（${reason}）：立即停播，并通知服务端取消在飞的 LLM/TTS`);

  postJson("barge-in", { session: sessionId, turnKey }).catch(() => {
    // 服务端可能已经结束这一轮，忽略
  });
}

function startTurn({ text = "", audioBase64 = "" }) {
  const turnKey = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  state.currentTurnKey = turnKey;
  state.turnStartedAt = performance.now();
  state.metrics.asr = null;
  state.metrics.firstText = null;
  state.metrics.firstAudio = null;
  state.heardParts = [];
  heardIndexes.clear();
  wordTimings.clear();
  updateHud();

  player?.beginTurn(turnKey);
  beginAssistantTurn(turnKey);
  setPhase("thinking");

  postJson("turn", {
    session: sessionId,
    turnKey,
    text,
    audioBase64,
    heardText: state.pendingHeardText,
  }).catch((error) => {
    pushNotice(`发送失败：${error.message}`, "error");
    state.currentTurnKey = null;
    setPhase("listening");
  });
  state.pendingHeardText = "";
}

/* ---------------- 播放进度 -> 字幕同步 ---------------- */

function handleProgress({ index, progress, playbackMs, speaking }) {
  const bubble = state.activeBubble;
  state.debug.lastProgress = {
    index,
    playbackMs: Math.round(playbackMs ?? -1),
    speaking,
    hasBubble: Boolean(bubble),
    hasEntry: Boolean(bubble && index !== null && bubble.sentences.has(index)),
    hasWords: Boolean(bubble && index !== null && bubble.sentences.get(index)?.words),
    calls: (state.debug.lastProgress?.calls ?? 0) + 1,
  };
  if (bubble) {
    for (const [i, entry] of bubble.sentences) {
      if (i === index) {
        entry.el.classList.add("playing");
        if (entry.words) applyWordProgress(entry, playbackMs, speaking);
        else entry.el.style.setProperty("--p", progress.toFixed(3));
      } else if (entry.el.classList.contains("playing")) {
        entry.el.classList.remove("playing");
        entry.el.classList.add("done");
        if (entry.words) applyWordProgress(entry, Number.MAX_SAFE_INTEGER, false);
        const text = entry.text || entry.el.textContent;
        if (text) rememberHeard(i, text);
      }
    }
    if (index !== null) {
      const entry = bubble.sentences.get(index);
      if (entry) rememberHeard(index, entry.text || entry.el.textContent);
      entry?.el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  if (index !== null && state.phase !== "speaking") setPhase("speaking");

  if (!speaking) {
    // 播放结束才算这一轮真正结束：生成早已完成后半段音频还在响是常态
    if (state.currentTurnKey) return;
    if (bubble) finishAssistantTurn({});
    if (state.phase === "speaking") setPhase("listening");
  }
}

/** 用真实时间戳上色：已读过的词变亮，正在读的词高亮 */
function applyWordProgress(entry, playbackMs, speaking) {
  entry.lastPlaybackMs = playbackMs;
  entry.lastSpeaking = speaking;
  state.debug.wordApplies = (state.debug.wordApplies ?? 0) + 1;
  for (const node of entry.words) {
    const begin = Number(node.dataset.begin || 0);
    const end = Number(node.dataset.end || 0);
    const spoken = playbackMs >= begin;
    node.classList.toggle("spoken", spoken);
    node.classList.toggle("active", Boolean(speaking) && playbackMs >= begin && playbackMs < end);
  }
}

const heardIndexes = new Set();
const wordTimings = new Map();
function rememberHeard(index, text) {
  if (heardIndexes.has(index) || !text) return;
  heardIndexes.add(index);
  state.heardParts.push(text);
}

function collectHeardText() {
  const text = state.heardParts.join("");
  heardIndexes.clear();
  state.heardParts = [];
  return text;
}

/* ---------------- 渲染 ---------------- */

function beginAssistantTurn(turnKey) {
  els.empty.hidden = true;
  const article = document.createElement("article");
  article.className = "msg assistant";
  const content = document.createElement("div");
  content.className = "bubble content";
  const meta = document.createElement("div");
  meta.className = "meta";
  article.append(content, meta);
  els.thread.append(article);
  state.activeBubble = { turnKey, content, meta, sentences: new Map() };
  scrollToEnd();
}

function appendUserMessage(text) {
  els.empty.hidden = true;
  const article = document.createElement("article");
  article.className = "msg user";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  article.append(bubble);
  els.thread.append(article);
  scrollToEnd();
}

function appendSentence(turnKey, index, text) {
  const bubble = state.activeBubble;
  if (!bubble || bubble.turnKey !== turnKey) return;
  const span = document.createElement("span");
  span.className = "sent";
  span.dataset.i = String(index);
  span.textContent = text;
  bubble.content.append(span);
  bubble.sentences.set(index, { el: span, text, words: null, wordCount: 0 });
  upgradeSentenceToWords(turnKey, index);
  scrollToEnd();
}

/**
 * 时间戳只在这种情况可用：subtitle.text 与我们展示的句子完全一致（没被清洗改写过）。
 * MiniMax 是逐帧下发词表的，后面的帧会比前面的长，所以要允许重复升级，不能只做一次。
 */
function upgradeSentenceToWords(turnKey, index) {
  const bubble = state.activeBubble;
  if (!bubble || bubble.turnKey !== turnKey) return;
  const entry = bubble.sentences.get(index);
  const timing = wordTimings.get(timingKey(turnKey, index));
  if (!entry || !timing) return;
  if (timing.text && timing.text !== entry.text) return;
  if (timing.words.length <= entry.wordCount) return;

  entry.el.textContent = "";
  entry.el.classList.add("words");
  entry.wordCount = timing.words.length;
  entry.words = timing.words.map((word) => {
    const node = document.createElement("span");
    node.className = "word";
    node.textContent = word.word ?? "";
    node.dataset.begin = String(word.time_begin ?? 0);
    node.dataset.end = String(word.time_end ?? 0);
    entry.el.append(node);
    return node;
  });
  // 词表可能在播放中途变长并触发重建，重建后要立即把进度补回去
  if (entry.lastPlaybackMs !== undefined) applyWordProgress(entry, entry.lastPlaybackMs, entry.lastSpeaking);
  // 时间戳来得比播放还晚（短回答很常见）：整句已经播完，直接全部点亮
  else if (entry.el.classList.contains("done")) applyWordProgress(entry, Number.MAX_SAFE_INTEGER, false);
}

function finishAssistantTurn({ interrupted = false } = {}) {
  const bubble = state.activeBubble;
  if (!bubble) return;
  state.activeBubble = null;
  if (interrupted) {
    const chip = document.createElement("span");
    chip.className = "chip warn";
    chip.textContent = "⏹ 被打断";
    bubble.meta.append(chip);
    for (const [, entry] of bubble.sentences) {
      entry.el.classList.remove("playing");
      if (entry.words) entry.words.forEach((node) => node.classList.remove("active"));
    }
  }
  debugPush(`finish(${interrupted ? "interrupted" : "normal"})`);
  scrollToEnd();
}

function setBubbleMeta(bubble, text) {
  let line = bubble.meta.querySelector(".asr");
  if (!line) {
    line = document.createElement("span");
    line.className = "asr";
    bubble.meta.prepend(line);
  }
  line.textContent = text;
}

function pushNotice(text, kind = "info") {
  const chip = document.createElement("div");
  chip.className = `notice ${kind}`;
  chip.textContent = text;
  els.thread.append(chip);
  scrollToEnd();
  logLine(`${kind}: ${text}`);
}

function scrollToEnd() {
  els.thread.scrollTop = els.thread.scrollHeight;
}

function setPhase(phase) {
  state.phase = phase;
  document.body.dataset.phase = phase;
  els.hint.textContent = PHASE_TEXT[phase] || "";
}

function setConn(text) {
  els.conn.textContent = text;
  els.conn.classList.toggle("off", text !== "已连接");
}

function updateHud() {
  els.interrupts.textContent = String(state.metrics.interrupts);
  els.asr.textContent = formatMs(state.metrics.asr);
  els.firstText.textContent = formatMs(state.metrics.firstText);
  els.firstAudio.textContent = formatMs(state.metrics.firstAudio);
}

function logLine(text) {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  els.log.textContent = `${time}  ${text}\n${els.log.textContent}`.split("\n").slice(0, 120).join("\n");
}

function debugPush(text) {
  state.debug.events.push(`${text}@${ctx ? ctx.currentTime.toFixed(2) : "-"}`);
  if (state.debug.events.length > 40) state.debug.events.shift();
}

/* ---------------- 交互 ---------------- */

els.toggle.addEventListener("click", async () => {
  if (state.running) {
    stopConversation();
  } else {
    await startConversation();
  }
});

els.textForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.textInput.value.trim();
  if (!text) return;
  if (!state.running) {
    startConversation().then(() => startTurn({ text }));
  } else {
    if (player?.isSpeaking()) triggerBargeIn("text");
    startTurn({ text });
  }
  els.textInput.value = "";
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    triggerBargeIn("esc");
  }
});

document.addEventListener("click", () => {
  // iOS/Safari：任何一次手势都尝试解锁音频
  ensureAudio().catch(() => {});
}, { once: true });

async function startConversation() {
  state.running = true;
  els.toggle.textContent = "结束对话";
  els.empty.hidden = true;
  await ensureAudio();

  try {
    mic = await startMicCapture({
      ctx,
      workletUrl: "worklets/capture.worklet.js",
      frameSize: 512,
      onFrame: handleMicFrame,
    });
    detector = createTurnDetector({
      ctx,
      frameSize: 512,
      options: state.voiceOptions,
      onSpeechStart: handleSpeechStart,
      onSpeechEnd: handleSpeechEnd,
    });
    logLine("麦克风已就绪（AEC 打开），开口即可对话；播放中开口会触发本地打断");
  } catch (error) {
    mic = null;
    detector = null;
    pushNotice(`没有拿到麦克风：${error.message}。已进入文字模式，打字提问同样会流式播放语音。`, "warn");
  }
  setPhase("listening");
}

function stopConversation() {
  state.running = false;
  detector = null;
  mic?.stop();
  mic = null;
  player?.stopAll();
  state.currentTurnKey = null;
  els.toggle.textContent = "开始对话";
  setPhase("idle");
  logLine("已结束对话");
}

/* ---------------- 波形走带 ---------------- */

const tape = els.tape;
const tapeCtx = tape.getContext("2d");
const micHistory = [];
const outHistory = [];
let tapeWidth = 0;

function drawTape() {
  requestAnimationFrame(drawTape);
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = tape.clientWidth || 320;
  const cssHeight = tape.clientHeight || 64;
  if (tape.width !== Math.round(cssWidth * dpr) || tape.height !== Math.round(cssHeight * dpr)) {
    tape.width = Math.round(cssWidth * dpr);
    tape.height = Math.round(cssHeight * dpr);
  }

  const barWidth = 3;
  const gap = 2;
  const slots = Math.max(8, Math.floor(cssWidth / (barWidth + gap)));
  while (micHistory.length < slots) micHistory.push(0);
  while (outHistory.length < slots) outHistory.push(0);
  micHistory.push(state.micLevel * 3.2);
  outHistory.push((player?.getOutputLevel() ?? 0) * 2.6);
  if (micHistory.length > slots) micHistory.splice(0, micHistory.length - slots);
  if (outHistory.length > slots) outHistory.splice(0, outHistory.length - slots);

  tapeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tapeCtx.clearRect(0, 0, cssWidth, cssHeight);

  const styles = getComputedStyle(document.body);
  const userColor = styles.getPropertyValue("--user").trim() || "#6fd6c4";
  const assistantColor = styles.getPropertyValue("--copper").trim() || "#e0a458";

  const lanes = [
    { history: outHistory, color: assistantColor, top: cssHeight * 0.12, height: cssHeight * 0.32 },
    { history: micHistory, color: userColor, top: cssHeight * 0.58, height: cssHeight * 0.32 },
  ];

  for (const lane of lanes) {
    tapeCtx.fillStyle = lane.color;
    for (let i = 0; i < lane.history.length; i += 1) {
      const value = Math.min(1, lane.history[i]);
      const barHeight = Math.max(2, value * lane.height);
      const x = cssWidth - (lane.history.length - i) * (barWidth + gap);
      tapeCtx.globalAlpha = 0.25 + value * 0.75;
      tapeCtx.fillRect(x, lane.top + (lane.height - barHeight) / 2, barWidth, barHeight);
    }
  }
  tapeCtx.globalAlpha = 1;
  tapeCtx.strokeStyle = styles.getPropertyValue("--line").trim() || "#24313a";
  tapeCtx.beginPath();
  tapeCtx.moveTo(0, cssHeight * 0.5);
  tapeCtx.lineTo(cssWidth, cssHeight * 0.5);
  tapeCtx.stroke();
}

drawTape();
setPhase("idle");
updateHud();
logLine(`页面会话 id：${sessionId}`);

// 调试句柄：便于自动化探针和排查（浏览器控制台里可直接读状态）
window.__demo = { state, get player() { return player; }, get ctx() { return ctx; } };
