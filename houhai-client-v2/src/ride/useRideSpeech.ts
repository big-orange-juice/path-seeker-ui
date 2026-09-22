import { onUnmounted, shallowRef } from 'vue'
import { languages } from './i18n.ts'
import type { Locale } from './types'

export function useRideSpeech(onEnd: () => void, onError: () => void) {
  const error = shallowRef<'speechError' | 'voiceMissing'>()
  let utterance: SpeechSynthesisUtterance | undefined
  let watchdog: ReturnType<typeof setTimeout> | undefined
  let voiceWait: (() => void) | undefined
  let generation = 0

  function clearTimers() {
    clearTimeout(watchdog)
    if (voiceWait) window.speechSynthesis?.removeEventListener('voiceschanged', voiceWait)
    voiceWait = undefined
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
    window.speechSynthesis?.cancel()
  }

  function play(text: string, locale: Locale) {
    stop()
    error.value = undefined
    const token = generation
    const synthesis = window.speechSynthesis
    const fail = (reason: 'speechError' | 'voiceMissing') => {
      if (token !== generation) return
      stop()
      error.value = reason
      onError()
    }
    if (!synthesis || !text) { fail('speechError'); return }
    const speak = () => {
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
    if (synthesis.getVoices().length) speak()
    else {
      voiceWait = speak
      synthesis.addEventListener('voiceschanged', speak)
      watchdog = setTimeout(speak, 1500)
    }
  }

  function pause() {
    clearTimers()
    if (utterance) window.speechSynthesis.pause()
    else stop()
  }

  function resume(): boolean {
    if (!utterance) return false
    window.speechSynthesis.resume()
    return true
  }

  onUnmounted(stop)
  return { error, play, stop, pause, resume }
}
