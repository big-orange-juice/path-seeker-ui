import { onUnmounted, shallowRef } from 'vue'

export function useNarration() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const state = shallowRef<'idle' | 'playing' | 'paused'>('idle')
  const error = shallowRef('')
  let current: SpeechSynthesisUtterance | undefined

  function stop() {
    if (current) {
      current.onend = null
      current.onerror = null
      current.onstart = null
      current.onpause = null
      current.onresume = null
      if (supported) window.speechSynthesis.cancel()
    }
    current = undefined
    state.value = 'idle'
  }

  function toggle(text: string) {
    if (!supported) {
      error.value = '当前浏览器不支持语音朗读，可阅读下方完整讲解。'
      return
    }
    error.value = ''
    if (state.value === 'playing') {
      window.speechSynthesis.pause()
      state.value = 'paused'
      return
    }
    if (state.value === 'paused') {
      window.speechSynthesis.resume()
      state.value = 'playing'
      return
    }
    stop()
    window.speechSynthesis.resume()
    current = new SpeechSynthesisUtterance(text)
    current.lang = 'zh-CN'
    current.rate = 0.95
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.startsWith('zh'))
    if (voice) current.voice = voice
    current.onstart = () => { state.value = 'playing' }
    current.onpause = () => { state.value = 'paused' }
    current.onresume = () => { state.value = 'playing' }
    current.onend = () => { current = undefined; state.value = 'idle' }
    current.onerror = () => { current = undefined; state.value = 'idle'; error.value = '语音暂不可用，请阅读下方讲解。' }
    state.value = 'playing'
    window.speechSynthesis.speak(current)
  }

  onUnmounted(stop)
  return { supported, state, error, toggle, stop }
}
