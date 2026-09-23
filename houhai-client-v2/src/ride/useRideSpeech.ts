import { onUnmounted, shallowRef } from 'vue'
import { languages } from './i18n.ts'
import type { Locale, RideNarrationClip } from './types'

export function useRideSpeech(onEnd: () => void, onError: () => void) {
  const error = shallowRef<'speechError' | 'voiceMissing'>()
  let utterance: SpeechSynthesisUtterance | undefined
  let audio: HTMLAudioElement | undefined
  let clips: RideNarrationClip[] = []
  let clipIndex = 0
  let watchdog: ReturnType<typeof setTimeout> | undefined
  let voiceWait: (() => void) | undefined
  let generation = 0

  function clearTimers() {
    clearTimeout(watchdog)
    if (voiceWait) window.speechSynthesis?.removeEventListener('voiceschanged', voiceWait)
    voiceWait = undefined
  }

  function releaseAudio() {
    if (audio) {
      audio.onplaying = null
      audio.onended = null
      audio.onerror = null
      audio.pause()
      audio.removeAttribute('src')
    }
    audio = undefined
    clips = []
    clipIndex = 0
  }

  function stop() {
    generation += 1
    clearTimers()
    if (utterance) {
      utterance.onend = null
      utterance.onerror = null
      utterance.onstart = null
    }
    utterance = undefined
    releaseAudio()
    window.speechSynthesis?.cancel()
  }

  function speak(text: string, locale: Locale, token: number) {
    const synthesis = window.speechSynthesis
    const fail = (reason: 'speechError' | 'voiceMissing') => {
      if (token !== generation) return
      stop()
      error.value = reason
      onError()
    }
    if (!synthesis || !text) { fail('speechError'); return }
    const start = () => {
      if (generation !== token) return
      clearTimers()
      const voice = synthesis.getVoices().find(item => item.lang.toLowerCase().split(/[-_]/)[0] === locale)
      if (!voice) { fail('voiceMissing'); return }
      utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = languages.find(language => language.id === locale)!.speech
      utterance.voice = voice
      utterance.rate = 0.95
      utterance.onstart = () => clearTimeout(watchdog)
      utterance.onend = () => {
        if (token !== generation) return
        clearTimers()
        utterance = undefined
        onEnd()
      }
      utterance.onerror = () => fail('speechError')
      watchdog = setTimeout(() => fail('speechError'), 10000)
      synthesis.resume()
      synthesis.speak(utterance)
    }
    if (synthesis.getVoices().length) start()
    else {
      voiceWait = start
      synthesis.addEventListener('voiceschanged', start)
      watchdog = setTimeout(start, 1500)
    }
  }

  // 远程 TTS：逐段播放，最后一段结束即算讲完；网络或解码失败时退回系统语音，保证讲解不中断。
  function playClips(list: RideNarrationClip[], locale: Locale, token: number) {
    clips = list
    clipIndex = 0
    // play() 拒绝与 error 事件可能同时到达，回退只允许发生一次，否则会用空文稿覆盖刚播起的语音。
    let fallen = false
    const fallback = () => {
      if (fallen || token !== generation) return
      fallen = true
      const remaining = clips.slice(clipIndex).map(clip => clip.text).join('\n')
      clearTimers()
      releaseAudio()
      speak(remaining, locale, token)
    }
    const advance = () => {
      if (token !== generation) return
      const clip = clips[clipIndex]
      if (!clip) { clearTimers(); fallen = true; releaseAudio(); onEnd(); return }
      const element = new Audio(clip.audio)
      element.preload = 'auto'
      audio = element
      element.onplaying = () => clearTimeout(watchdog)
      element.onended = () => { if (token !== generation) return; clipIndex += 1; advance() }
      element.onerror = fallback
      watchdog = setTimeout(fallback, 8000)
      void element.play().catch(fallback)
    }
    advance()
  }

  function play(source: string | RideNarrationClip[], locale: Locale) {
    stop()
    error.value = undefined
    const token = generation
    if (Array.isArray(source) && source.length) playClips(source, locale, token)
    else speak(typeof source === 'string' ? source : '', locale, token)
  }

  function pause() {
    clearTimers()
    if (audio) { audio.pause(); return }
    if (utterance) window.speechSynthesis.pause()
    else stop()
  }

  function resume(): boolean {
    if (audio) { void audio.play().catch(() => {}); return true }
    if (!utterance) return false
    window.speechSynthesis.resume()
    return true
  }

  onUnmounted(stop)
  return { error, play, stop, pause, resume }
}
