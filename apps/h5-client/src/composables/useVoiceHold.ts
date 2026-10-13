import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import type { BrowserSpeechRecognition } from './useBrowserSpeechRecognition'

interface VoiceHoldOptions {
  recognition: BrowserSpeechRecognition
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

  function releasePointer() {
    const capturedId = pointerId
    const capturedTarget = target
    pointerId = null
    target = null
    if (capturedId !== null && capturedTarget?.hasPointerCapture(capturedId)) {
      capturedTarget.releasePointerCapture(capturedId)
    }
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
    if (event.button !== 0 || !event.isPrimary || active.value || options.recognition.listening.value || options.canStart?.() === false) return
    suppressClick = true
    event.preventDefault()
    pointerId = event.pointerId
    target = event.currentTarget as HTMLElement
    target.setPointerCapture(pointerId)
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
        options.onError(options.recognition.error.value || '无法启动语音识别，请重试。')
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
      options.onError(message)
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
      options.onError(options.recognition.error.value || '没有识别到内容，请按住说话后重试。')
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
    options.onError(message)
    if (options.onRelease && held.value) return
    cancel()
  })

  function visibilityChange() {
    if (document.visibilityState === 'hidden') cancel()
  }

  document.addEventListener('visibilitychange', visibilityChange)
  onScopeDispose(() => {
    cancel()
    document.removeEventListener('visibilitychange', visibilityChange)
  })

  return { held, finishing, cancelling, active, pointerDown, pointerMove, pointerUp, pointerCancel, click, cancel }
}
