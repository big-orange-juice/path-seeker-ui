/**
 * MiniMax 适配：
 * - transcribeWav：语音识别（multipart 上传整段 WAV，语言通过请求头传递）
 * - synthesizeSentence：流式语音合成（stream=true，返回 hex 音频分片，status=2 表示本句合成结束）
 */
import { DemoError } from "./errors.js";
import { joinUrl, readSseJson } from "./sse.js";

export async function transcribeWav({ config, wavBuffer, signal }) {
  const url = joinUrl(config.minimax.baseUrl, config.minimax.asrPath);
  const form = new FormData();
  form.append("model", config.minimax.asrModel);
  form.append("file", new Blob([wavBuffer], { type: "audio/wav" }), "utterance.wav");
  form.append("response_format", "json");
  form.append("stream", "false");

  const headers = { Authorization: `Bearer ${config.minimax.apiKey}` };
  if (config.minimax.asrLanguage) headers.language = config.minimax.asrLanguage;

  const response = await fetch(url, { method: "POST", headers, body: form, signal });
  const raw = await response.text();
  if (!response.ok) {
    throw new DemoError("asr_failed", `语音识别返回 ${response.status}：${raw.slice(0, 300)}`);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new DemoError("asr_failed", `语音识别返回了非 JSON 内容：${raw.slice(0, 200)}`);
  }
  if (payload.base_resp && payload.base_resp.status_code !== 0) {
    throw new DemoError("asr_failed", `语音识别失败：${payload.base_resp.status_msg || payload.base_resp.status_code}`);
  }
  return String(payload.text || "").trim();
}

export async function* synthesizeSentence({ config, text, signal }) {
  const url = joinUrl(config.minimax.baseUrl, config.minimax.ttsPath);
  const body = {
    model: config.minimax.ttsModel,
    text,
    stream: true,
    voice_setting: {
      voice_id: config.minimax.voiceId,
      speed: config.minimax.speed,
      vol: config.minimax.vol,
      pitch: config.minimax.pitch,
      ...(config.minimax.emotion ? { emotion: config.minimax.emotion } : {}),
    },
    audio_setting: {
      sample_rate: config.minimax.sampleRate,
      bitrate: config.minimax.bitrate,
      format: config.minimax.format,
      channel: 1,
    },
    stream_options: { exclude_aggregated_audio: true },
  };
  if (config.minimax.subtitle) {
    body.subtitle_enable = true;
    body.subtitle_type = "word_streaming";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.minimax.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new DemoError("tts_failed", `语音合成返回 ${response.status}：${detail.slice(0, 300)}`);
  }

  let sawFinal = false;
  for await (const payload of readSseJson(response.body)) {
    if (payload?.base_resp && payload.base_resp.status_code !== 0) {
      throw new DemoError("tts_failed", `语音合成失败：${payload.base_resp.status_msg || payload.base_resp.status_code}`);
    }
    const data = payload?.data;
    if (!data) continue;

    const hex = typeof data.audio === "string" ? data.audio : "";
    const isFinal = data.status === 2;
    if (isFinal) sawFinal = true;
    // 打开 subtitle 后可能带回时间戳等字段，结构未知，原样透传给前端做兼容
    const rawMeta = data.subtitle ?? payload?.subtitle ?? null;
    if (hex || isFinal || rawMeta) {
      yield { index: -1, hex, isFinal, meta: rawMeta, extra: payload?.extra_info ?? null };
    }
  }

  if (!sawFinal) yield { index: -1, hex: "", isFinal: true, meta: null, extra: null };
}
