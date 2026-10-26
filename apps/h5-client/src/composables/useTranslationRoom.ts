import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { RoomEventCursor, RoomTextFeed, type RoomEvent, type RoomTextItem } from '../../../../packages/ts-shared/src/translation-room'
import { localizeRoomNotice, roomLocale, roomMessages } from '../../../../packages/ts-shared/src/translation-room-messages'
import { useAuthStore } from '@/stores/useAuthStore'
import { startTranslationMic } from '../../../../demos/duplex-translation/public/mic.js'
import { createPcmEncoder } from '../../../../demos/duplex-translation/public/pcm.js'
import { createTranslationPlayer } from '../../../../demos/duplex-translation/public/player.js'
import { roomRequest, roomSocket, type HostPermission, type TranslationRoom } from '@/services/translationRoom'

export const useTranslationRoomStore = defineStore('translation-room', () => {
  const auth = useAuthStore()
  const room = shallowRef<TranslationRoom | null>(null)
  const canHost = ref(false)
  const permissionPending = shallowRef(true)
  const source = ref('')
  const translated = ref('')
  const language = shallowRef('zh-CN')
  const messages = computed(() => roomMessages(language.value))
  const notice = ref('正在确认账号权限…')
  const error = ref('')
  const displayNotice = computed(() => localizeRoomNotice(notice.value, language.value))
  const displayError = computed(() => localizeRoomNotice(error.value, language.value))
  const busy = ref(false)
  const listening = ref(false)
  const speaking = ref(false)
  const muted = ref(false)
  const audioBlocked = shallowRef(false)
  const audioBusy = shallowRef(false)
  const audioReceived = shallowRef(false)
  const audioError = shallowRef('')
  const audioNotice = computed(() => audioError.value ? localizeRoomNotice(audioError.value, language.value, 'unavailableAudio') : muted.value ? messages.value.muted : audioBlocked.value ? messages.value.blocked : audioBusy.value ? messages.value.playing : audioReceived.value ? messages.value.received : messages.value.waitingAudio)
  const connected = shallowRef(false)
  const navigationPath = shallowRef('/ride')
  const feed = shallowRef<RoomTextItem[]>([])
  const textFeed = new RoomTextFeed()
  let context: AudioContext | null = null
  let player: ReturnType<typeof createTranslationPlayer> | null = null
  let microphone: Awaited<ReturnType<typeof startTranslationMic>> | null = null
  let encoder: ReturnType<typeof createPcmEncoder> | null = null
  let events: WebSocket | null = null
  let input: WebSocket | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let revision = 0
  let alive = true
  let cursor = new RoomEventCursor()
  let sessionVersion = 0

  async function perform(action: () => Promise<void>) {
    if (busy.value) return false
    busy.value = true
    error.value = ''
    try { await action(); return true } catch (failure) { error.value = failure instanceof Error ? failure.message : '操作失败，请重试'; return false }
    finally { busy.value = false }
  }

  async function loadPermission() {
    if (room.value) { canHost.value = room.value.isHost; permissionPending.value = false; return }
    const current = sessionVersion
    permissionPending.value = true
    canHost.value = false
    try {
      const permission = await roomRequest<HostPermission>('/host-permission')
      if (current !== sessionVersion) return
      canHost.value = permission.canHost
      notice.value = canHost.value ? '选择讲话语言，创建或返回讲解房间' : '输入房间码并选择语言，开始收听'
    }
    catch (failure) { if (current === sessionVersion) error.value = failure instanceof Error ? failure.message : '车夫权限读取失败' }
    finally { if (current === sessionVersion) permissionPending.value = false }
  }

  function handleEvent(event: RoomEvent) {
    if (!cursor.accept(event)) return
    feed.value = textFeed.accept(event)
    const payload = event.payload || {}
    if (event.type === 'subscription.ready' || event.type === 'subscription.changed') {
      room.value = payload.room as TranslationRoom
      if (!room.value?.isHost && event.targetLanguage) setLanguage(event.targetLanguage)
      notice.value = '已加入，等待下一段讲解'
    }
    if (event.type === 'room.snapshot' || event.type === 'room.members.changed') room.value = payload as TranslationRoom
    if (event.type === 'transcript.final') source.value = String(payload.text || '')
    if (event.type === 'translation.committed') { translated.value = ''; audioReceived.value = false }
    if (event.type === 'text.delta') translated.value += String(payload.content || '')
    if (event.type === 'translation.final') {
      translated.value = String(payload.text || '')
      if (!room.value?.isHost && translated.value.trim() && !audioReceived.value && !audioError.value) audioError.value = '本段只收到译文，未收到语音，请等待下一段讲解'
    }
    if (event.type === 'audio.started') { audioError.value = ''; player?.configure(payload) }
    if (event.type === 'audio.delta' && listening.value) {
      if (payload.audio) { audioReceived.value = true; audioError.value = '' }
      audioBlocked.value = Boolean(context && context.state !== 'running' && !muted.value)
      player?.push(payload)
    }
    if (event.type === 'audio.done') player?.flush()
    if (event.type === 'segment.error') error.value = String(payload.message || '本段翻译暂不可用')
    if (event.type === 'audio.error' || event.type === 'language.error') {
      player?.discardPending()
      error.value = String(payload.message || '本段语音不可用，请阅读字幕')
      audioError.value = error.value
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
    connected.value = false
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
      connected.value = true
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
    if (!context || context.state === 'closed') {
      player?.stop()
      player = null
      const Context = globalThis.AudioContext || (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Context) throw Error('当前浏览器不支持语音播放，请更换浏览器')
      context = new Context({ latencyHint: 'interactive' })
      context.onstatechange = () => { audioBlocked.value = Boolean(context && context.state !== 'running' && !muted.value && listening.value) }
    }
    muted.value = false
    const resuming = context.resume()
    const primer = context.createBufferSource()
    primer.buffer = context.createBuffer(1, 1, context.sampleRate)
    primer.connect(context.destination)
    primer.onended = () => primer.disconnect()
    primer.start()
    await resuming
    audioBlocked.value = context.state !== 'running'
    player ??= createTranslationPlayer(context, active => { audioBusy.value = active }, failure => {
      player?.stop()
      audioError.value = `译音播放失败：${failure.message || '请点击恢复收听后等待下一段讲解'}`
      audioBlocked.value = true
    })
    player.configure({ maxQueueSeconds: 120 })
  }

  function create(sourceLanguage: string) {
    setLanguage(sourceLanguage)
    return perform(async () => {
      const current = sessionVersion
      const result = await roomRequest<TranslationRoom>('', { sourceLanguage })
      if (!alive || current !== sessionVersion) throw Error('账号或房间已切换，请重试')
      if (room.value?.roomId !== result.roomId) { textFeed.clear(); feed.value = []; source.value = ''; translated.value = '' }
      room.value = result
      cursor = new RoomEventCursor(true)
      notice.value = '房间已创建，点击开始讲解开启麦克风'
      connectEvents()
    })
  }

  function join(code: string, targetLanguage: string) {
    setLanguage(targetLanguage)
    return perform(async () => {
      const current = sessionVersion
      await unlockAudio()
      if (!alive || current !== sessionVersion) throw Error('账号或房间已切换，请重试')
      disconnectEvents()
      player?.stop()
      audioReceived.value = false
      audioError.value = ''
      const result = await roomRequest<TranslationRoom>('/join', { code, targetLanguage })
      if (!alive || current !== sessionVersion) throw Error('账号或房间已切换，请重试')
      if (room.value?.roomId !== result.roomId) { textFeed.clear(); feed.value = []; source.value = ''; translated.value = '' }
      room.value = result
      cursor = new RoomEventCursor(result.isHost)
      listening.value = !result.isHost
      connectEvents()
    })
  }

  function startSpeaking() {
    return perform(async () => {
      if (!room.value?.isHost || speaking.value) return
      const current = sessionVersion
      const roomId = room.value.roomId
      await unlockAudio()
      if (!alive || current !== sessionVersion) return
      const socket = input = roomSocket(roomId, 'input')
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { socket.close(); reject(Error('麦克风连接超时，请重试')) }, 10000)
        socket.onopen = () => { clearTimeout(timeout); resolve() }
        socket.onerror = socket.onclose = () => { clearTimeout(timeout); reject(Error('麦克风连接失败，请重试')) }
      })
      if (!alive || current !== sessionVersion || input !== socket) { socket.close(); return }
      socket.onclose = () => { if (input === socket) { error.value = '麦克风连接中断，请重新开始讲解'; void stopMicrophone(false) } }
      const captureEncoder = encoder = createPcmEncoder(context!.sampleRate, packet => {
        if (socket.readyState !== WebSocket.OPEN) return
        if (socket.bufferedAmount > 256000) { socket.close(); throw Error('上传积压，请检查网络后重新开始讲解') }
        socket.send(packet)
      })
      try {
        const capture = await startTranslationMic(context!, frame => { if (input === socket) captureEncoder.feed(frame) })
        if (!alive || input !== socket || socket.readyState !== WebSocket.OPEN) { await capture.stop(); return }
        microphone = capture
        speaking.value = true
        notice.value = '正在讲解，游客按各自选择的语言收听'
      } catch (failure) { await stopMicrophone(false); throw failure }
    })
  }

  async function stopMicrophone(end: boolean) {
    const capture = microphone
    const captureEncoder = encoder
    const socket = input
    microphone = null
    encoder = null
    speaking.value = false
    input = null
    try { await capture?.stop(); captureEncoder?.flush() }
    finally {
      if (socket?.readyState === WebSocket.OPEN && end) socket.send(JSON.stringify({ type: 'input.end' }))
      else socket?.close()
    }
  }

  function end(immediate: boolean) {
    return perform(async () => {
      if (!room.value?.isHost) return
      const roomId = room.value.roomId
      const current = sessionVersion
      const hadInput = Boolean(input)
      await stopMicrophone(!immediate)
      if (current !== sessionVersion) return
      if (immediate || !hadInput) await roomRequest(`/${roomId}/${immediate ? 'close' : 'end'}`, {})
    })
  }

  async function leave(notifyServer = true) {
    const current = ++sessionVersion
    const previous = room.value
    disconnectEvents()
    player?.stop()
    listening.value = false
    muted.value = false
    audioBlocked.value = false
    audioReceived.value = false
    audioError.value = ''
    room.value = null
    textFeed.clear()
    feed.value = []
    source.value = ''
    translated.value = ''
    notice.value = canHost.value ? '选择讲话语言，创建或返回讲解房间' : '输入房间码并选择语言，开始收听'
    await stopMicrophone(false)
    if (notifyServer && current === sessionVersion && previous && !previous.isHost) {
      try { await roomRequest(`/${previous.roomId}/leave`, {}) } catch { }
    }
  }

  function toggleMute() {
    return perform(async () => {
      if (!context || room.value?.isHost) return
      if (muted.value || audioBlocked.value || audioError.value) {
        await unlockAudio()
        audioError.value = ''
      } else {
        muted.value = true
        await context.suspend()
      }
    })
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

  watch(() => auth.profile?.id, () => { setLanguage('zh-CN'); canHost.value = false; permissionPending.value = true; void leave(false) }, { flush: 'sync' })
  onScopeDispose(() => { alive = false; void leave().finally(() => context?.close()) })
  function setLanguage(value: string) { language.value = roomLocale(value) }

  return { room, canHost, permissionPending, source, translated, notice, error, language, messages, displayNotice, displayError, busy, listening, speaking, muted, audioBlocked, audioNotice, audioReceived, audioError, connected, navigationPath, feed, setLanguage, loadPermission, create, join, startSpeaking, end, leave, toggleMute, changeLanguage }
})

export function useTranslationRoom() {
  const store = useTranslationRoomStore()
  return { ...storeToRefs(store), setLanguage: store.setLanguage, loadPermission: store.loadPermission, create: store.create, join: store.join, startSpeaking: store.startSpeaking, end: store.end, leave: store.leave, toggleMute: store.toggleMute, changeLanguage: store.changeLanguage }
}
