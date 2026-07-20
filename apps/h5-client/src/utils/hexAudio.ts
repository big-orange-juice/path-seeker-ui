/** 将 MiniMax T2A 返回的 hex 音频解码为字节。 */

export function hexToUint8Array(hex: string): Uint8Array {
  const normalized = hex.trim().replace(/\s+/g, "")
  if (!normalized) {
    throw new Error("音频数据为空。")
  }
  if (normalized.length % 2 !== 0) {
    throw new Error("音频 hex 长度非法。")
  }
  if (!/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error("音频 hex 含非法字符。")
  }

  const bytes = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16)
  }
  return bytes
}

export function hexToAudioBlob(hex: string, mimeType = "audio/mpeg"): Blob {
  const bytes = hexToUint8Array(hex)
  // 复制到独立 ArrayBuffer，避免 SharedArrayBuffer / 泛型 lib 不兼容
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy], { type: mimeType })
}
