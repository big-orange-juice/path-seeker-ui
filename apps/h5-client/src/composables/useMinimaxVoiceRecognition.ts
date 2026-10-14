import { computed, shallowRef } from 'vue'
import { transcribeVoiceAudio } from '@/services/voiceTranscription'
import type { VoiceRecognitionController } from './useVoiceHold'

const MAX_RECORDING_SECONDS = 60
const START_TIMEOUT_MS = 15000
const supported = computed(() => typeof window !== 'undefined'
  && window.isSecureContext
  && Boolean(navigator.mediaDevices?.getUserMedia)
  && Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  && typeof AudioWorkletNode !== 'undefined')
const listening = shallowRef(false)
const audioActive = shallowRef(false)
const finalText = shallowRef('')
const interimText = shallowRef('')
const error = shallowRef('')
const errorCode = shallowRef('')
const starting = shallowRef(false)
const uploading = shallowRef(false)
const busy = computed(() => listening.value || starting.value || uploading.value)
const transcript = computed(() => finalText.value.trim())
const events: Array<{ elapsedMs: number; event: string }> = []
let startedAt = 0

interface CaptureSession {
  context: AudioContext
  stream: MediaStream | null
  source: MediaStreamAudioSourceNode | null
  node: AudioWorkletNode | null
  mute: GainNode | null
  samples: Float32Array[]
  sampleCount: number
  stopped: boolean
  controller: AbortController
  completion: Promise<string>
  resolve: (text: string) => void
  startTimer: ReturnType<typeof setTimeout> | undefined
}

let current: CaptureSession | null = null
let completion: Promise<string> = Promise.resolve('')

function trace(event: string) {
  events.push({ elapsedMs: Math.round(performance.now() - startedAt), event })
  if (events.length > 64) events.shift()
}

function releaseAudio(session: CaptureSession) {
  clearTimeout(session.startTimer)
  if (session.node) session.node.port.onmessage = null
  for (const item of [session.source, session.node, session.mute]) {
    try { item?.disconnect() } catch {}
  }
  try { session.node?.port.close() } catch {}
  for (const track of session.stream?.getTracks() || []) track.stop()
  session.source = null
  session.node = null
  session.mute = null
  session.stream = null
  if (session.context.state !== 'closed') void session.context.close().catch(() => undefined)
}

function settle(session: CaptureSession, text: string) {
  session.resolve(text)
  session.samples = []
  releaseAudio(session)
  if (current !== session) return
  current = null
  starting.value = false
  listening.value = false
  audioActive.value = false
  uploading.value = false
}

function fail(session: CaptureSession, code: string, message: string) {
  if (current !== session) return
  trace(code)
  errorCode.value = code
  error.value = message
  settle(session, '')
}

function encodeWav(input: Float32Array, fromRate: number) {
  const sampleRate = 16000
  const sampleCount = Math.round(input.length * sampleRate / fromRate)
  const buffer = new ArrayBuffer(44 + sampleCount * 2)
  const view = new DataView(buffer)
  const write = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
  write(0, 'RIFF')
  view.setUint32(4, buffer.byteLength - 8, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, sampleCount * 2, true)
  for (let index = 0; index < sampleCount; index += 1) {
    // 对目标采样区间求均值，降低从 44.1/48kHz 降采样时的混叠。
    const begin = Math.floor(index * fromRate / sampleRate)
    const end = Math.min(input.length, Math.max(begin + 1, Math.floor((index + 1) * fromRate / sampleRate)))
    let sum = 0
    for (let cursor = begin; cursor < end; cursor += 1) sum += input[cursor] || 0
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - begin)))
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

async function finishUpload(session: CaptureSession) {
  try {
    if (session.sampleCount < session.context.sampleRate * 0.2) {
      fail(session, 'record-too-short', '说话时间太短，请按住麦克风说完整一句。')
      return
    }
    const merged = new Float32Array(session.sampleCount)
    let offset = 0
    for (const chunk of session.samples) { merged.set(chunk, offset); offset += chunk.length }
    const blob = encodeWav(merged, session.context.sampleRate)
    session.samples = []
    trace('upload-start')
    const text = await transcribeVoiceAudio(blob, session.controller.signal)
    // 取消后可以立刻开始新一轮；迟到的旧请求不得覆盖结果或结束新录音。
    if (current !== session) return
    finalText.value = text
    trace('upload-result')
    settle(session, text)
  } catch (caught) {
    if (current !== session) return
    fail(session, 'asr-failed', caught instanceof Error ? caught.message : '语音识别失败，请重试或使用文字输入。')
  }
}

async function initialize(session: CaptureSession, resumed: Promise<void>) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false,
    })
    if (current !== session || session.stopped) {
      for (const track of stream.getTracks()) track.stop()
      return
    }
    session.stream = stream
    await resumed
    if (current !== session || session.stopped) return
    await session.context.audioWorklet.addModule(`${import.meta.env.BASE_URL}worklets/voice-recording.worklet.js`)
    if (current !== session || session.stopped) return
    session.source = session.context.createMediaStreamSource(stream)
    session.node = new AudioWorkletNode(session.context, 'voice-recording', { numberOfInputs: 1, numberOfOutputs: 1 })
    session.mute = session.context.createGain()
    session.mute.gain.value = 0
    session.node.port.onmessage = event => {
      if (current !== session || session.stopped) return
      const chunk = new Float32Array(event.data)
      const remaining = session.context.sampleRate * MAX_RECORDING_SECONDS - session.sampleCount
      if (remaining > 0) {
        const accepted = chunk.slice(0, remaining)
        session.samples.push(accepted)
        session.sampleCount += accepted.length
      }
    }
    session.source.connect(session.node).connect(session.mute).connect(session.context.destination)
    clearTimeout(session.startTimer)
    starting.value = false
    listening.value = true
    audioActive.value = true
    trace('recording')
  } catch (caught) {
    const code = caught instanceof DOMException ? caught.name : 'record-start-failed'
    const message = code === 'NotAllowedError' ? '麦克风权限被拒绝，请允许后重试。'
      : code === 'NotReadableError' ? '麦克风正在被其他应用占用，请关闭通话或录音后重试。'
        : '无法开启录音，请检查麦克风权限并重试。'
    fail(session, code, message)
  }
}

function start() {
  if (!supported.value || busy.value) return false
  finalText.value = ''
  interimText.value = ''
  error.value = ''
  errorCode.value = ''
  events.length = 0
  startedAt = performance.now()
  trace('record-start-request')
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const context = new Ctor({ latencyHint: 'interactive' })
    let resolve!: (text: string) => void
    completion = new Promise<string>(done => { resolve = done })
    const session: CaptureSession = {
      context, stream: null, source: null, node: null, mute: null, samples: [], sampleCount: 0,
      stopped: false, controller: new AbortController(), completion, resolve, startTimer: undefined,
    }
    current = session
    starting.value = true
    // 在按下的用户手势里恢复 AudioContext，避免移动浏览器的自动播放限制。
    const resumed = context.state === 'running' ? Promise.resolve() : context.resume()
    void resumed.catch(() => undefined)
    session.startTimer = setTimeout(() => fail(session, 'record-start-timeout', '录音启动超时，请允许麦克风权限后重试。'), START_TIMEOUT_MS)
    void initialize(session, resumed)
    return true
  } catch {
    if (current) settle(current, '')
    errorCode.value = 'record-start-failed'
    error.value = '无法开启录音，请重试或使用文字输入。'
    return false
  }
}

function stop() {
  const session = current
  if (!session || session.stopped) return completion
  session.stopped = true
  trace('record-stop-request')
  if (starting.value) {
    fail(session, 'record-not-ready', '麦克风还未就绪，请允许权限后重新按住说话。')
    return session.completion
  }
  releaseAudio(session)
  listening.value = false
  audioActive.value = false
  uploading.value = true
  void finishUpload(session)
  return session.completion
}

function abort() {
  const session = current
  if (!session) return
  session.stopped = true
  trace('record-abort-request')
  session.controller.abort()
  finalText.value = ''
  settle(session, '')
}

function diagnostics() {
  return JSON.stringify({ version: 'minimax-voice-20261014', userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    secureContext: typeof window !== 'undefined' && window.isSecureContext, errorCode: errorCode.value, events }, null, 2)
}

// 导航页、悬浮入口和 Chat 页复用同一控制器与同一活动会话。
const controller: VoiceRecognitionController = { supported, busy, listening, finalText, interimText, transcript, error, errorCode, audioActive, diagnostics, start, stop, abort }

export function useMinimaxVoiceRecognition(): VoiceRecognitionController {
  return controller
}
