/**
 * MiniMax 同步语音合成（T2A HTTP）
 * 文档：https://platform.minimaxi.com/docs/api-reference/speech-t2a-http
 *
 * 注意：当前为前端直连（VITE_MINIMAX_API_KEY 会打进包），仅适合内测。
 * 生产应改为服务端代理，勿把 Key 暴露给浏览器。
 */

import { hexToAudioBlob } from "@/utils/hexAudio"

export interface MiniMaxTtsOptions {
  text: string
  signal?: AbortSignal
  voiceId?: string
  model?: string
  speed?: number
}

interface MiniMaxT2aResponse {
  data?: {
    audio?: string | null
    status?: number
  } | null
  base_resp?: {
    status_code?: number
    status_msg?: string | null
  } | null
  trace_id?: string | null
}

const DEFAULT_MODEL = "speech-2.8-turbo"
const DEFAULT_VOICE = "male-qn-qingse"

function resolveApiKey() {
  return String(import.meta.env.VITE_MINIMAX_API_KEY || "").trim()
}

/**
 * 开发默认走同源代理 `/minimax-tts`，避免浏览器 CORS。
 * 若配置了完整 `VITE_MINIMAX_TTS_BASE_URL` 则直连该地址。
 */
export function resolveMiniMaxTtsUrl() {
  const base = String(import.meta.env.VITE_MINIMAX_TTS_BASE_URL || "").trim().replace(/\/$/, "")
  if (base) {
    return `${base}/v1/t2a_v2`
  }
  // Vite dev proxy（见 vite.config.ts）；生产构建若无反代需配置 base URL 或后端代理
  return "/minimax-tts/v1/t2a_v2"
}

export function getDefaultTtsVoiceId() {
  return String(import.meta.env.VITE_MINIMAX_TTS_VOICE_ID || "").trim() || DEFAULT_VOICE
}

/**
 * 解析最终发给 MiniMax 的 voice_id：
 * 显式传入 > 调用方已解析的用户偏好 > env / 内置兜底。
 */
export function resolveTtsVoiceId(preferred?: string | null) {
  const explicit = String(preferred ?? "").trim()
  if (explicit) {
    return explicit
  }
  return getDefaultTtsVoiceId()
}

export function getDefaultTtsModel() {
  return String(import.meta.env.VITE_MINIMAX_TTS_MODEL || "").trim() || DEFAULT_MODEL
}

export function isMiniMaxTtsConfigured() {
  return Boolean(resolveApiKey())
}

export async function synthesizeSpeech(options: MiniMaxTtsOptions): Promise<Blob> {
  const text = String(options.text || "").trim()
  if (!text) {
    throw new Error("朗读文本为空。")
  }

  const apiKey = resolveApiKey()
  if (!apiKey) {
    throw new Error("未配置 VITE_MINIMAX_API_KEY，无法朗读。")
  }

  const model = options.model || getDefaultTtsModel()
  const voiceId = resolveTtsVoiceId(options.voiceId)
  const speed = typeof options.speed === "number" && Number.isFinite(options.speed) ? options.speed : 1

  const response = await fetch(resolveMiniMaxTtsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      text,
      stream: false,
      output_format: "hex",
      language_boost: "Chinese",
      voice_setting: {
        voice_id: voiceId,
        speed,
        vol: 1,
        pitch: 0,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: "mp3",
        channel: 1,
      },
    }),
    signal: options.signal,
  })

  if (!response.ok) {
    let detail = `语音合成失败（${response.status}）`
    try {
      const payload = (await response.json()) as MiniMaxT2aResponse
      const msg = payload.base_resp?.status_msg
      if (msg) {
        detail = msg
      }
    } catch {
      // ignore
    }
    throw new Error(detail)
  }

  const payload = (await response.json()) as MiniMaxT2aResponse
  const code = payload.base_resp?.status_code
  if (typeof code === "number" && code !== 0) {
    throw new Error(payload.base_resp?.status_msg || `语音合成失败（${code}）`)
  }

  const audioHex = String(payload.data?.audio || "").trim()
  if (!audioHex) {
    throw new Error("语音合成未返回音频。")
  }

  return hexToAudioBlob(audioHex, "audio/mpeg")
}
