/**
 * 句子级流式播放器：用 WebAudio 时钟给 SSE 按句下发的音频排期。
 *
 * 相比「复用同一个 <audio> 元素串行播整句」，这里解决三件事：
 * 1. 句间不留空档：后一句的起点取前一句的结束时间（playhead），不用等 load + play；
 * 2. 严格按句序释放：第 i 句没排期完，绝不放第 i+1 句，避免解码顺序错乱导致串音；
 * 3. 回传「当前播到第几句 + 句内进度」，让语音模式能做字幕跟读。
 *
 * 被打断时只在本机停掉所有声源并清空队列，不等服务端确认。
 */

export type AskSpeechStatus = "idle" | "loading" | "speaking"

export interface AskSpeechProgress {
  /** 正在播放的句子序号；没有在播时为 null */
  index: number | null
  /** 当前句播放进度 0~1 */
  progress: number
}

export interface AskSpeechMeta {
  format?: string | null
  sampleRate?: number | null
}

export interface AskSpeechPlayer {
  /** 同步服务端在 audio.started 里声明的音频格式 */
  configure: (meta: AskSpeechMeta | null | undefined) => void
  /** 新一轮开始：清空上一轮残留 */
  beginRun: () => void
  /** 提交第 index 句；blob 为 null 表示这句没有音频，只推进序号 */
  enqueue: (index: number, blob: Blob | null) => void
  /** 本轮不会再有新句子 */
  finishRun: () => void
  /** 在用户手势里调用，解锁自动播放 */
  unlock: () => void
  stop: () => void
  getStatus: () => AskSpeechStatus
  getError: () => string
  isBusy: () => boolean
  getProgress: () => AskSpeechProgress
  subscribe: (listener: () => void) => () => void
}

/** 提前量：抵消主线程抖动，同时保证后一句紧贴前一句 */
const START_LEAD_SECONDS = 0.06
const IDLE_PROGRESS: AskSpeechProgress = { index: null, progress: 0 }

interface TimelineEntry {
  index: number
  startAt: number
  endAt: number
}

interface SentenceSlot {
  buffer?: AudioBuffer | null
  /** 已解码完（或有结论），可以参与按序释放 */
  settled: boolean
}

function resampleLinear(
  input: Float32Array<ArrayBuffer>,
  fromRate: number,
  toRate: number,
): Float32Array<ArrayBuffer> {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const output = new Float32Array(Math.max(1, Math.floor(input.length / ratio)))
  for (let index = 0; index < output.length; index += 1) {
    const position = index * ratio
    const left = Math.floor(position)
    const right = Math.min(left + 1, input.length - 1)
    output[index] = input[left] * (1 - position + left) + input[right] * (position - left)
  }
  return output
}

export function createAskSpeechPlayer(): AskSpeechPlayer {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let status: AskSpeechStatus = "idle"
  let errorMessage = ""
  let format = "mp3"
  let declaredSampleRate = 32000
  let playhead = 0
  let nextIndex = 0
  /** 播放代次：stop / 新一轮时自增，用于丢弃在途解码结果 */
  let generation = 0
  let progressTimer = 0
  let timeline: TimelineEntry[] = []
  const slots = new Map<number, SentenceSlot>()
  const sources = new Set<AudioBufferSourceNode>()
  const listeners = new Set<() => void>()

  function notify() {
    for (const listener of listeners) {
      try {
        listener()
      } catch {
        // 订阅方抛错不影响播放
      }
    }
  }

  function setStatus(next: AskSpeechStatus) {
    if (status === next) return
    status = next
    notify()
  }

  function setError(message: string) {
    errorMessage = message
    notify()
  }

  function ensureContext() {
    if (!context) {
      const Ctor = window.AudioContext
        || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      context = new Ctor({ latencyHint: "interactive" })
      master = context.createGain()
      master.connect(context.destination)
    }
    return context
  }

  function unlock() {
    const ctx = ensureContext()
    if (ctx && ctx.state !== "running") void ctx.resume().catch(() => undefined)
  }

  function configure(meta: AskSpeechMeta | null | undefined) {
    if (!meta) return
    const next = String(meta.format || "").trim().toLowerCase()
    if (next) format = next
    const rate = Number(meta.sampleRate)
    if (Number.isFinite(rate) && rate > 0) declaredSampleRate = rate
  }

  /** pcm 是 Int16LE 单声道裸流，decodeAudioData 解不了，手动转 */
  function decodePcm(bytes: Uint8Array, ctx: AudioContext) {
    const samples = Math.floor(bytes.byteLength / 2)
    if (!samples) return null
    const view = new DataView(bytes.buffer, bytes.byteOffset, samples * 2)
    const raw = new Float32Array(samples)
    for (let index = 0; index < samples; index += 1) raw[index] = view.getInt16(index * 2, true) / 0x8000
    const resampled = resampleLinear(raw, declaredSampleRate, ctx.sampleRate)
    const buffer = ctx.createBuffer(1, resampled.length, ctx.sampleRate)
    buffer.copyToChannel(resampled, 0)
    return buffer
  }

  async function decodeSentence(blob: Blob, ctx: AudioContext): Promise<AudioBuffer | null> {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (format === "pcm") return decodePcm(bytes, ctx)
    return await ctx.decodeAudioData(bytes.buffer)
  }

  function scheduleBuffer(index: number, buffer: AudioBuffer, ctx: AudioContext) {
    if (!master) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(master)
    source.onended = () => {
      sources.delete(source)
      settleIfIdle()
    }
    const startAt = Math.max(ctx.currentTime + START_LEAD_SECONDS, playhead)
    source.start(startAt)
    sources.add(source)
    playhead = startAt + buffer.duration
    timeline.push({ index, startAt, endAt: playhead })
    setStatus("speaking")
    ensureProgressLoop()
  }

  /** 只释放「下一句」：前一句没排期完成，后面的解码结果先等着 */
  function releaseReady() {
    const ctx = context
    if (!ctx) return
    for (;;) {
      const slot = slots.get(nextIndex)
      if (!slot || !slot.settled) return
      slots.delete(nextIndex)
      if (slot.buffer) scheduleBuffer(nextIndex, slot.buffer, ctx)
      nextIndex += 1
    }
  }

  async function decodeSlot(index: number, slot: SentenceSlot, blob: Blob) {
    const ctx = ensureContext()
    const currentGeneration = generation
    if (!ctx) {
      slot.settled = true
      releaseReady()
      return
    }
    try {
      const buffer = await decodeSentence(blob, ctx)
      if (currentGeneration !== generation) return
      slot.buffer = buffer
    } catch {
      if (currentGeneration !== generation) return
      slot.buffer = null
      setError("部分语音解码失败，已跳过对应片段。")
    }
    slot.settled = true
    releaseReady()
  }

  function enqueue(index: number, blob: Blob | null) {
    const hasAudio = Boolean(blob && blob.size > 0)
    const slot: SentenceSlot = { settled: !hasAudio }
    slots.set(index, slot)
    if (!hasAudio || !blob) {
      releaseReady()
      settleIfIdle()
      return
    }
    if (!ensureContext()) {
      setError("当前浏览器不支持语音播放，可继续阅读文字。")
      slot.settled = true
      releaseReady()
      return
    }
    setStatus("loading")
    void decodeSlot(index, slot, blob)
  }

  function finishRun() {
    releaseReady()
    settleIfIdle()
  }

  function settleIfIdle() {
    if (sources.size || slots.size || timeline.length) return
    setStatus("idle")
    notify()
  }

  function ensureProgressLoop() {
    if (progressTimer) return
    // 用定时器而不是 rAF：后台标签页 rAF 会被节流，但音频还在播
    progressTimer = window.setInterval(tick, 60)
  }

  function stopProgressLoop() {
    if (progressTimer) {
      window.clearInterval(progressTimer)
      progressTimer = 0
    }
  }

  function tick() {
    const ctx = context
    if (!ctx || !timeline.length) {
      stopProgressLoop()
      timeline = []
      notify()
      settleIfIdle()
      return
    }
    timeline = timeline.filter((entry) => entry.endAt > ctx.currentTime - 0.5)
    notify()
  }

  function getProgress(): AskSpeechProgress {
    const ctx = context
    if (!ctx) return IDLE_PROGRESS
    const now = ctx.currentTime
    const active = timeline.find((entry) => entry.startAt <= now && entry.endAt > now)
    if (!active) return IDLE_PROGRESS
    const spans = timeline.filter((entry) => entry.index === active.index)
    const startAt = Math.min(...spans.map((entry) => entry.startAt))
    const endAt = Math.max(...spans.map((entry) => entry.endAt))
    const duration = Math.max(0.001, endAt - startAt)
    return {
      index: active.index,
      progress: Math.min(1, Math.max(0, (now - startAt) / duration)),
    }
  }

  function stop() {
    generation += 1
    stopProgressLoop()
    for (const source of sources) {
      try {
        source.onended = null
        source.stop()
      } catch {
        // 已结束的声源忽略
      }
    }
    sources.clear()
    timeline = []
    slots.clear()
    playhead = 0
    nextIndex = 0
    errorMessage = ""
    setStatus("idle")
    notify()
  }

  function beginRun() {
    stop()
  }

  return {
    configure,
    beginRun,
    enqueue,
    finishRun,
    unlock,
    stop,
    getStatus: () => status,
    getError: () => errorMessage,
    isBusy: () => status === "loading" || status === "speaking",
    getProgress,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** 问一问语音共用单例，避免浮层与全页各自持有播放器 */
let sharedPlayer: AskSpeechPlayer | null = null

export function getSharedAskSpeechPlayer() {
  if (!sharedPlayer) {
    sharedPlayer = createAskSpeechPlayer()
  }
  return sharedPlayer
}
