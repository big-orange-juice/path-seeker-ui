import { computed, onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'
import { gcj02ToWgs84 } from '@path-seeker/ts-shared'
import { createTourAudioSession, isTourAudioCancelled, type TourAudioOptions } from '@/services/tourAudioSession'
import { tourAudioMediaUrl, tourAudioRequest } from '@/services/tourAudioApi'
import { getAccessToken } from '@/services/authSession'
import { playbackFocus } from '@/utils/playbackFocus'
import type { useTourJourney } from './useTourJourney'
import type { useTranslationRoom } from './useTranslationRoom'

interface DriverLocation {
  roomId: string
  coordinateSystem: string
  status: string
  longitude: number
  latitude: number
  accuracy: number
  sampledAt: string
  serverTime: string
}

export function useDriverTour(journey: ReturnType<typeof useTourJourney>, room: ReturnType<typeof useTranslationRoom>, asking: Ref<boolean>) {
  const location = shallowRef<{ longitude: number; latitude: number; accuracy: number; heading: null; timestamp: number } | null>(null)
  const locationNotice = shallowRef('正在等待车夫位置')
  const actionError = shallowRef('')
  const available = computed(() => Boolean(room.room.value && !room.room.value.isHost && !['closed', 'draining'].includes(room.room.value.status)))
  const ended = computed(() => Boolean(room.room.value && !room.room.value.isHost && ['closed', 'draining'].includes(room.room.value.status)))
  const managed = computed(() => Boolean(room.room.value && !room.room.value.isHost && room.following.value && !ended.value))
  const focus = playbackFocus.channel('tour', () => { void session.control('hold').catch(() => {}) })
  const session = createTourAudioSession({
    request: tourAudioRequest, mediaUrl: tourAudioMediaUrl, account: getAccessToken, audio: () => new Audio(),
    publish: value => { playback.value = value }, claim: focus.claim, release: focus.release,
    recoverRoom: room.recoverRoom,
  })
  const playback = shallowRef(session.snapshot())
  const options = computed<TourAudioOptions | null>(() => {
    const currentRoom = room.room.value, visit = journey.visit.value, route = journey.active.value?.route
    if (!available.value || !room.following.value || !visit || visit.status !== 1 || !route || visit.routeId !== route.id) return null
    return { roomId: currentRoom!.roomId, visitId: visit.visitId, routeId: route.id, language: journey.locale.value,
      following: true, autoplay: true, skipExtra: journey.skipExtraAudio.value, paused: false,
      roomMuted: room.muted.value, lockContent: false }
  })
  const key = computed(() => options.value ? [getAccessToken(), options.value.roomId, options.value.visitId, options.value.routeId, options.value.language].join('|') : '')
  const status = computed(() => ended.value ? room.displayNotice.value || '车夫已解散房间'
    : !available.value ? '请先加入房间，再跟随车夫'
      : room.recovering.value ? '正在恢复讲解房间'
        : !options.value ? '请先开始当前路线的游览'
          : playback.value.creating ? '正在连接讲解'
            : playback.value.held ? '问答中，讲解暂歇'
              : playback.value.recovering ? '正在重新连接'
                : playback.value.error || actionError.value ? '讲解已中断，请重新连接'
                  : playback.value.paused ? '讲解已暂停，可重新连接继续'
                    : playback.value.playing ? playback.value.audible?.kind === 'room' ? '车夫正在讲解'
                      : playback.value.audible?.kind === 'idle' ? '沿途趣事'
                        : playback.value.audible?.kind === 'route' ? '正在自动讲解' : '跟随中 · 到站自动讲解'
                      : '请点击播放连接讲解')
  let alive = true
  let retrying: Promise<void> | null = null
  let positionVersion = 0
  let positionTimer: ReturnType<typeof setTimeout> | undefined
  let positionExpiry: ReturnType<typeof setTimeout> | undefined
  const visible = () => document.visibilityState !== 'hidden'

  function report(failure: unknown) {
    if (alive && !isTourAudioCancelled(failure)) actionError.value = failure instanceof Error ? failure.message : '讲解连接失败，请重试'
  }

  async function connect(realign = false) {
    const currentOptions = options.value, expectedKey = key.value
    if (!currentOptions || asking.value || !visible()) return
    actionError.value = ''
    if (!room.connected.value) {
      const restored = await room.recoverRoom(currentOptions.roomId)
      if (!restored || !alive || key.value !== expectedKey || asking.value || !visible()) return
    }
    const state = await session.start({ ...currentOptions, paused: realign })
    if (!alive || !state || key.value !== expectedKey || asking.value || !visible()) return
    if (realign) await session.realign()
    else if (playback.value.paused || playback.value.blocked || playback.value.error || !playback.value.playing) await session.resume()
  }

  function reconnect() {
    if (retrying || playback.value.creating || asking.value || ended.value || !options.value) return
    session.unlock()
    const pending = connect(true).catch(report).finally(() => { if (retrying === pending) retrying = null })
    retrying = pending
  }

  function togglePlayback() {
    if (asking.value || ended.value) return
    if (playback.value.playing) void session.control('pause').catch(report)
    else { session.unlock(); void connect().catch(report) }
  }

  function toggleFollowing() {
    if (!available.value || asking.value) return
    room.following.value = !room.following.value
  }

  function pause() { if (playback.value.active) void session.control('pause').catch(report) }

  function visibility(visible: boolean) {
    session.setForeground(visible)
    if (visible && available.value && !room.connected.value) void room.recoverRoom(room.room.value!.roomId).catch(report)
    restartPosition()
  }

  function restartPosition() {
    const version = ++positionVersion
    clearTimeout(positionTimer)
    clearTimeout(positionExpiry)
    location.value = null
    locationNotice.value = ended.value ? '车夫已解散房间' : '正在等待车夫位置'
    const roomId = options.value?.roomId
    if (!roomId || document.visibilityState === 'hidden') return
    const poll = async () => {
      const requestedAt = Date.now()
      try {
        const result = await tourAudioRequest<DriverLocation>(`/TranslationRooms/${encodeURIComponent(roomId)}/location`, 'GET')
        if (!alive || version !== positionVersion) return
        const age = Date.parse(result.serverTime) - Date.parse(result.sampledAt) + Date.now() - requestedAt
        if (result.status === 'closed') { room.finishRoom(); return }
        if (result.status !== 'online' || result.roomId !== roomId || result.coordinateSystem !== 'GCJ-02'
          || !Number.isFinite(age) || age < -2000 || age > 15000
          || !Number.isFinite(result.longitude) || Math.abs(result.longitude) > 180
          || !Number.isFinite(result.latitude) || Math.abs(result.latitude) > 90
          || !Number.isFinite(result.accuracy) || result.accuracy <= 0 || result.accuracy > 500) {
          location.value = null
          locationNotice.value = '正在等待车夫位置'
        } else {
          location.value = { ...gcj02ToWgs84(result), accuracy: result.accuracy, heading: null, timestamp: Date.now() - Math.max(0, age) }
          locationNotice.value = '跟随车夫位置'
          clearTimeout(positionExpiry)
          positionExpiry = setTimeout(() => { location.value = null; locationNotice.value = '正在等待车夫位置' }, Math.max(1, 15000 - age))
        }
      } catch {
        if (version === positionVersion) { location.value = null; locationNotice.value = '车夫位置暂不可用' }
      } finally {
        if (alive && version === positionVersion) positionTimer = setTimeout(poll, 1000)
      }
    }
    void poll()
  }

  watch(managed, value => journey.setServerManaged(value), { immediate: true, flush: 'sync' })
  watch(key, () => {
    session.stop()
    actionError.value = ''
    room.setContinuousAudio(Boolean(options.value))
    restartPosition()
    if (options.value) void session.start({ ...options.value, paused: asking.value || document.visibilityState === 'hidden' }).catch(report)
  }, { immediate: true, flush: 'sync' })
  watch(() => playback.value.state, state => {
    if (state) journey.applyServerPlayback(state.visit, playback.value.audible?.stageId ?? null, state.queue)
  })
  watch(() => playback.value.audible?.stageId, stageId => {
    const state = playback.value.state
    if (state) journey.applyServerPlayback(state.visit, stageId ?? null, state.queue)
  })
  watch(asking, value => {
    if (!playback.value.active) return
    if (value) void session.control('hold').catch(report)
    else if (playback.value.held && !playback.value.paused && document.visibilityState !== 'hidden') void session.resume().catch(report)
  }, { flush: 'sync' })
  watch(() => [room.muted.value, journey.skipExtraAudio.value], () => {
    if (options.value && playback.value.active) void session.control('preferences', { roomMuted: room.muted.value, skipExtra: journey.skipExtraAudio.value }).catch(report)
  })
  onBeforeUnmount(() => {
    alive = false
    positionVersion++
    clearTimeout(positionTimer)
    clearTimeout(positionExpiry)
    session.stop()
    room.setContinuousAudio(false)
  })

  return { managed, available, ended, playback, status, location, locationNotice, actionError,
    toggleFollowing, togglePlayback, reconnect, pause, visibility }
}
