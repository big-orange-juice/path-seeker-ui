import { startTranslationMic } from "./mic.js";
import { createPcmEncoder } from "./pcm.js";
import { createRealtimeConnection } from "./realtime.js";
import { readSse } from "./sse.js";
import { createTranslationPlayer } from "./player.js";
import { createSessionBootstrap } from "./session.js";

const element = (id) => document.getElementById(id);
let ctx;
let player;
let live = null;
let textTurn = null;
let preparing = false;
let generation = 0;
const logs = [];
const ensureSession = createSessionBootstrap({
  getToken: () => element("token").value,
  setToken: (value) => { element("token").value = value; },
  getSession: () => element("session").value,
  setSession: (value) => { element("session").value = value; },
  getMuseum: () => element("museum").value.trim(),
  request: (endpoint, options) => jsonApi(endpoint, options),
  device: navigator.userAgent || "h5-browser",
});

function notice(message, error = false) {
  element("notice").textContent = message;
  element("notice").dataset.error = String(error);
}
function status() {
  const busy = preparing || Boolean(live) || Boolean(textTurn);
  element("status").textContent = preparing ? "正在准备会话" : live?.ending ? "正在处理剩余语音" : live ? "持续翻译中" : textTurn ? "正在翻译" : player?.busy() ? "正在朗读译文" : "准备就绪";
  element("mic").textContent = live ? "结束讲话" : "开始聆听";
  element("mic").disabled = preparing || Boolean(live?.ending) || Boolean(textTurn);
  element("flush").disabled = !live?.mic || Boolean(live.ending);
  element("cancel").disabled = !busy;
  for (const id of ["source-language", "language", "voice", "audio", "text", "send", "clear", "create", "history"]) element(id).disabled = busy;
}
function log(event, sequence = "") {
  logs.push(`${new Date().toLocaleTimeString()} ${event} ${sequence}`);
  if (logs.length > 120) logs.shift();
  element("log").textContent = logs.join("\n");
}
function credentials() {
  const token = element("token").value.trim().replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("游客登录尚未完成，请重试。");
  return { Authorization: `Bearer ${token}` };
}
async function responseError(response) {
  const text = await response.text();
  try { return JSON.parse(text).message || `请求失败（${response.status}）`; }
  catch { return `请求失败（${response.status}）：${text.slice(0, 180)}`; }
}
async function jsonApi(endpoint, { body, method = "POST", headers = credentials() } = {}) {
  const response = await fetch(endpoint.startsWith("/") ? `.${endpoint}` : `./api/ExhibitChat/${endpoint}`, {
    method, headers: { ...headers, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await responseError(response));
  const result = await response.json();
  if (result.success === false) throw new Error(result.message || "接口请求失败");
  return result.data ?? result;
}
async function audioReady() {
  if (!ctx) {
    ctx = new AudioContext();
    player = createTranslationPlayer(ctx, status, (error) => notice(`音频播放失败：${error.message}，译文仍可阅读。`, true));
  }
  await ctx.resume();
}
function languageName(id) { return element(id).selectedOptions[0].textContent; }
function card(source, title) {
  element("empty")?.remove();
  const root = document.createElement("article");
  root.className = "turn";
  const heading = document.createElement("div");
  heading.className = "turn-head";
  heading.textContent = `${new Date().toLocaleTimeString()} · ${title}`;
  const parallel = document.createElement("div");
  parallel.className = "parallel";
  const texts = ["原文", "译文"].map((title) => {
    const column = document.createElement("div");
    const caption = document.createElement("span");
    caption.className = "caption";
    caption.textContent = title;
    const content = document.createElement("p");
    content.className = "content";
    column.append(caption, content);
    parallel.append(column);
    return content;
  });
  texts[0].textContent = source;
  texts[1].classList.add("translated");
  const note = document.createElement("div");
  note.className = "turn-note";
  root.append(heading, parallel, note);
  element("thread").append(root);
  root.scrollIntoView({ block: "nearest" });
  return { root, source: texts[0], translation: texts[1], note };
}
function metrics(run) {
  element("metrics").textContent = `识别 ${run.transcripts.size} 段 · 提交 ${run.segments.size} 段 · 完成 ${run.completed.size} 段 · 错误 ${run.errors} 段`;
}
function segment(run, sequence) {
  if (!run.segments.has(sequence)) run.segments.set(sequence, card("等待已提交原文…", `翻译段 ${sequence} · ${run.language}`));
  return run.segments.get(sequence);
}
function markIncomplete(run, message) {
  for (const [sequence, entry] of run.segments) {
    if (!run.completed.has(sequence)) entry.note.textContent = message;
  }
}
function audioEvent(type, payload) {
  if (type === "audio.started") player.configure(payload);
  if (type === "audio.delta") player.push(payload);
  if (type === "audio.done") player.flush();
  if (type === "audio.error") {
    player.discardPending();
    notice(`${payload.message || "本段语音合成失败"}，译文仍可阅读。`, true);
  }
}
function eventReceived(run, event) {
  if (live !== run) return;
  const { type, sequence, payload = {} } = event;
  log(type, sequence);
  if (type === "session.started") {
    element("mic-state").textContent = "持续上传语音";
    notice("持续说话即可，译文会按完整语义依次返回。播放译文时继续录音，建议佩戴耳机。");
  } else if (type === "transcript.final") {
    run.transcripts.set(sequence, payload.text || "");
    element("transcripts").textContent = [...run.transcripts.entries()].slice(-12).map(([index, text]) => `识别段 ${index}：${text}`).join("\n");
    element("transcript-panel").hidden = false;
  } else if (type === "translation.committed") {
    const entry = segment(run, sequence);
    entry.source.textContent = payload.text || "";
    const reason = { semantic: "语义完整", max_wait: "达到等待上限", input_end: "结束输入", asr_gap: "识别间隔" }[payload.reason] || payload.reason;
    entry.note.textContent = `来自识别段 ${payload.sourceFrom}～${payload.sourceTo} · ${reason} · 正在翻译`;
  } else if (type === "text.delta") segment(run, sequence).translation.textContent += payload.content || "";
  else if (type === "translation.final") segment(run, sequence).translation.textContent = payload.text || "";
  else if (type.startsWith("audio.") && run.enableAudio) {
    try { audioEvent(type, payload); }
    catch (error) { player.discardPending(); notice(`本段音频异常：${error.message}`, true); }
    if (type === "audio.error") segment(run, sequence).audioError = payload.message || "语音合成失败";
  } else if (type === "done") {
    const entry = segment(run, sequence);
    entry.note.textContent = entry.audioError ? `翻译完成 · ${entry.audioError}` : "翻译完成";
    run.completed.add(sequence);
  } else if (type === "error") {
    run.errors += 1;
    segment(run, sequence).note.textContent = payload.message || "本段翻译失败，后续继续";
    player?.discardPending();
    notice(payload.message || "本段翻译失败，后续继续处理。", true);
  } else if (type === "segment.error") {
    run.errors += 1;
    notice(`识别段 ${sequence}：${payload.message || "识别失败，本段已跳过"}`, true);
    element("transcript-panel").hidden = false;
    element("transcripts").textContent += `\n识别段 ${sequence}：识别失败，已跳过`;
  } else if (type === "input.ended") {
    run.ending = true;
    void stopCapture(run);
    notice("已结束输入，正在处理剩余识别与翻译，请稍候…");
  } else if (type === "session.done" || type === "session.error") {
    void stopCapture(run);
    live = null;
    if (type === "session.done") {
      if (run.enableAudio) player.flush();
      notice(run.errors ? `处理结束，共有 ${run.errors} 段失败，请检查记录。` : "全部语音已处理完成，剩余译文音频将继续播放。", Boolean(run.errors));
    } else {
      markIncomplete(run, "会话异常结束，本段可能未完成");
      player?.discardPending();
      notice(payload.message || "实时会话发生错误，请重新开始。", true);
    }
  }
  metrics(run);
  status();
}
async function stopCapture(run) {
  if (run.stopping) return run.stopping;
  run.stopping = (async () => {
    await run.mic?.stop({ flush: live === run && run.ending });
    run.mic = null;
    if (!live || live === run) {
      element("level").value = 0;
      element("mic-state").textContent = "麦克风未开启";
    }
  })();
  return run.stopping;
}
async function finishInput() {
  const run = live;
  if (!run || run.ending) return;
  run.ending = true;
  status();
  try {
    await stopCapture(run);
    if (live !== run) return;
    run.encoder.flush();
    run.connection.end();
    notice("录音已停止，正在等待剩余译文。请勿关闭页面。");
  } catch (error) { cancelAll(); notice(error.message, true); }
}
function cancelAll() {
  generation += 1;
  preparing = false;
  const run = live;
  live = null;
  if (run) {
    run.connection?.cancel();
    void stopCapture(run);
    markIncomplete(run, "已取消，译文可能不完整");
  }
  textTurn?.controller.abort();
  textTurn = null;
  player?.stop();
  status();
}
async function startLive() {
  if (preparing || textTurn) return;
  if (live) return finishInput();
  preparing = true;
  const version = ++generation;
  status();
  let run;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("浏览器无法使用麦克风，请使用 HTTPS 或 localhost。");
    await audioReady();
    player.configure({ format: "mp3", sampleRate: 32000 });
    await ensureSession();
    if (version !== generation) return;
    element("session").value = "";
    await ensureSession();
    if (version !== generation) return;
    const start = { sessionId: element("session").value, targetLanguage: element("language").value, enableAudio: element("audio").checked };
    if (element("source-language").value) start.sourceLanguage = element("source-language").value;
    if (element("voice").value.trim()) start.voiceId = element("voice").value.trim();
    run = { segments: new Map(), transcripts: new Map(), completed: new Set(), errors: 0, language: `${languageName("source-language")} → ${languageName("language")}`, enableAudio: start.enableAudio };
    live = run;
    element("transcripts").textContent = "";
    element("transcript-panel").hidden = true;
    const url = new URL("./api/ExhibitChat/translate-realtime", location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    run.connection = createRealtimeConnection({ url: url.href, token: element("token").value, start,
      onEvent: (event) => eventReceived(run, event),
      onClose: () => {
        if (live !== run) return;
        void stopCapture(run);
        live = null;
        markIncomplete(run, "连接断开，本段可能未完成");
        player?.discardPending();
        notice("连接意外断开，尚未翻译的音频无法自动恢复，请重新开始。", true);
        status();
      },
    });
    await run.connection.ready;
    if (live !== run) return;
    run.encoder = createPcmEncoder(ctx.sampleRate, (buffer) => run.connection.sendPcm(buffer));
    const capture = await startTranslationMic(ctx, (frame) => {
      if (live !== run) return;
      let energy = 0;
      for (const sample of frame) energy += sample * sample;
      element("level").value = Math.sqrt(energy / frame.length);
      try { run.encoder.feed(frame); }
      catch (error) { cancelAll(); notice(error.message, true); }
    }, { onError: (error) => { if (live === run) { cancelAll(); notice(error.message, true); } } });
    if (live !== run || run.ending) { await capture.stop({ flush: false }); return; }
    run.mic = capture;
    metrics(run);
  } catch (error) {
    if (version === generation) { cancelAll(); notice(error.message, true); }
  } finally { if (version === generation) preparing = false; status(); }
}
async function submitText(text) {
  if (preparing || live || textTurn) return;
  if (!text || text.length > 2000) return notice("原文须为 1～2000 个字符。", true);
  preparing = true;
  const version = ++generation;
  status();
  let turn;
  try {
    await audioReady();
    player.configure({ format: "mp3", sampleRate: 32000 });
    await ensureSession();
    if (version !== generation) return;
    turn = { controller: new AbortController(), entry: card(text, `文字翻译 → ${languageName("language")}`) };
    textTurn = turn;
    const response = await fetch("./api/ExhibitChat/translate-with-audio", {
      method: "POST", headers: { ...credentials(), "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ sessionId: element("session").value, clientMessageId: crypto.randomUUID(), message: text,
        targetLanguage: element("language").value, enableAudio: element("audio").checked, voiceId: element("voice").value.trim() || undefined }),
      signal: turn.controller.signal,
    });
    if (!response.ok) throw new Error(await responseError(response));
    if (!response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("接口未返回 SSE 流，请检查后端地址和登录状态。");
    let done = false;
    await readSse(response.body, ({ event, data }) => {
      if (textTurn !== turn) return;
      const type = data.type || event;
      const payload = data.payload || {};
      log(type);
      if (type === "text.delta") turn.entry.translation.textContent += payload.content || "";
      if (type.startsWith("audio.") && element("audio").checked) audioEvent(type, payload);
      if (type === "error") throw new Error(payload.message || "翻译失败");
      if (type === "done") { done = true; player.flush(); turn.entry.note.textContent = "翻译完成"; }
    });
    if (!done && textTurn === turn) throw new Error("连接提前断开，译文可能不完整。");
  } catch (error) {
    if (version === generation && error.name !== "AbortError") {
      player?.discardPending();
      if (turn) turn.entry.note.textContent = error.message;
      notice(error.message, true);
    }
  } finally { if (version === generation) { textTurn = null; preparing = false; } status(); }
}
element("mic").onclick = () => void startLive();
element("flush").onclick = () => {
  try { live?.encoder.flush(); live?.connection.flush(); notice("已提交当前音频尾段，继续聆听；未完成的语义仍由服务端等待。"); }
  catch (error) { cancelAll(); notice(error.message, true); }
};
element("cancel").onclick = () => { cancelAll(); notice("已取消当前连接，未完成音频不会继续处理。"); };
element("interrupt").onclick = () => { player?.stop(); notice("已停止本地排队的译文朗读，后续新音频仍会播放；录音与翻译继续。"); };
element("text-form").onsubmit = (event) => { event.preventDefault(); void submitText(element("text").value.trim()); };
element("clear").onclick = () => { element("thread").replaceChildren(); element("transcripts").textContent = ""; element("transcript-panel").hidden = true; notice("已清空本页记录，服务端历史仍保留。"); };
for (const id of ["token", "session"]) element(id).oninput = cancelAll;
element("create").onclick = async () => {
  if (live || preparing || textTurn) return;
  try { element("session").value = ""; await ensureSession(); notice("已新建翻译会话。"); }
  catch (error) { notice(error.message, true); }
};
element("history").onclick = async () => {
  if (live || preparing || textTurn) return;
  preparing = true;
  status();
  try {
    await ensureSession();
    const result = await jsonApi(`history?sessionId=${encodeURIComponent(element("session").value)}`, { method: "GET" });
    if (!Array.isArray(result)) throw new Error("会话历史格式不正确。");
    element("thread").replaceChildren();
    for (const message of result) {
      const entry = card(message.role === "user" ? message.content || "" : "—", "会话历史");
      if (message.role === "assistant") entry.translation.textContent = message.content || "";
      entry.note.textContent = "历史音频不回放";
    }
    notice(`已读取 ${result.length} 条历史消息。`);
  } catch (error) { notice(error.message, true); }
  finally { preparing = false; status(); }
};
window.addEventListener("pagehide", () => { cancelAll(); void ctx?.close(); });
status();
void ensureSession().then(() => { if (!preparing && !live) notice("会话已就绪，选择讲话语言和目标语言后开始聆听。"); })
  .catch((error) => { if (!preparing && !live) notice(`会话准备失败：${error.message}，点击开始聆听或翻译可重试。`, true); });
