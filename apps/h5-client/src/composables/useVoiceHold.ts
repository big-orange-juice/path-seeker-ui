import { computed, onScopeDispose, shallowRef, watch, type ComputedRef, type ShallowRef } from 'vue'
import type { MicrophoneAccess } from './useMicrophoneAccess'

export interface VoiceRecognitionController {
  supported: ComputedRef<boolean>
  busy: ComputedRef<boolean>
  listening: ShallowRef<boolean>
  finalText: ShallowRef<string>
  interimText: ShallowRef<string>
  transcript: ComputedRef<string>
  error: ShallowRef<string>
  errorCode: ShallowRef<string>
  audioActive: ShallowRef<boolean>
  audioLevel?: ShallowRef<number>
  diagnostics: () => string
  start: (options?: { lang?: string; continuous?: boolean }) => boolean
  stop: () => Promise<string>
  abort: () => void
}

interface VoiceHoldOptions {
  recognition: VoiceRecognitionController
  microphone?: MicrophoneAccess
  canStart?: () => boolean
  lang?: () => string
  onPress?: () => void
  onStart?: () => void
  onSubmit?: (text: string) => void
  onRelease?: (completion: Promise<string>) => void
  onCancel?: () => void
  onError: (message: string) => void
  onTap?: () => void
}

export function useVoiceHold(options: VoiceHoldOptions) {
  const held = shallowRef(false)
  const finishing = shallowRef(false)
  const cancelling = shallowRef(false)
  const active = computed(() => held.value || finishing.value)
  let pointerId: number | null = null
  let target: HTMLElement | null = null
  let startedAt = 0
  let startedY = 0
  let generation = 0
  let suppressClick = false
  let unavailable = false
  let capturing = false
  let globalPointerListenersAttached = false
  let disposed = false
  let reportedError = ''

  function reportError(message: string) {
    if (message === reportedError) return
    reportedError = message
    options.onError(message)
  }

  function handleDocumentPointerUp(event: PointerEvent) {
    if (event.pointerId === pointerId) {
      void pointerUp(event)
    }
  }

  function handleDocumentPointerCancel(event: PointerEvent) {
    if (event.pointerId === pointerId) {
      pointerCancel(event)
    }
  }

  function handleDocumentPointerMove(event: PointerEvent) {
    pointerMove(event)
  }

  function attachGlobalPointerListeners() {
    if (globalPointerListenersAttached) return
    globalPointerListenersAttached = true
    document.addEventListener('pointermove', handleDocumentPointerMove, true)
    document.addEventListener('pointerup', handleDocumentPointerUp, true)
    document.addEventListener('pointercancel', handleDocumentPointerCancel, true)
  }

  function detachGlobalPointerListeners() {
    if (!globalPointerListenersAttached) return
    globalPointerListenersAttached = false
    document.removeEventListener('pointermove', handleDocumentPointerMove, true)
    document.removeEventListener('pointerup', handleDocumentPointerUp, true)
    document.removeEventListener('pointercancel', handleDocumentPointerCancel, true)
  }

  function releasePointer() {
    const capturedId = pointerId
    const capturedTarget = target
    pointerId = null
    target = null
    detachGlobalPointerListeners()
    try {
      if (capturedId !== null && capturedTarget?.hasPointerCapture(capturedId)) {
        capturedTarget.releasePointerCapture(capturedId)
      }
    } catch {}
  }

  function cancel() {
    if (!active.value) return
    generation += 1
    held.value = false
    finishing.value = false
    cancelling.value = false
    releasePointer()
    if (capturing) {
      options.recognition.abort()
      options.onCancel?.()
    }
    capturing = false
    unavailable = false
  }

  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary || active.value || options.recognition.busy.value || options.microphone?.preparing.value || options.canStart?.() === false) return
    suppressClick = true
    event.preventDefault()
    reportedError = ''
    if (options.recognition.supported.value && options.microphone && !options.microphone.ready.value) {
      options.recognition.error.value = ''
      options.recognition.errorCode.value = ''
      options.onStart?.()
      void options.microphone.prepare().then((ready) => {
        if (disposed) return
        options.onCancel?.()
        if (!ready) reportError(options.microphone!.notice.value)
      })
      return
    }
    if (options.microphone) options.microphone.notice.value = ''
    pointerId = event.pointerId
    target = event.currentTarget as HTMLElement
    try {
      target.setPointerCapture(pointerId)
    } catch {}
    attachGlobalPointerListeners()
    startedAt = Date.now()
    startedY = event.clientY
    generation += 1
    held.value = true
    cancelling.value = false
    unavailable = !options.recognition.supported.value
    options.onPress?.()
    if (!unavailable) {
      capturing = true
      options.onStart?.()
      if (!options.recognition.start({ lang: options.lang?.(), continuous: true })) {
        reportError(options.recognition.error.value || '无法启动语音识别，请重试。')
        if (!options.onRelease) cancel()
      }
    }
  }

  function pointerMove(event: PointerEvent) {
    if (event.pointerId === pointerId && held.value) {
      cancelling.value = startedY - event.clientY >= 60
    }
  }

  async function pointerUp(event: PointerEvent) {
    if (event.pointerId !== pointerId || !held.value) return
    event.preventDefault()
    if (cancelling.value) { cancel(); return }
    if (!options.onRelease && Date.now() - startedAt < 300) {
      cancel()
      options.onTap?.()
      return
    }
    if (unavailable) {
      const message = '当前浏览器不支持语音识别，请点击问一问使用文字输入。'
      reportError(message)
      if (options.onRelease) {
        held.value = false
        releasePointer()
        options.recognition.error.value = message
        options.onRelease(Promise.resolve(''))
        return
      }
      cancel()
      return
    }
    if (!capturing) { cancel(); options.onTap?.(); return }
    const token = generation
    held.value = false
    finishing.value = true
    releasePointer()
    const completion = options.recognition.stop()
    if (options.onRelease) {
      finishing.value = false
      capturing = false
      options.onRelease(completion)
      return
    }
    const text = await completion
    if (token !== generation) return
    finishing.value = false
    capturing = false
    if (!text || options.recognition.error.value) {
      reportError(options.recognition.error.value || '没有识别到内容，请按住说话后重试。')
      options.onCancel?.()
      return
    }
    options.onSubmit?.(text)
  }

  function pointerCancel(event: PointerEvent) {
    if (event.pointerId === pointerId) cancel()
  }

  function click() {
    if (suppressClick) { suppressClick = false; return }
    options.onTap?.()
  }

  watch(options.recognition.error, (message) => {
    if (!message || !active.value) return
    if (options.microphone && ['not-allowed', 'audio-capture'].includes(options.recognition.errorCode.value)) {
      options.microphone.ready.value = false
    }
    reportError(message)
    if (options.onRelease && held.value) return
    cancel()
  })

  function visibilityChange() {
    if (document.visibilityState === 'hidden') cancel()
  }

  document.addEventListener('visibilitychange', visibilityChange)
  onScopeDispose(() => {
    disposed = true
    cancel()
    document.removeEventListener('visibilitychange', visibilityChange)
    detachGlobalPointerListeners()
  })

  return { held, finishing, cancelling, active, pointerDown, pointerMove, pointerUp, pointerCancel, click, cancel }
}
