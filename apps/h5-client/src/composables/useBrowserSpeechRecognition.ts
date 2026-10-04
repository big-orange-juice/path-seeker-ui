/**
 * 浏览器本地语音识别（Web Speech API）封装。
 *
 * 用途：行程页的语音键点一下就能开口提问，不用先弹出键盘。
 *
 * 边界（必须知道）：
 * - 我们自己的后端不参与：不上传音频、不落盘、没有音频上行链路。
 * - 但 Chrome / Edge 是把音频交给浏览器厂商（Google）做识别的，所以
 *   「不经过我们的服务」成立，「音频不出设备」不成立。
 * - iOS Safari 的中文识别不稳定；拿不到结果时上层回退成打字输入。
 */

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
  /** 已确定的识别结果 */
  finalText: ShallowRef<string>
  /** 还在变化中的临时结果 */
  interimText: ShallowRef<string>
  /** 已确定 + 临时，供输入框实时回显 */
  transcript: ComputedRef<string>
  error: ShallowRef<string>
  /** 开始识别；不可用或已在识别时返回 false */
  start: (options?: { lang?: string }) => boolean
  /** 结束识别并保留已有结果 */
  stop: () => void
  /** 放弃识别并丢弃本次结果 */
  abort: () => void
}

const supported = computed(() => Boolean(resolveCtor()))
const listening = shallowRef(false)
const finalText = shallowRef("")
const interimText = shallowRef("")
const error = shallowRef("")

let recognition: RecognitionLike | null = null
/** 主动 stop/abort 时浏览器会回一个 aborted 错误，不该当成失败展示 */
let intentionalStop = false
/** abort（离开页面）要丢弃本次结果，与 stop（用户说完/手动停）区分开 */
let discardOnEnd = false
/** 本轮是否出过错：出错时不把残留的临时结果落定 */
let hadError = false
/** 记住上一次用的语言：面板里再次开麦时沿用，不会退回默认中文 */
let lastLang = "zh-CN"

const transcript = computed(() => `${finalText.value}${interimText.value}`.trim())

function release() {
  if (!recognition) return
  recognition.onstart = null
  recognition.onresult = null
  recognition.onerror = null
  recognition.onend = null
  recognition = null
}

function describeError(code: string) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "麦克风权限被拒绝，语音提问不可用；可以直接打字。"
    case "no-speech":
      return "没有听到声音，可以再说一次或直接打字。"
    case "audio-capture":
      return "没有找到可用的麦克风，可以直接打字。"
    case "network":
      return "语音识别服务连接失败，可以直接打字。"
    case "language-not-supported":
      return "当前语言不支持语音识别，可以直接打字。"
    default:
      return "语音识别中断，可以直接打字。"
  }
}

export function useBrowserSpeechRecognition(): BrowserSpeechRecognition {
  function start(options?: { lang?: string }) {
    const Ctor = resolveCtor()
    if (!Ctor || listening.value) {
      return false
    }

    // 每次重新建实例：同一个实例 end 之后再 start 在部分浏览器上不生效
    release()
    finalText.value = ""
    interimText.value = ""
    error.value = ""
    intentionalStop = false
    discardOnEnd = false
    hadError = false

    const instance = new Ctor()
    const lang = String(options?.lang || lastLang || "zh-CN")
    lastLang = lang
    instance.lang = lang
    instance.continuous = false
    instance.interimResults = true
    instance.maxAlternatives = 1

    instance.onstart = () => {
      listening.value = true
    }

    instance.onresult = (event) => {
      let confirmed = ""
      let pending = ""
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = String(result?.[0]?.transcript ?? "")
        if (!text) continue
        if (result.isFinal) confirmed += text
        else pending += text
      }
      if (confirmed) finalText.value = `${finalText.value}${confirmed}`
      interimText.value = pending
    }

    instance.onerror = (event) => {
      const code = String(event?.error || "")
      if (intentionalStop && code === "aborted") return
      if (code !== "no-speech") {
        hadError = true
        error.value = describeError(code)
      }
      listening.value = false
    }

    instance.onend = () => {
      listening.value = false
      // 浏览器常在「只出了临时结果」时就结束（用户手动停、或说完就断）。
      // 这时要把残留的临时结果落成最终结果，否则刚说的话会被清掉。
      if (!hadError && !discardOnEnd && interimText.value.trim()) {
        finalText.value = `${finalText.value}${interimText.value}`
      }
      interimText.value = ""
      release()
    }

    try {
      instance.start()
    } catch {
      error.value = "无法启动语音识别，可以直接打字。"
      release()
      return false
    }

    recognition = instance
    listening.value = true
    return true
  }

  function stop() {
    intentionalStop = true
    try {
      recognition?.stop()
    } catch {
      // 已结束的实例忽略
    }
  }

  function abort() {
    intentionalStop = true
    discardOnEnd = true
    try {
      recognition?.abort()
    } catch {
      // 已结束的实例忽略
    }
    listening.value = false
    interimText.value = ""
    release()
  }

  return { supported, listening, finalText, interimText, transcript, error, start, stop, abort }
}
