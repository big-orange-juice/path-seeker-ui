import { onScopeDispose, shallowRef } from 'vue'
import { startTranslationMic } from '../../../../demos/duplex-translation/public/mic.js'
import { createPcmEncoder } from '../../../../demos/duplex-translation/public/pcm.js'
import { createTranslationPlayer } from '../../../../demos/duplex-translation/public/player.js'
import { RoomQuestionFeed, questionMessages, questionWav, type RoomQuestion } from '../../../../packages/ts-shared/src/translation-room-questions'
import type { RoomEvent } from '../../../../packages/ts-shared/src/translation-room'
import type { TranslationRoom } from '@/services/translationRoom'
import { uploadRoomQuestion } from '@/services/roomQuestions'

interface QuestionOptions {
  room: () => TranslationRoom | null
  language: () => string
  connected: () => boolean
  speaking: () => boolean
  context: () => Promise<AudioContext>
  pauseHost: () => Promise<void>
  capture: () => () => void
  claim: () => void
  hasFocus: () => boolean
}

/** 只管理游客短录音与车夫收听，房间连接和车夫连续讲解仍由主会话维护。 */
export function useRoomQuestions(options: QuestionOptions) {
  const feed = new RoomQuestionFeed()
  const questions = shallowRef<RoomQuestion[]>([])
  const recording = shallowRef(false)
  const uploading = shallowRef(false)
  const playing = shallowRef(false)
  const error = shallowRef('')
  let version = 0
  let enabledAudio = false
  let activeId = ''
  let player: ReturnType<typeof createTranslationPlayer> | null = null
  let controller: AbortController | null = null
  let expiryTimer: ReturnType<typeof setInterval> | null = null
  let capture: { cancelled: boolean; released: boolean; finish: boolean; task: Promise<void>; stop: (() => Promise<void>) | null; release: () => void; timer?: ReturnType<typeof setTimeout> } | null = null
  const sync = () => { questions.value = feed.items.slice() }
  const labels = () => questionMessages(options.language())

  function stopPlayback() {
    enabledAudio = false
    const id = activeId
    activeId = ''
    playing.value = false
    player?.stop()
    if (id) { feed.mark(id, 'ready'); sync() }
  }

  async function drain() {
    feed.expire(); sync()
    if (!enabledAudio || activeId || options.speaking() || !options.hasFocus() || !options.connected()) return
    const next = feed.items.find(item => item.status === 'ready' && feed.playable(item.id))
    if (!next) return
    const current = version
    const context = await options.context()
    if (current !== version || activeId || options.speaking() || !enabledAudio || !options.hasFocus()) return
    const audio = feed.playable(next.id)
    if (!audio) return
    activeId = next.id
    playing.value = true
    feed.mark(next.id, 'playing'); sync()
    player ??= createTranslationPlayer(context, busy => {
      if (busy || !activeId) return
      const id = activeId; activeId = ''; playing.value = false
      feed.mark(id, 'played'); sync()
      void drain().catch(() => { error.value = labels().textOnly })
    }, () => { stopPlayback(); error.value = labels().textOnly })
    try {
      player.configure({ maxQueueSeconds: 120 })
      for (const part of audio) player.push({ format: part.format === 'wav' ? 'mp3' : part.format, audio: part.hex, encoding: 'hex', isFinal: true })
      player.flush()
    } catch { stopPlayback(); error.value = labels().textOnly }
  }

  function event(message: RoomEvent) {
    if (!feed.accept(message)) return false
    expiryTimer ??= setInterval(() => { feed.expire(); sync() }, 10000)
    sync()
    if (options.room()?.isHost) void drain().catch(() => { enabledAudio = false; error.value = labels().textOnly })
    return true
  }

  async function listen() {
    if (!options.room()?.isHost || !options.connected()) return
    error.value = ''
    const current = version
    try {
      options.claim()
      await options.context()
      await options.pauseHost()
      if (current !== version) return
      options.claim()
      await options.context()
      if (current !== version || !options.hasFocus()) return
      enabledAudio = true
      await drain()
    } catch { if (current === version) error.value = labels().failed }
  }

  function stopRecording(cancel = false) {
    const session = capture
    if (!session) return
    session.cancelled ||= cancel
    if (cancel) controller?.abort()
    session.released = true
    clearTimeout(session.timer)
    if (!session.finish && session.stop) { session.finish = true; void session.stop() }
  }

  function startRecording() {
    const room = options.room()
    if (!room?.guestSpeechEnabled || room.isHost || !options.connected() || ['closed', 'draining'].includes(room.status) || capture || uploading.value) return
    const current = version
    const session = { cancelled: false, released: false, finish: false, task: Promise.resolve(), stop: null as (() => Promise<void>) | null, release: () => {}, timer: undefined as ReturnType<typeof setTimeout> | undefined }
    capture = session
    recording.value = true
    error.value = ''
    session.task = (async () => {
      try {
        options.claim()
        const context = await options.context()
        if (session.cancelled || session.released || current !== version) return
        session.release = options.capture()
        const parts: ArrayBuffer[] = []
        let bytes = 0
        const encoder = createPcmEncoder(context.sampleRate, packet => {
          if (session.cancelled || current !== version) return
          const remaining = 960000 - bytes
          if (remaining > 0) { const part = packet.slice(0, remaining); bytes += part.byteLength; parts.push(part) }
          if (bytes === 960000 && !session.finish) stopRecording()
        })
        const mic = await startTranslationMic(context, frame => { if (!session.cancelled && current === version) encoder.feed(frame) }, {
          onError: () => { stopRecording(true); error.value = labels().microphone },
        })
        session.stop = async () => {
          try {
            await mic.stop({ flush: !session.cancelled })
            session.release()
            if (capture === session) recording.value = false
            if (session.cancelled || current !== version) return
            encoder.flush()
            const wav = questionWav(parts)
            controller = new AbortController()
            const upload = controller
            uploading.value = true
            const timeout = setTimeout(() => upload.abort(), 20000)
            try { await uploadRoomQuestion(room.roomId, wav, crypto.randomUUID().replace(/-/g, ''), upload.signal) }
            finally { clearTimeout(timeout); if (controller === upload) controller = null }
          } catch (failure) {
            if (current === version && !session.cancelled) error.value = failure instanceof Error && failure.message === 'invalid_recording' ? labels().invalidRecording : labels().failed
          } finally {
            session.release()
            if (capture === session) { capture = null; recording.value = false; uploading.value = false }
          }
        }
        if (session.released || current !== version) {
          session.cancelled ||= current !== version
          if (!session.finish) { session.finish = true; await session.stop() }
        }
        else session.timer = setTimeout(() => stopRecording(), 30000)
      } catch { if (current === version) error.value = labels().microphone }
      finally {
        if (!session.stop) { session.release(); if (capture === session) { capture = null; recording.value = false } }
      }
    })()
  }

  function cancelRecording() { stopRecording(true) }
  function reset(clear = true) {
    version++
    if (expiryTimer) clearInterval(expiryTimer)
    expiryTimer = null
    stopRecording(true)
    controller?.abort(); controller = null
    capture = null; recording.value = false; uploading.value = false
    stopPlayback()
    if (clear) feed.clear(); else feed.discardAudio()
    sync(); error.value = ''
  }
  function visibility() { if (typeof document !== 'undefined' && document.hidden) cancelRecording() }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility)
  onScopeDispose(() => { reset(); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility) })
  return { questions, recording, uploading, playing, error, event, listen, stopPlayback, startRecording, stopRecording, cancelRecording, reset }
}
