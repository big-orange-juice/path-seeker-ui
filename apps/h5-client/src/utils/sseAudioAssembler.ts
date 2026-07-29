/**
 * 将 ExhibitChat SSE 的 audio.* 事件按顺序组装为可播放的短句 Blob。
 * 同一短句内的 audio.delta 必须按事件顺序拼接；isFinal 时提交整句。
 */

import { hexToUint8Array } from "@/utils/hexAudio"
import type {
  ExhibitChatAudioDeltaPayload,
  ExhibitChatAudioStartedPayload,
} from "@/types/exhibitChat"

export interface SseAudioAssembler {
  /** 新一轮 / audio.started 时重置缓冲 */
  reset: (meta?: ExhibitChatAudioStartedPayload | null) => void
  /**
   * 追加一帧 audio.delta。
   * 返回 isFinal 且有数据时提交的 Blob；无数据或非终态返回 null。
   */
  pushDelta: (payload: ExhibitChatAudioDeltaPayload | null | undefined) => Blob | null
  /** 当前 mime（默认 audio/mpeg） */
  getMimeType: () => string
}

function resolveMime(format: string | null | undefined) {
  const normalized = String(format || "").trim().toLowerCase()
  if (!normalized || normalized === "mp3" || normalized === "mpeg") {
    return "audio/mpeg"
  }
  if (normalized.startsWith("audio/")) {
    return normalized
  }
  return `audio/${normalized}`
}

export function createSseAudioAssembler(): SseAudioAssembler {
  let mimeType = "audio/mpeg"
  let chunks: Uint8Array[] = []

  function reset(meta?: ExhibitChatAudioStartedPayload | null) {
    chunks = []
    if (meta?.format) {
      mimeType = resolveMime(meta.format)
    }
  }

  function flushSentence(): Blob | null {
    if (!chunks.length) {
      return null
    }

    let total = 0
    for (const part of chunks) {
      total += part.byteLength
    }
    if (total <= 0) {
      chunks = []
      return null
    }

    const merged = new Uint8Array(total)
    let offset = 0
    for (const part of chunks) {
      merged.set(part, offset)
      offset += part.byteLength
    }
    chunks = []

    // 独立 ArrayBuffer，避免 SharedArrayBuffer / 泛型 lib 不兼容
    const copy = new Uint8Array(merged.byteLength)
    copy.set(merged)
    return new Blob([copy], { type: mimeType })
  }

  function pushDelta(payload: ExhibitChatAudioDeltaPayload | null | undefined): Blob | null {
    const hex = String(payload?.audio ?? "").trim()
    if (hex) {
      try {
        const bytes = hexToUint8Array(hex)
        if (bytes.byteLength > 0) {
          chunks.push(bytes)
        }
      } catch {
        // 单帧解码失败不中断整轮；等 isFinal 时若无数据则跳过
      }
    }

    if (payload?.format) {
      mimeType = resolveMime(payload.format)
    }

    if (payload?.isFinal) {
      return flushSentence()
    }
    return null
  }

  return {
    reset,
    pushDelta,
    getMimeType: () => mimeType,
  }
}
