import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue"

/** 只声明用到的部分，避免依赖 lib.dom 是否包含 Web Speech API */
interface RecognitionAlternative {
  transcript: string
}

interface RecognitionResult {
  isFinal: boolean
  length: number
  [index: number]: RecognitionAlternative
}

interface RecognitionResultList {
  length: number
  [index: number]: RecognitionResult
}

interface RecognitionEvent {
  resultIndex: number
  results: RecognitionResultList
}

interface RecognitionErrorEvent {
  error: string
}

interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onaudiostart: (() => void) | null
  onaudioend: (() => void) | null
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

type RecognitionCtor = new () => RecognitionLike

function resolveCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

export interface BrowserSpeechRecognition {
  supported: ComputedRef<boolean>
  listening: ShallowRef<boolean>
  busy: ComputedRef<boolean>
  /** 已确定的识别结果 */
  finalText: ShallowRef<string>
  /** 还在变化中的临时结果 */
  interimText: ShallowRef<string>
  /** 已确定 + 临时，供输入框实时回显 */
  transcript: ComputedRef<string>
  error: ShallowRef<string>
  errorCode: ShallowRef<string>
  audioActive: ShallowRef<boolean>
  diagnostics: () => string
  /** 开始识别；不可用或已在识别时返回 false */
  start: (options?: { lang?: string; continuous?: boolean }) => boolean
  /** 结束识别并保留已有结果 */
  stop: () => Promise<string>
  /** 放弃识别并丢弃本次结果 */
  abort: () => void
}

const supported = computed(() => Boolean(resolveCtor()))
const listening = shallowRef(false)
const finalText = shallowRef("")
const interimText = shallowRef("")
const error = shallowRef("")
const errorCode = shallowRef('')
const audioActive = shallowRef(false)
const events: Array<{ elapsedMs: number; event: string }> = []
let sessionStartedAt = 0
let startTimer: ReturnType<typeof setTimeout> | undefined
let endTimer: ReturnType<typeof setTimeout> | undefined
let waitingForEnd = false

function trace(event: string) {
  events.push({ elapsedMs: Date.now() - sessionStartedAt, event })
  if (events.length > 64) events.shift()
}

let recognition: RecognitionLike | null = null
let sharedEngine: RecognitionLike | null = null
let engineWindow: Window | null = null
let callbackGeneration = 0
const engineRunning = shallowRef(false)
const busy = computed(() => listening.value || engineRunning.value)
/** 主动 stop/abort 时浏览器会回一个 aborted 错误，不该当成失败展示 */
let intentionalStop = false
/** abort（离开页面）要丢弃本次结果，与 stop（用户说完/手动停）区分开 */
let discardOnEnd = false
/** 本轮是否出过错：出错时不把残留的临时结果落定 */
let hadError = false
/** 记住上一次用的语言：面板里再次开麦时沿用，不会退回默认中文 */
let lastLang = "zh-CN"
let completion: Promise<string> = Promise.resolve("")
let resolveCompletion: ((text: string) => void) | null = null
let restartTimer: ReturnType<typeof setTimeout> | undefined
let stopTimer: ReturnType<typeof setTimeout> | undefined
let keepListening = false
let sessionBaseText = ""
let engineStarted = false
let interruptionRetries = 0

const transcript = computed(() => `${finalText.value}${interimText.value}`.trim())

function release() {
  if (!recognition) return
  callbackGeneration += 1
  const generation = callbackGeneration
  const previous = recognition
  recognition.onstart = null
  recognition.onaudiostart = null
  recognition.onaudioend = null
  recognition.onresult = null
  recognition.onerror = null
  recognition.onend = engineRunning.value ? () => {
    if (sharedEngine !== previous || generation !== callbackGeneration) return
    trace('engine-drained')
    engineRunning.value = false
    previous.onend = null
  } : null
  recognition = null
}

function finish() {
  clearTimeout(restartTimer)
  clearTimeout(stopTimer)
  clearTimeout(startTimer)
  clearTimeout(endTimer)
  restartTimer = undefined
  stopTimer = undefined
  if (!hadError && !discardOnEnd && interimText.value.trim()) {
    finalText.value = `${finalText.value}${interimText.value}`
  }
  interimText.value = ""
  listening.value = false
  audioActive.value = false
  waitingForEnd = false
  release()
  engineStarted = false
  resolveCompletion?.(hadError || discardOnEnd ? "" : finalText.value.trim())
  resolveCompletion = null
}

function describeError(code: string) {
  switch (code) {
    case "not-allowed":
      return "麦克风权限被拒绝，语音提问不可用；可以直接打字。"
    case "service-not-allowed":
      return "浏览器不允许使用语音识别服务，可以直接打字。"
    case "no-speech":
      return "没有听到声音，可以再说一次或直接打字。"
    case "audio-capture":
      return "没有找到可用的麦克风，可以直接打字。"
    case "network":
      return "语音识别服务连接失败，可以直接打字。"
    case "language-not-supported":
      return "当前语言不支持语音识别，可以直接打字。"
    case "aborted":
      return "浏览器语音识别已中断，可以复制诊断信息排查，或直接打字。"
    case "start-timeout":
      return "浏览器语音识别启动超时，可以复制诊断信息排查。"
    default:
      return `语音识别失败（${code || 'unknown'}），请重试。`
  }
}

function createBrowserSpeechRecognition(): BrowserSpeechRecognition {
  function start(options?: { lang?: string; continuous?: boolean }) {
    const Ctor = resolveCtor()
    if (typeof window !== 'undefined' && engineWindow !== window) {
      sharedEngine = null
      engineRunning.value = false
      engineWindow = window
    }
    if (!Ctor || busy.value) {
      return false
    }
    const Recognition = Ctor

    release()
    finalText.value = ""
    interimText.value = ""
    error.value = ""
    errorCode.value = ''
    audioActive.value = false
    events.length = 0
    sessionStartedAt = Date.now()
    trace('start-request')
    intentionalStop = false
    discardOnEnd = false
    hadError = false
    keepListening = Boolean(options?.continuous)
    interruptionRetries = 0
    completion = new Promise<string>((resolve) => { resolveCompletion = resolve })

    const lang = String(options?.lang || lastLang || "zh-CN")
    lastLang = lang
    function restartRecognition() {
      if (interimText.value.trim()) {
        finalText.value = `${finalText.value}${interimText.value}`
      }
      interimText.value = ""
      sessionBaseText = finalText.value
      release()
      engineStarted = false
      audioActive.value = false
      restartTimer = setTimeout(() => {
        restartTimer = undefined
        if (intentionalStop || !listening.value) return
        beginRecognition()
      }, 100)
    }

    function beginRecognition() {
      const instance = sharedEngine ??= new Recognition()
      const generation = ++callbackGeneration
      const isCurrent = () => recognition === instance && generation === callbackGeneration
      instance.lang = lang
      instance.continuous = false
      instance.interimResults = true
      instance.maxAlternatives = 1

      instance.onstart = () => {
        if (!isCurrent()) return
        trace('engine-start')
        clearTimeout(startTimer)
        engineStarted = true
        listening.value = true
        if (intentionalStop) {
          try { instance.stop() } catch { finish() }
        }
      }

      instance.onaudiostart = () => {
        if (!isCurrent()) return
        trace('audio-start')
        audioActive.value = true
      }
      instance.onaudioend = () => {
        if (!isCurrent()) return
        trace('audio-end')
        audioActive.value = false
      }

      instance.onresult = (event) => {
        if (!isCurrent()) return
        trace('result')
        let confirmed = ""
        let pending = ""
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index]
          const text = String(result?.[0]?.transcript ?? "")
          if (!text) continue
          if (result.isFinal) confirmed += text
          else pending += text
        }
        finalText.value = `${sessionBaseText}${confirmed}`
        interimText.value = pending
      }

      instance.onerror = (event) => {
        if (!isCurrent()) return
        const code = String(event?.error || "")
        trace(`error:${code}`)
        clearTimeout(startTimer)
        if (intentionalStop && code === "aborted") { finish(); return }
        if (code === "aborted") {
          waitingForEnd = false
          if (transcript.value) {
            finish()
            return
          }
          hadError = true
          errorCode.value = code
          error.value = describeError(code)
          finish()
          return
        }
        if (keepListening && !intentionalStop && code === "no-speech") return
        if (code !== "no-speech") {
          hadError = true
          errorCode.value = code
          error.value = describeError(code)
        }
        finish()
      }

      instance.onend = () => {
        if (!isCurrent()) return
        engineRunning.value = false
        trace('engine-end')
        clearTimeout(startTimer)
        clearTimeout(endTimer)
        if (waitingForEnd) {
          waitingForEnd = false
          if (!intentionalStop) { restartRecognition(); return }
        }
        // 浏览器常在「只出了临时结果」时就结束（用户手动停、或说完就断）。
        // 这时要把残留的临时结果落成最终结果，否则刚说的话会被清掉。
        if (!hadError && !discardOnEnd && interimText.value.trim()) {
          finalText.value = `${finalText.value}${interimText.value}`
        }
        interimText.value = ""
        if (keepListening && !intentionalStop && !hadError) {
          restartRecognition()
          return
        }
        finish()
      }

      try {
        sessionBaseText = finalText.value
        recognition = instance
        engineStarted = false
        listening.value = true
        startTimer = setTimeout(() => {
          if (!isCurrent()) return
          hadError = true
          errorCode.value = 'start-timeout'
          error.value = describeError(errorCode.value)
          trace('start-timeout')
          finish()
          try { instance.abort() } catch {}
        }, 8000)
        engineRunning.value = true
        instance.start()
      } catch (caught) {
        engineRunning.value = false
        hadError = true
        errorCode.value = caught instanceof Error ? caught.name : 'start-failed'
        trace(`start-failed:${errorCode.value}`)
        error.value = "无法启动语音识别，可以直接打字。"
        finish()
        return false
      }

      return true
    }
    return beginRecognition()
  }

  function stop() {
    trace('stop-request')
    intentionalStop = true
    const restarting = Boolean(restartTimer)
    clearTimeout(restartTimer)
    restartTimer = undefined
    if (restarting) finish()
    if (!recognition) return completion
    try {
      if (engineStarted && !waitingForEnd) recognition.stop()
    } catch {
      finish()
    }
    if (recognition) stopTimer = setTimeout(() => {
      const previous = recognition
      finish()
      try { previous?.abort() } catch {}
    }, 2000)
    return completion
  }

  function abort() {
    trace('abort-request')
    intentionalStop = true
    discardOnEnd = true
    const previous = recognition
    finalText.value = ""
    finish()
    try {
      previous?.abort()
    } catch {
      // 已结束的实例忽略
    }
  }

  function diagnostics() {
    return JSON.stringify({
      version: 'browser-voice-20261014',
      userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
      secureContext: typeof window !== 'undefined' && window.isSecureContext,
      visibility: typeof document === 'undefined' ? '' : document.visibilityState,
      language: lastLang,
      errorCode: errorCode.value,
      engineRunning: engineRunning.value,
      events,
    }, null, 2)
  }

  return { supported, busy, listening, audioActive, finalText, interimText, transcript, error, errorCode, diagnostics, start, stop, abort }
}

const controller = createBrowserSpeechRecognition()

export function useBrowserSpeechRecognition(): BrowserSpeechRecognition {
  return controller
}
