import { onBeforeUnmount, shallowRef } from 'vue'
import { TOUR_LANGUAGES, type TourLocale } from '@path-seeker/ts-shared'

export function useTourPreviewPlayback(onEnd: () => void) {
  const playing = shallowRef(false)
  const paused = shallowRef(false)
  const error = shallowRef('')
  let audio: HTMLAudioElement | null = null
  let utterance: SpeechSynthesisUtterance | null = null
  let generation = 0
  let chunks: { text: string; audioUrl: string | null }[] = []
  let index = 0
  let language: TourLocale = 'zh'

  function release() {
    if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null }
    if (utterance) { utterance.onend = null; utterance.onerror = null; window.speechSynthesis?.cancel(); utterance = null }
  }

  function stop() { generation += 1; release(); playing.value = false; paused.value = false }

  function next(token: number) {
    if (token !== generation) return
    release()
    index += 1
    playChunk(token)
  }

  function speak(text: string, token: number) {
    const synthesis = window.speechSynthesis
    const voice = synthesis?.getVoices().find(item => item.lang.toLowerCase().split(/[-_]/)[0] === language)
    if (!synthesis || !voice || !text) { stop(); error.value = '设备未提供该语言语音，可继续阅读讲解。'; return }
    utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = TOUR_LANGUAGES.find(item => item.value === language)!.speech
    utterance.onend = () => next(token)
    utterance.onerror = () => { if (token === generation) { stop(); error.value = '讲解播放失败。' } }
    synthesis.speak(utterance)
  }

  function playChunk(token: number) {
    if (token !== generation) return
    const chunk = chunks[index]
    if (!chunk) { stop(); onEnd(); return }
    if (language !== 'zh' || !chunk.audioUrl) { speak(chunk.text, token); return }
    let fallen = false
    const fallback = () => {
      if (fallen || token !== generation) return
      fallen = true
      release()
      speak(chunk.text, token)
    }
    audio = new Audio(chunk.audioUrl)
    audio.onended = () => next(token)
    audio.onerror = fallback
    void audio.play().catch(fallback)
  }

  function play(source: typeof chunks, locale: TourLocale) {
    stop()
    error.value = ''
    chunks = source.filter(item => item.text || item.audioUrl)
    index = 0
    language = locale
    if (!chunks.length) return
    playing.value = true
    playChunk(generation)
  }

  function pause() { playing.value = false; paused.value = true; audio?.pause(); if (utterance) window.speechSynthesis?.pause() }
  function resume() {
    if (!paused.value) return
    playing.value = true
    paused.value = false
    if (audio) void audio.play().catch(() => { stop(); error.value = '讲解播放失败。' })
    else if (utterance) window.speechSynthesis?.resume()
  }
  onBeforeUnmount(stop)
  return { playing, paused, error, play, pause, resume, stop }
}
