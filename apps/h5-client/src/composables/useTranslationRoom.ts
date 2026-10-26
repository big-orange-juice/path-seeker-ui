import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { RoomEventCursor, type RoomEvent } from '../../../../packages/ts-shared/src/translation-room'
import { startTranslationMic } from '../../../../demos/duplex-translation/public/mic.js'
import { createPcmEncoder } from '../../../../demos/duplex-translation/public/pcm.js'
import { createTranslationPlayer } from '../../../../demos/duplex-translation/public/player.js'
import { roomRequest, roomSocket, type HostPermission, type TranslationRoom } from '@/services/translationRoom'

export function useTranslationRoom() {
  const room = shallowRef<TranslationRoom | null>(null)
  const canHost = ref(false)
  const source = ref('')
  const translated = ref('')
  const notice = ref('选择语言，点击开始收听')
  const error = ref('')
  const busy = ref(false)
  const listening = ref(false)
  const speaking = ref(false)
  const muted = ref(false)
  let context: AudioContext | null = null
  let player: ReturnType<typeof createTranslationPlayer> | null = null
  let microphone: Awaited<ReturnType<typeof startTranslationMic>> | null = null
  let encoder: ReturnType<typeof createPcmEncoder> | null = null
  let events: WebSocket | null = null
  let input: WebSocket | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let revision = 0
  let alive = true
  const cursor = new RoomEventCursor()

  async function perform(action: () => Promise<void>) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try { await action() } catch (failure) { error.value = failure instanceof Error ? failure.message : '操作失败，请重试' }
    finally { busy.value = false }
  }

  async function loadPermission() {
    canHost.value = false
    try { canHost.value = (await roomRequest<HostPermission>('/host-permission')).canHost }
    catch (failure) { error.value = failure instanceof Error ? failure.message : '车夫权限读取失败' }
  }

  function handleEvent(event: RoomEvent) {
    if (!cursor.accept(event)) return
    const payload = event.payload || {}
    if (event.type === 'subscription.ready' || event.type === 'subscription.changed') {
      room.value = payload.room as TranslationRoom
      notice.value = '已加入，等待下一段讲解'
    }
    if (event.type === 'room.snapshot' || event.type === 'room.members.changed') room.value = payload as TranslationRoom
    if (event.type === 'transcript.final') source.value = String(payload.text || '')
    if (event.type === 'translation.committed') translated.value = ''
    if (event.type === 'text.delta') translated.value += String(payload.content || '')
    if (event.type === 'translation.final') translated.value = String(payload.text || '')
    if (event.type === 'audio.started') player?.configure(payload)
    if (event.type === 'audio.delta' && listening.value) player?.push(payload)
    if (event.type === 'audio.done') player?.flush()
    if (event.type === 'audio.error' || event.type === 'language.error') {
      player?.discardPending()
      error.value = String(payload.message || '本段语音不可用，请阅读字幕')
    }
    if (event.type === 'room.paused') notice.value = '车夫暂时离线，讲解暂停'
    if (event.type === 'room.started') notice.value = '讲解中'
    if (event.type === 'room.draining') notice.value = '讲解即将结束，正在接收剩余语音'
    if (event.type === 'room.closed') {
      if (payload.mode === 'immediate') { player?.stop(); listening.value = false }
      notice.value = payload.mode === 'immediate' ? '房间已关闭' : '讲解已结束，剩余语音将继续播放'
      if (room.value) room.value = { ...room.value, status: 'closed' }
      void stopMicrophone(false)
      disconnectEvents()
    }
  }

  function disconnectEvents() {
    revision++
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = null
    events?.close()
    events = null
  }

  function connectEvents() {
    if (!room.value) return
    disconnectEvents()
    const current = revision
    const socket = events = roomSocket(room.value.roomId, 'events')
    socket.onmessage = message => {
      if (current !== revision) return
      try { handleEvent(JSON.parse(message.data)) }
      catch { error.value = '收到的讲解消息无效，请重新收听' }
    }
    socket.onopen = () => {
      if (current !== revision) { socket.close(); return }
      heartbeat = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' })) }, 15000)
    }
    socket.onclose = () => {
      if (current !== revision) return
      disconnectEvents()
      listening.value = false
      notice.value = '连接已断开，点击重新收听；旧语音不会重播'
      void stopMicrophone(false)
    }
    socket.onerror = () => { if (current === revision) error.value = '连接失败，请检查网络后重试' }
  }

  async function unlockAudio() {
    context ??= new AudioContext()
    await context.resume()
    muted.value = false
    player ??= createTranslationPlayer(context, () => {}, failure => {
      error.value = failure.message
      listening.value = false
      disconnectEvents()
    })
    player.configure({ maxQueueSeconds: 120 })
  }

  function create(sourceLanguage: string) {
    return perform(async () => {
      const result = await roomRequest<TranslationRoom>('', { sourceLanguage })
      if (!alive) return
      room.value = result
      notice.value = '房间已创建，点击开始讲解开启麦克风'
      connectEvents()
    })
  }

  function join(code: string, targetLanguage: string) {
    return perform(async () => {
      await unlockAudio()
      disconnectEvents()
      player?.stop()
      const result = await roomRequest<TranslationRoom>('/join', { code, targetLanguage })
      if (!alive) return
      room.value = result
      listening.value = !result.isHost
      connectEvents()
    })
  }

  function startSpeaking() {
    return perform(async () => {
      if (!room.value?.isHost || speaking.value) return
      await unlockAudio()
      const socket = input = roomSocket(room.value.roomId, 'input')
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { socket.close(); reject(Error('麦克风连接超时，请重试')) }, 10000)
        socket.onopen = () => { clearTimeout(timeout); resolve() }
        socket.onerror = socket.onclose = () => { clearTimeout(timeout); reject(Error('麦克风连接失败，请重试')) }
      })
      socket.onclose = () => { if (input === socket) { error.value = '麦克风连接中断，请重新开始讲解'; void stopMicrophone(false) } }
      encoder = createPcmEncoder(context!.sampleRate, packet => {
        if (socket.readyState !== WebSocket.OPEN) return
        if (socket.bufferedAmount > 256000) { socket.close(); throw Error('上传积压，请检查网络后重新开始讲解') }
        socket.send(packet)
      })
      try {
        const capture = await startTranslationMic(context!, frame => encoder?.feed(frame))
        if (!alive || input !== socket || socket.readyState !== WebSocket.OPEN) { await capture.stop(); return }
        microphone = capture
        speaking.value = true
        notice.value = '正在讲解，游客按各自选择的语言收听'
      } catch (failure) { await stopMicrophone(false); throw failure }
    })
  }

  async function stopMicrophone(end: boolean) {
    const capture = microphone
    microphone = null
    await capture?.stop()
    encoder?.flush()
    encoder = null
    speaking.value = false
    const socket = input
    input = null
    if (socket?.readyState === WebSocket.OPEN && end) socket.send(JSON.stringify({ type: 'input.end' }))
    else socket?.close()
  }

  function end(immediate: boolean) {
    return perform(async () => {
      if (!room.value?.isHost) return
      const hadInput = Boolean(input)
      await stopMicrophone(!immediate)
      if (immediate || !hadInput) await roomRequest(`/${room.value.roomId}/${immediate ? 'close' : 'end'}`, {})
    })
  }

  async function leave() {
    const previous = room.value
    disconnectEvents()
    player?.stop()
    listening.value = false
    room.value = null
    await stopMicrophone(false)
    if (previous && !previous.isHost) {
      try { await roomRequest(`/${previous.roomId}/leave`, {}) } catch { }
    }
  }

  async function toggleMute() {
    if (!context || room.value?.isHost) return
    muted.value = !muted.value
    if (muted.value) await context.suspend()
    else await context.resume()
  }

  async function changeLanguage() {
    disconnectEvents()
    player?.stop()
    listening.value = false
    if (room.value) {
      try { await roomRequest(`/${room.value.roomId}/leave`, {}) } catch { }
    }
    notice.value = '当前语音已停止，请选择语言并重新收听'
  }

  onBeforeUnmount(() => { alive = false; void leave().finally(() => context?.close()) })
  return { room, canHost, source, translated, notice, error, busy, listening, speaking, muted, loadPermission, create, join, startSpeaking, end, leave, toggleMute, changeLanguage }
}
