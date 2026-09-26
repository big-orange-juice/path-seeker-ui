export function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Demo 音频标记：`demo:` 开头的地址表示本地合成演示音频，不发起网络请求。 */
export const DEMO_AUDIO_PREFIX = 'demo:'

const demoAudioCache = new Map<number, string>()

/**
 * 本地合成一段轻声演示音频，让站点音频在没有真实素材时也能播放、且时长与文稿一致。
 * 只有浏览器环境能创建对象地址；服务端（测试）调用返回 null。
 */
export function createDemoAudio(seconds: number): string | null {
  if (typeof window === 'undefined' || typeof URL.createObjectURL !== 'function') return null
  const total = Math.max(1, Math.min(Math.round(seconds) || 1, 900))
  const cached = demoAudioCache.get(total)
  if (cached) return cached
  const sampleRate = 8000
  const frames = sampleRate * total
  const buffer = new ArrayBuffer(44 + frames)
  const view = new DataView(buffer)
  const writeText = (offset: number, text: string) => { for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index)) }
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + frames, true)
  writeText(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  writeText(36, 'data')
  view.setUint32(40, frames, true)
  for (let frame = 0; frame < frames; frame += 1) {
    const secondsIn = frame / sampleRate
    // 极轻的双音提示，每 6 秒一次起伏，避免长时间播放干扰。
    const pulse = Math.max(0.18, 1 - (secondsIn % 6) / 6)
    const tone = Math.sin(2 * Math.PI * 523.25 * secondsIn) + 0.6 * Math.sin(2 * Math.PI * 783.99 * secondsIn)
    view.setUint8(44 + frame, 128 + Math.round(tone * 3 * pulse))
  }
  const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
  demoAudioCache.set(total, url)
  return url
}

/** 把站点音频地址解析为可播放地址；`demo:` 前缀走本地合成音频。 */
export function resolveAudioUrl(audioUrl: string | null, durationSeconds: number): string | null {
  if (!audioUrl) return null
  return audioUrl.startsWith(DEMO_AUDIO_PREFIX) ? createDemoAudio(durationSeconds) : audioUrl
}

/** 按讲解语速（约每字 0.22 秒）估算生成音频所需时长。 */
export function estimateAudioSeconds(text: string): number {
  const characters = text.replace(/\s+/g, '').length
  return Math.max(12, Math.round(characters / 4.6))
}

/** 播放器时间轴格式：m:ss。 */
export function formatClock(seconds: number): string {
  const value = Math.max(0, Math.round(seconds))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

/** 时长文案格式：3 分 26 秒 / 26 秒。 */
export function formatDurationText(seconds: number): string {
  const value = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(value / 60)
  const rest = value % 60
  return minutes > 0 ? `${minutes} 分 ${rest} 秒` : `${rest} 秒`
}
