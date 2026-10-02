import { onBeforeUnmount, shallowRef } from 'vue'
import { TOUR_LANGUAGES, type TourLocale } from '@path-seeker/ts-shared'
import type { TourNarrationChapter } from '@/types/clientCatalog'

export function useTourSpeech(onEnd: () => void) {
  const status = shallowRef<'idle' | 'playing' | 'paused'>('idle')
  const error = shallowRef<'unavailable' | 'voiceMissing' | 'playback' | null>(null)
  let audio: HTMLAudioElement | null = null
  let utterance: SpeechSynthesisUtterance | null = null
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let voicesChanged: (() => void) | undefined
  let chapters: TourNarrationChapter[] = []
  let chapterIndex = 0
  let locale: TourLocale = 'zh'

  function clearWait() {
    clearTimeout(timer)
    if (voicesChanged) window.speechSynthesis?.removeEventListener('voiceschanged', voicesChanged)
    voicesChanged = undefined
  }

  function releaseMedia() {
    clearWait()
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.onplaying = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    if (utterance) {
      utterance.onend = null
      utterance.onerror = null
      utterance.onstart = null
      window.speechSynthesis?.cancel()
    }
    audio = null
    utterance = null
  }

  function stop() {
    generation += 1
    releaseMedia()
    status.value = 'idle'
  }

  function fail(reason: NonNullable<typeof error.value>, token: number) {
    if (token !== generation) return
    stop()
    error.value = reason
  }

  function advance(token: number) {
    if (token !== generation || status.value !== 'playing') return
    releaseMedia()
    chapterIndex += 1
    playChapter(token)
  }

  function speak(text: string, token: number) {
    const synthesis = window.speechSynthesis
    if (!synthesis || !text) { fail('unavailable', token); return }
    const begin = () => {
      if (token !== generation || status.value !== 'playing') return
      clearWait()
      const voice = synthesis.getVoices().find(item => item.lang.toLowerCase().split(/[-_]/)[0] === locale)
      if (!voice) { fail('voiceMissing', token); return }
      utterance = new SpeechSynthesisUtterance(text)
      utterance.voice = voice
      utterance.lang = TOUR_LANGUAGES.find(language => language.value === locale)!.speech
      utterance.rate = 0.95
      utterance.onstart = () => clearTimeout(timer)
      utterance.onend = () => advance(token)
      utterance.onerror = () => fail('playback', token)
      timer = setTimeout(() => fail('playback', token), 10000)
      synthesis.resume()
      synthesis.speak(utterance)
    }
    if (synthesis.getVoices().length) begin()
    else {
      voicesChanged = begin
      synthesis.addEventListener('voiceschanged', begin)
      timer = setTimeout(begin, 1500)
    }
  }

  function playChapter(token: number) {
    if (token !== generation) return
    const chapter = chapters[chapterIndex]
    if (!chapter) { status.value = 'idle'; onEnd(); return }
    if (locale !== 'zh' || !chapter.audioUrl) { speak(chapter.text || '', token); return }
    let fallen = false
    const fallback = () => {
      if (fallen || token !== generation) return
      fallen = true
      releaseMedia()
      if (status.value === 'playing') speak(chapter.text || '', token)
    }
    audio = new Audio(chapter.audioUrl)
    audio.onplaying = () => clearTimeout(timer)
    audio.onended = () => advance(token)
    audio.onerror = fallback
    timer = setTimeout(fallback, 10000)
    void audio.play().catch(fallback)
  }

  function play(source: TourNarrationChapter[], language: TourLocale) {
    stop()
    error.value = null
    chapters = source.filter(chapter => chapter.text?.trim() || chapter.audioUrl)
    chapterIndex = 0
    locale = language
    if (!chapters.length) { error.value = 'unavailable'; return }
    status.value = 'playing'
    playChapter(generation)
  }

  function pause() {
    if (status.value !== 'playing') return
    status.value = 'paused'
    clearWait()
    audio?.pause()
    if (utterance) window.speechSynthesis?.pause()
  }

  function resume() {
    if (status.value !== 'paused') return
    status.value = 'playing'
    if (audio) {
      const token = generation
      void audio.play().catch(() => fail('playback', token))
    } else if (utterance) window.speechSynthesis?.resume()
    else playChapter(generation)
  }

  onBeforeUnmount(stop)
  return { status, error, play, pause, resume, stop }
}
