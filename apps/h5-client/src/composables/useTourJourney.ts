import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { isTourLocale, type TourLocale } from '@path-seeker/ts-shared'
import {
  abandonRouteVisit,
  fetchActiveRouteVisit,
  fetchClientCatalog,
  fetchClientTour,
  startRouteVisit,
  updateRouteVisitStop,
} from '@/services/clientCatalog'
import { useTourSpeech } from '@/composables/useTourSpeech'
import { watchLocation, type LocationFix, type LocationWatchHandle, type LocationWatchError } from '@/composables/watchLocation'
import {
  browserCheckpointStorage,
  clearTourCheckpoint,
  isCheckpointValid,
  readTourCheckpoint,
  writeTourCheckpoint,
  type TourInterruptReason,
  type TourPlaybackCheckpoint,
} from '@/utils/tourCheckpoint'
import type { ClientCatalog, ClientTourDetail, ClientTourStop, RouteVisit } from '@/types/clientCatalog'

/** C 端"跳过额外音频"开关的本地持久化键（只存本地，不回写 B 端配置） */
const SKIP_EXTRA_AUDIO_KEY = 'path-seeker:skip-extra-audio'
const AUTO_PLAY_KEY = 'path-seeker:tour-auto-play'
/** 最近一次进行中的游览：重挂载时用它调 RouteVisit/Active 恢复（方案 §5.3） */
const ACTIVE_ROUTE_KEY = 'path-seeker:tour-active-route'
const PLAYBACK_SEQUENCE_KEY_PREFIX = 'path-seeker:tour-playback-sequence'

/** 内容抽屉的打开来源（方案 §3.1） */
export type ContentDrawerOpenReason = 'manual' | 'automatic' | 'map-selection' | 'deep-link' | 'voice-ask' | 'playback'

/** 节点选择模式（方案 §4.4）：决定是否写进度、播完是否自动前进 */
export type StopSelectionMode = 'manual' | 'previous' | 'next' | 'automatic' | 'resume'

/** 全局景点播放序列中的状态；自动入队后同一游览内不再重复入队。 */
export type PlaybackSequenceStatus = 'queued' | 'playing' | 'completed' | 'skipped'

export interface PlaybackSequenceItem {
  stopId: string
  index: number
  status: PlaybackSequenceStatus
  source: 'manual'
  queuedAt: number
}

interface StoredActiveRoute {
  routeId: string
  stageId: string | null
  locale: TourLocale
  updatedAt: number
}

function readSkipExtraAudio() {
  try { return localStorage.getItem(SKIP_EXTRA_AUDIO_KEY) === '1' } catch { return false }
}

function readAutoPlay() {
  return false
}

function readStoredActiveRoute(): StoredActiveRoute | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ROUTE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredActiveRoute>
    if (!parsed?.routeId || !isTourLocale(parsed.locale)) return null
    return {
      routeId: String(parsed.routeId),
      stageId: parsed.stageId ? String(parsed.stageId) : null,
      locale: parsed.locale,
      updatedAt: Number.isFinite(parsed.updatedAt) ? Number(parsed.updatedAt) : 0,
    }
  } catch {
    return null
  }
}

function writeStoredActiveRoute(value: StoredActiveRoute | null) {
  try {
    if (!value) localStorage.removeItem(ACTIVE_ROUTE_KEY)
    else localStorage.setItem(ACTIVE_ROUTE_KEY, JSON.stringify(value))
  } catch {
    // ignore
  }
}

function playbackSequenceKey(routeId: string | null | undefined, visitId: string | null | undefined) {
  return routeId && visitId ? `${PLAYBACK_SEQUENCE_KEY_PREFIX}:${routeId}:${visitId}` : ''
}

function indexOfStop(stops: ClientTourStop[], stopId: string | null | undefined) {
  if (!stopId) return -1
  return stops.findIndex(stop => stop.id === stopId)
}

export function useTourJourney() {
  const locale = shallowRef<TourLocale>('zh')
  const languageReady = shallowRef(false)
  const catalog = shallowRef<ClientCatalog | null>(null)
  const preview = shallowRef<ClientTourDetail | null>(null)
  const active = shallowRef<ClientTourDetail | null>(null)
  const visit = shallowRef<RouteVisit | null>(null)
  const currentIndex = shallowRef(0)
  /** 跨景点的统一自动播放序列；景点内部的 before/chapter/after 仍由 useTourSpeech 管理。 */
  const playbackSequence = shallowRef<PlaybackSequenceItem[]>([])
  const autoPlayEnabled = shallowRef(readAutoPlay())
  const contentAutoSwitchLocked = shallowRef(false)
  const guideId = shallowRef<string | null>(null)
  const pending = shallowRef(false)
  const stopPending = shallowRef(false)
  const busy = computed(() => pending.value || stopPending.value)
  const error = shallowRef('')
  const location = shallowRef<{ longitude: number; latitude: number; accuracy: number; heading: number | null; timestamp: number } | null>(null)
  const locationError = shallowRef(false)
  /** 定位权限被拒与"暂时没拿到定位"是两种处置：前者只能引导用户改设置，后者要提示当前精度 */
  const locationPermissionDenied = shallowRef(false)
  const tracking = shallowRef(false)
  /** 本次游览内已播过的前置额外音频：切换导游不重复播放，显式"重新播放整站"时清空 */
  const playedBeforeExtraIds = new Set<string>()
  /** "跳过额外音频"开关：本次游览内保持，并持久化到本地 */
  const skipExtraAudio = shallowRef(readSkipExtraAudio())
  const stops = computed(() => [...(active.value?.stops ?? [])].sort((left, right) => left.order - right.order))
  const currentStop = computed(() => stops.value[currentIndex.value] ?? null)
  const playbackSuppressed = shallowRef(false)
  const narrations = computed(() => currentStop.value?.guideNarrations?.filter(item => item.locale === locale.value) ?? [])
  const narration = computed(() => narrations.value.find(item => item.guideId === guideId.value) ?? narrations.value[0] ?? null)
  // ==================== 抽屉与选择模式 ====================
  const drawerOpen = shallowRef(false)
  const drawerReason = shallowRef<ContentDrawerOpenReason>('manual')
  /** 抽屉展示的节点可以是"接近但还没切站"的节点，与正在播放的节点区分（方案 §7.5） */
  const drawerStopId = shallowRef<string | null>(null)
  const selectionMode = shallowRef<StopSelectionMode>('manual')
  const drawerStop = computed(() => {
    const id = drawerStopId.value
    if (!id) return currentStop.value
    return stops.value.find(stop => stop.id === id) ?? currentStop.value
  })
  const drawerIndex = computed(() => stops.value.findIndex(stop => stop.id === drawerStop.value?.id))
  /** 抽屉展示的节点是否就是正在播放的节点：否则抽屉只做展示，播放控制仍作用在当前节点 */
  const drawerMatchesPlaying = computed(() => Boolean(drawerStop.value && currentStop.value && drawerStop.value.id === currentStop.value.id))
  const drawerNarrations = computed(() => drawerStop.value?.guideNarrations?.filter(item => item.locale === locale.value) ?? [])
  const drawerNarration = computed(() => drawerNarrations.value.find(item => item.guideId === (drawerMatchesPlaying.value ? guideId.value : null)) ?? drawerNarrations.value[0] ?? null)
  /** 已恢复进行中游览：页面据此直接进入行程视图 */
  const journeyRestored = shallowRef(false)

  let loadVersion = 0
  let previewVersion = 0
  let journeyVersion = 0
  /** 当前定位监听句柄：由 watchLocation 管理"快速首帧 + 高精度改善"两条通道 */
  let locationWatch: LocationWatchHandle | null = null
  let alive = true
  /** 语音问答打断现场：问答结束据此决定恢复 */
  let askInterrupt: { token: number; routeId: string; stageId: string; wasPlaying: boolean } | null = null
  /** 切后台现场：回到前台据此决定恢复 */
  let backgroundResume: { routeId: string; stageId: string; wasPlaying: boolean } | null = null
  const checkpointStorage = browserCheckpointStorage()
  const previousQueueFinished = shallowRef(0)

  const speech = useTourSpeech(() => { void handleQueueFinished() })

  function sequenceItemOf(stopId: string | null | undefined) {
    return stopId ? playbackSequence.value.find(item => item.stopId === stopId) ?? null : null
  }

  function persistPlaybackSequence() {
    const key = playbackSequenceKey(active.value?.route?.id, visit.value?.visitId)
    if (!key) return
    try { localStorage.setItem(key, JSON.stringify(playbackSequence.value)) } catch {}
  }

  function restorePlaybackSequence(routeId: string, visitId: string, restoredStops: ClientTourStop[]) {
    const key = playbackSequenceKey(routeId, visitId)
    if (!key) return
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return
      playbackSequence.value = parsed.flatMap((entry): PlaybackSequenceItem[] => {
        if (!entry || typeof entry !== 'object') return []
        const candidate = entry as Partial<PlaybackSequenceItem>
        if (typeof candidate.stopId !== 'string') return []
        const index = indexOfStop(restoredStops, candidate.stopId)
        if (index < 0) return []
        if (candidate.status !== 'completed' && candidate.status !== 'skipped') return []
        const status = candidate.status
        const source = 'manual'
        return [{
          stopId: candidate.stopId,
          index,
          status,
          source,
          queuedAt: Number.isFinite(candidate.queuedAt) ? Number(candidate.queuedAt) : Date.now(),
        }]
      })
    } catch {
      playbackSequence.value = []
    }
  }

  function clearStoredPlaybackSequence() {
    const key = playbackSequenceKey(active.value?.route?.id, visit.value?.visitId)
    if (!key) return
    try { localStorage.removeItem(key) } catch {}
  }

  function resetPlaybackSequence() {
    playbackSequence.value = []
  }

  function updateSequenceItem(stopId: string, status: PlaybackSequenceStatus) {
    playbackSequence.value = playbackSequence.value.map(item => item.stopId === stopId ? { ...item, status } : item)
    persistPlaybackSequence()
  }

  /** 入队即去重：只有显式重播才会绕过这个自动序列。 */
  function enqueuePlaybackStop(index: number, source: PlaybackSequenceItem['source']) {
    const stop = stops.value[index]
    if (!stop) return null
    const existing = sequenceItemOf(stop.id)
    if (existing) return existing
    const item: PlaybackSequenceItem = {
      stopId: stop.id,
      index,
      status: 'queued',
      source,
      queuedAt: Date.now(),
    }
    playbackSequence.value = [...playbackSequence.value, item]
    persistPlaybackSequence()
    return item
  }

  function markInterruptedSequence() {
    if (speech.status.value === 'idle') return
    const current = sequenceItemOf(currentStop.value?.id)
    if (current?.status === 'playing') updateSequenceItem(current.stopId, 'skipped')
  }

  function rememberLanguage(value: TourLocale) {
    locale.value = value
    languageReady.value = true
    try { localStorage.setItem('path-seeker:tour-locale', value) } catch {}
  }

  function restoreLanguage(queryLanguage: unknown) {
    let remembered: string | null = null
    try { remembered = localStorage.getItem('path-seeker:tour-locale') } catch {}
    if (isTourLocale(queryLanguage)) rememberLanguage(queryLanguage)
    else if (isTourLocale(remembered)) rememberLanguage(remembered)
  }

  // ==================== 断点（方案 §5） ====================

  function currentStageId() {
    return currentStop.value?.id ?? active.value?.route?.id ?? ''
  }

  function buildCheckpoint(interruptedBy: TourInterruptReason): TourPlaybackCheckpoint | null {
    const route = active.value?.route
    const stop = currentStop.value
    if (!route || !stop) return null
    const snapshot = speech.captureCheckpoint()
    return {
      routeId: route.id,
      stageId: stop.id,
      guideId: guideId.value,
      skipExtraAudio: skipExtraAudio.value,
      locale: locale.value,
      itemId: snapshot.itemId,
      itemType: snapshot.itemType,
      queueIndex: snapshot.queueIndex,
      currentTimeSeconds: snapshot.currentTimeSeconds,
      sentenceIndex: snapshot.sentenceIndex,
      statusBeforeInterrupt: snapshot.status,
      interruptedBy,
      updatedAt: Date.now(),
    }
  }

  /** 保存断点：问答打断、手动暂停、切后台都走这里 */
  function saveCheckpoint(interruptedBy: TourInterruptReason) {
    const checkpoint = buildCheckpoint(interruptedBy)
    if (checkpoint) writeTourCheckpoint(checkpointStorage, checkpoint)
  }

  function clearCheckpoint() {
    const route = active.value?.route
    const stop = currentStop.value
    if (route && stop) clearTourCheckpoint(checkpointStorage, route.id, stop.id)
  }

  /** 读取当前节点的断点，并按 §5.4 的规则校验是否仍然有效 */
  function readValidCheckpoint(): TourPlaybackCheckpoint | null {
    const route = active.value?.route
    const stop = currentStop.value
    if (!route || !stop) return null
    const checkpoint = readTourCheckpoint(checkpointStorage, route.id, stop.id)
    const valid = isCheckpointValid(checkpoint, {
      routeId: route.id,
      stageId: stop.id,
      guideId: guideId.value,
      skipExtraAudio: skipExtraAudio.value,
      locale: locale.value,
    })
    return valid ? checkpoint : null
  }

  // ==================== 播放 ====================

  /** 构建并播放当前站点队列；replayAll 表示显式"重新播放整站"，前置音频也重跑 */
  function playCurrentStop(replayAll = false, resume?: Parameters<typeof speech.play>[4]) {
    if (replayAll) playedBeforeExtraIds.clear()
    const browsing = selectionMode.value === 'previous' || selectionMode.value === 'next'
    speech.play(currentStop.value, narration.value?.chapters ?? [], locale.value, {
      skipExtraAudio: skipExtraAudio.value,
      playedBeforeExtraIds,
      // 浏览模式：前置额外音频不去重（方案 §4.4）
      skipBeforeAudioDedupe: browsing,
    }, resume ?? null)
    if (speech.status.value === 'playing' && (selectionMode.value !== 'automatic' || !contentAutoSwitchLocked.value)) openContentDrawer(currentIndex.value, 'playback')
  }

  /** 断点恢复：位置来自 sessionStorage；"暂停中"的断点恢复出条目后保持暂停 */
  function restorePlaybackFromCheckpoint() {
    const checkpoint = readValidCheckpoint()
    if (!checkpoint) return false
    if (selectionMode.value === 'previous' || selectionMode.value === 'next') return false
    playCurrentStop(false, {
      queueIndex: checkpoint.queueIndex,
      itemId: checkpoint.itemId,
      currentTimeSeconds: checkpoint.currentTimeSeconds,
      sentenceIndex: checkpoint.sentenceIndex,
      paused: true,
    })
    selectionMode.value = 'resume'
    return true
  }

  /** "跳过额外音频"开关：本地持久化，且不打断正在播放的队列，只影响下一次构建 */
  function setSkipExtraAudio(value: boolean) {
    if (value === skipExtraAudio.value || busy.value) return
    const paused = speech.status.value !== 'playing'
    invalidateInterrupts()
    skipExtraAudio.value = value
    clearCheckpoint()
    try { localStorage.setItem(SKIP_EXTRA_AUDIO_KEY, value ? '1' : '0') } catch {}
    playCurrentStop(false, { queueIndex: 0, itemId: null, currentTimeSeconds: 0, sentenceIndex: 0, paused })
  }

  function setAutoPlayEnabled(value: boolean) {
    autoPlayEnabled.value = value
    try { localStorage.setItem(AUTO_PLAY_KEY, value ? '1' : '0') } catch {}
    if (value && speech.status.value === 'idle') void startNextPlaybackSequence()
  }

  function setContentAutoSwitchLocked(value: boolean) {
    if (value) drawerStopId.value = drawerStop.value?.id ?? null
    contentAutoSwitchLocked.value = value
  }

  function invalidateInterrupts() {
    journeyVersion += 1
    askInterrupt = null
    backgroundResume = null
  }

  // ==================== 抽屉 ====================

  function openContentDrawer(index: number, reason: ContentDrawerOpenReason) {
    const stop = stops.value[index]
    if (!stop) return
    if (reason === 'automatic' && contentAutoSwitchLocked.value) return
    drawerStopId.value = stop.id
    drawerReason.value = reason
    drawerOpen.value = true
  }

  function closeContentDrawer() {
    drawerOpen.value = false
  }

  function toggleContentDrawer() {
    if (drawerOpen.value) {
      closeContentDrawer()
      return
    }
    // 手动重开时展示"正在播放的节点"，避免留在上一次接近候选上
    openContentDrawer(currentIndex.value, 'manual')
  }

  // ==================== 载入与游览恢复 ====================

  async function restoreJourneyFromVisit(routes: { id: string; locale: TourLocale }[], selectedRouteId = '') {
    const stored = readStoredActiveRoute()
    const routeId = selectedRouteId || (stored?.locale === locale.value ? stored.routeId : '')
    if (!routeId) return false
    // 显式深链到别的路线时不抢：只有没指定路线、或指定的就是那条进行中路线才恢复
    if (!routes.some(route => route.id === routeId)) return false
    try {
      const activeVisit = await fetchActiveRouteVisit(routeId)
      if (!activeVisit || activeVisit.status !== 1) {
        writeStoredActiveRoute(null)
        return false
      }
      const detail = await fetchClientTour(routeId, locale.value)
      if (!alive || detail.route?.locale !== locale.value) return false
      active.value = detail
      visit.value = activeVisit
      const restoredStops = [...(detail.stops ?? [])].sort((left, right) => left.order - right.order)
      restorePlaybackSequence(routeId, activeVisit.visitId, restoredStops)
      const stageIndex = indexOfStop(restoredStops, activeVisit.currentStageId) >= 0
        ? indexOfStop(restoredStops, activeVisit.currentStageId)
        : indexOfStop(restoredStops, stored?.routeId === routeId ? stored.stageId : null)
      currentIndex.value = Math.max(0, stageIndex)
      const restoredStop = restoredStops[currentIndex.value]
      const checkpoint = restoredStop ? readTourCheckpoint(checkpointStorage, routeId, restoredStop.id) : null
      guideId.value = checkpoint?.locale === locale.value && restoredStop?.guideNarrations?.some(item => item.locale === locale.value && item.guideId === checkpoint.guideId)
        ? checkpoint.guideId : null
      writeStoredActiveRoute({ routeId, stageId: restoredStop?.id ?? null, locale: locale.value, updatedAt: Date.now() })
      journeyRestored.value = true
      return true
    } catch {
      return false
    }
  }

  async function load(destinationId: string, selectedRouteId = '') {
    const version = ++loadVersion
    previewVersion += 1
    catalog.value = null
    preview.value = null
    pending.value = true
    error.value = ''
    try {
      const response = await fetchClientCatalog(destinationId, locale.value)
      if (!alive || version !== loadVersion) return
      catalog.value = response
      const routes = response.routes?.filter(item => item.locale === locale.value) ?? []
      // 优先恢复进行中的游览；没有才走"选路线 → 预览"流程
      if (await restoreJourneyFromVisit(routes, selectedRouteId)) {
        // 游览恢复后接着按 sessionStorage 断点续上播放位置（方案 §5.3）
        const resumed = restorePlaybackFromCheckpoint()
        pending.value = false
        if (!resumed) void startNextPlaybackSequence()
        return
      }
      const selected = routes.find(item => item.id === selectedRouteId)
      if (selectedRouteId && !selected) error.value = 'routeUnavailable'
      if (selected || routes[0]) await selectRoute((selected || routes[0])!.id)
    } catch (caught) {
      if (version === loadVersion) error.value = caught instanceof Error ? caught.message : 'loadFailed'
    } finally { if (version === loadVersion) pending.value = false }
  }

  async function selectRoute(id: string) {
    const version = ++previewVersion
    preview.value = null
    try {
      const response = await fetchClientTour(id, locale.value)
      if (!alive || version !== previewVersion) return
      if (response.route?.locale !== locale.value) throw new Error('routeUnavailable')
      preview.value = response
    } catch (caught) { if (version === previewVersion) error.value = caught instanceof Error ? caught.message : 'loadFailed' }
  }

  async function start() {
    const selected = preview.value
    if (busy.value || !selected?.route || !selected.stops?.length) return false
    pending.value = true
    error.value = ''
    try {
      if (visit.value?.status === 1 && visit.value.routeId !== selected.route.id) await abandonRouteVisit(visit.value)
      const response = await startRouteVisit(selected.route.id, locale.value)
      if (!alive) return false
      journeyVersion += 1
      speech.stop()
      playedBeforeExtraIds.clear()
      clearStoredPlaybackSequence()
      resetPlaybackSequence()
      active.value = selected
      visit.value = response
      currentIndex.value = Math.max(0, stops.value.findIndex(stop => stop.id === response.currentStageId))
      journeyRestored.value = false
      writeStoredActiveRoute({ routeId: selected.route.id, stageId: currentStop.value?.id ?? null, locale: locale.value, updatedAt: Date.now() })
      await enterStop(currentIndex.value, 'resume')
      return true
    } catch (caught) { error.value = caught instanceof Error ? caught.message : 'startFailed'; return false }
    finally { pending.value = false }
  }

  // ==================== 切站 ====================

  /** 正式切站（manual / automatic 自动开始）：写 currentStageId，构建并播放新队列，但不标记完成 */
  async function enterStop(index: number, reason: 'manual' | 'automatic' | 'resume' = 'manual', sequenceStopId: string | null = null) {
    const stop = stops.value[index]
    const currentVisit = visit.value
    if (!stop || !currentVisit) return
    stopPending.value = true
    const version = ++journeyVersion
    clearCheckpoint()
    if (!sequenceStopId) markInterruptedSequence()
    speech.stop()
    error.value = ''
    currentIndex.value = index
    guideId.value = null
    selectionMode.value = reason === 'automatic' ? 'automatic' : 'manual'
    if (reason !== 'automatic' || !contentAutoSwitchLocked.value) drawerStopId.value = stop.id
    try {
      if (currentVisit.status === 1) {
        const response = await updateRouteVisitStop(currentVisit, stop.id, 'start')
        if (!alive || version !== journeyVersion) return
        visit.value = response
      }
      writeStoredActiveRoute({ routeId: active.value?.route?.id ?? '', stageId: stop.id, locale: locale.value, updatedAt: Date.now() })
      if (alive && version === journeyVersion) {
        if (reason !== 'resume') {
          playCurrentStop()
          enqueuePlaybackStop(index, 'manual')
          updateSequenceItem(stop.id, 'playing')
        }
      }
    } catch (caught) { if (version === journeyVersion) error.value = caught instanceof Error ? caught.message : 'saveFailed' }
    finally { stopPending.value = false }
  }

  /** 用户点击站点 / 地图选择 / 抽屉切站：写进度并播放 */
  async function selectStop(index: number) {
    if (stopPending.value) return
    await enterStop(index, 'manual')
  }

  /**
   * 上一节点 / 下一节点浏览（方案 §4.4）：
   * 只切本地播放节点，不写服务端进度、不标记完成、播完不自动前进、前置额外音频不去重。
   */
  function browseBy(delta: -1 | 1) {
    if (busy.value || !active.value) return
    const target = currentIndex.value + delta
    if (target < 0 || target >= stops.value.length) return
    const stop = stops.value[target]
    if (!stop) return
    journeyVersion += 1
    clearCheckpoint()
    markInterruptedSequence()
    speech.stop()
    error.value = ''
    currentIndex.value = target
    guideId.value = null
    selectionMode.value = delta < 0 ? 'previous' : 'next'
    drawerStopId.value = stop.id
    playCurrentStop()
  }

  const previousStop = () => browseBy(-1)
  const nextStop = () => browseBy(1)
  const canGoPrevious = computed(() => currentIndex.value > 0)
  const canGoNext = computed(() => currentIndex.value < stops.value.length - 1)
  /** 浏览模式下的提示：不切换行程进度 */
  const browsing = computed(() => selectionMode.value === 'previous' || selectionMode.value === 'next')

  /**
   * 队列结束（讲解章节真的播完，含后置额外音频）：
   * - 浏览模式：停在本节点 idle，不写完成、不前进；
   * - 其他模式：先标记完成（完成与切站解耦），再按自动推进模式决定是否切下一站。
   */
  async function handleQueueFinished() {
    previousQueueFinished.value += 1
    if (selectionMode.value === 'previous' || selectionMode.value === 'next') return
    const stop = currentStop.value
    const currentVisit = visit.value
    if (!stop || !currentVisit || currentVisit.status !== 1 || busy.value) return
    const sequenceItem = sequenceItemOf(stop.id)
    const version = journeyVersion
    pending.value = true
    let continueSequence = false
    try {
      const response = await updateRouteVisitStop(currentVisit, stop.id, 'complete', 2)
      if (!alive || version !== journeyVersion) return
      visit.value = response
      if (response.status !== 1) {
        // 最后一站：结束行程
        if (sequenceItem) updateSequenceItem(stop.id, 'completed')
        speech.stop()
        stopTracking()
        writeStoredActiveRoute(null)
        return
      }
      if (sequenceItem) updateSequenceItem(stop.id, 'completed')
      if (playbackSequence.value.some(item => item.status === 'queued')) {
        continueSequence = true
        return
      }
      const next = currentIndex.value + 1
      if (next < stops.value.length && autoPlayEnabled.value && !playbackSuppressed.value) await enterStop(next, 'automatic')
    } catch (caught) {
      if (version === journeyVersion) error.value = caught instanceof Error ? caught.message : 'saveFailed'
    } finally {
      if (alive) pending.value = false
      if (alive && continueSequence) void startNextPlaybackSequence()
    }
  }

  /** 用户点"完成本节点"：标记完成并按现有规则进入下一站 */
  async function completeStop() {
    const stop = currentStop.value
    const currentVisit = visit.value
    if (!stop || !currentVisit || currentVisit.status !== 1 || busy.value) return
    const version = journeyVersion
    pending.value = true
    error.value = ''
    try {
      const response = await updateRouteVisitStop(currentVisit, stop.id, 'complete', 1)
      if (!alive || version !== journeyVersion) return
      visit.value = response
      const next = currentIndex.value + 1
      if (response.status === 1 && next < stops.value.length) await enterStop(next, 'manual')
      else {
        speech.stop()
        stopTracking()
        writeStoredActiveRoute(null)
      }
    } catch (caught) { if (version === journeyVersion) error.value = caught instanceof Error ? caught.message : 'saveFailed' }
    finally { if (alive) pending.value = false }
  }

  function togglePlayback() {
    if (busy.value) return
    if (speech.status.value === 'playing') {
      invalidateInterrupts()
      speech.pause()
      saveCheckpoint('manual')
      return
    }
    if (speech.status.value === 'paused') {
      speech.resume()
      return
    }
    // 空闲时：当前节点已听完则接着播下一站
    const stop = currentStop.value
    const completed = visit.value?.completedStageIds ?? []
    if (browsing.value) { playCurrentStop(true); return }
    if (playbackSequence.value.some(item => item.status === 'queued')) {
      void startNextPlaybackSequence(true)
      return
    }
    if (stop && completed.includes(stop.id) && currentIndex.value + 1 < stops.value.length) {
      void enterStop(currentIndex.value + 1, 'manual')
      return
    }
    // 其余情况视为显式重播整站：前置额外音频也重跑
    selectionMode.value = 'manual'
    playCurrentStop(true)
  }

  /** 显式"重新播放整站"：清空已播记录与旧断点后重跑完整队列 */
  function replayCurrentStop() {
    if (busy.value) return
    clearCheckpoint()
    invalidateInterrupts()
    playCurrentStop(true)
  }

  /** 切换导游：只替换讲解内容，额外音频配置与"已播过的前置音频"都保留 */
  function selectGuide(id: string | null) {
    if (busy.value) return
    const paused = speech.status.value !== 'playing'
    invalidateInterrupts()
    guideId.value = id
    clearCheckpoint()
    playCurrentStop(false, { queueIndex: 0, itemId: null, currentTimeSeconds: 0, sentenceIndex: 0, paused })
  }

  /** 单独播放一条额外音频：站点没有讲解章节时也能用 */
  function playExtraAudio(id: string) {
    if (busy.value) return
    const stop = currentStop.value
    const extraAudio = stop?.extraAudios?.find(item => item.id === id)
    if (!stop || !extraAudio) return
    invalidateInterrupts()
    speech.playExtra(stop, extraAudio, locale.value)
  }

  /** ±15 秒：两处入口（底部控制条 / 内容抽屉）共用 */
  function seekBy(deltaSeconds: number) {
    if (busy.value) return { moved: false, precision: 'unavailable' as const, reason: 'idle' as const }
    const result = speech.seekBy(deltaSeconds)
    if (result.moved) saveCheckpoint('manual')
    return result
  }

  /** 自动播放被阻止时由"继续播放"入口调用 */
  function resumePlayback() {
    if (busy.value) return
    speech.resume()
  }

  // ==================== 语音问答打断与恢复（方案 §5.2） ====================

  /** 打开问一问前调用：保存断点并暂停（保留队列与位置，不打断用户意图） */
  function beginAskInterrupt() {
    const stageId = currentStageId()
    if (!active.value?.route || !stageId) return
    const wasPlaying = speech.status.value === 'playing'
    if (wasPlaying) saveCheckpoint('voice-ask')
    askInterrupt = { token: journeyVersion, routeId: active.value.route.id, stageId, wasPlaying }
    speech.pause()
  }

  /**
   * 问答收尾调用：问答前在播就尽量自动恢复；前提是没有切站、断点仍属于当前节点。
   * 返回 `resumed` / `blocked-paused` / `noop`，页面据此决定是否提示"继续"。
   */
  function endAskInterrupt(): 'resumed' | 'blocked-paused' | 'noop' {
    const snapshot = askInterrupt
    askInterrupt = null
    if (!snapshot || !snapshot.wasPlaying) return 'noop'
    if (snapshot.routeId !== active.value?.route?.id) return 'noop'
    if (snapshot.stageId !== currentStageId()) return 'noop'
    if (snapshot.token !== journeyVersion) return 'noop'
    return resumeRouteNarration()
  }

  /**
   * 尽量自动恢复路线讲解：
   * - 队列还在（paused）→ 直接 continue；
   * - 队列已被清掉（页面重建 / 语音问答期间切走又回来）→ 按断点重建后 continue；
   * - 被浏览器阻止自动播放时返回 `blocked-paused`，由页面提示"继续播放"。
   */
  function resumeRouteNarration(): 'resumed' | 'blocked-paused' | 'noop' {
    const before = speech.status.value
    if (before === 'playing') return 'noop'
    if (before === 'idle') {
      if (!restorePlaybackFromCheckpoint()) return 'noop'
    }
    if (speech.status.value !== 'paused') return 'noop'
    speech.resume()
    return speech.blocked.value ? 'blocked-paused' : 'resumed'
  }

  // ==================== 切后台（方案 §5.4） ====================

  function handleVisibilityHidden() {
    const route = active.value?.route
    const stageId = currentStageId()
    if (!route || !stageId) return
    const wasPlaying = speech.status.value === 'playing'
    backgroundResume = { routeId: route.id, stageId, wasPlaying }
    if (wasPlaying) {
      // 播放中：先按"播放中"存断点，再暂停，回到前台才能自动恢复（方案 §5.4）
      saveCheckpoint('page-hide')
      speech.pause()
      return
    }
    // 已经是暂停态：只保存位置，回到前台不自动播放
    if (speech.status.value === 'paused') saveCheckpoint('page-hide')
  }

  /** 回到前台：尽量自动恢复，被浏览器拦截时返回 blocked-paused，由页面提示"继续" */
  function handleVisibilityVisible(): 'resumed' | 'blocked-paused' | 'noop' {
    const snapshot = backgroundResume
    backgroundResume = null
    if (!snapshot?.wasPlaying) return 'noop'
    if (snapshot.routeId !== active.value?.route?.id) return 'noop'
    if (snapshot.stageId !== currentStageId()) return 'noop'
    return resumeRouteNarration()
  }

  /** 播放全局序列中下一个尚未开始的景点；当前景点播放期间只追加，不打断。 */
  async function startNextPlaybackSequence(force = false) {
    if (busy.value || visit.value?.status !== 1 || speech.status.value !== 'idle' || (!force && (!autoPlayEnabled.value || playbackSuppressed.value || browsing.value))) return
    const next = playbackSequence.value.find(item => item.status === 'queued')
    if (!next) return
    await enterStop(next.index, 'automatic', next.stopId)
  }

  async function playQueuedStop(stopId: string) {
    if (busy.value || visit.value?.status !== 1) return
    const item = sequenceItemOf(stopId)
    if (!item || item.status !== 'queued') return
    markInterruptedSequence()
    await enterStop(item.index, 'manual', item.stopId)
  }

  function skipQueuedStop(stopId: string) {
    const item = sequenceItemOf(stopId)
    if (!item || item.status !== 'queued') return
    updateSequenceItem(stopId, 'skipped')
    if (speech.status.value === 'idle') void startNextPlaybackSequence()
  }

  function stopTracking() {
    locationWatch?.stop()
    locationWatch = null
    tracking.value = false
    location.value = null
    locationPermissionDenied.value = false
  }

  function startTracking() {
    if (tracking.value) return
    if (!navigator.geolocation) { locationError.value = true; return }
    tracking.value = true
    locationError.value = false
    locationPermissionDenied.value = false
    locationWatch = watchLocation({
      onFix: (fix: LocationFix) => {
        location.value = fix
        locationError.value = false
        locationPermissionDenied.value = false
      },
      onError: (error: LocationWatchError) => {
        if (error.code === 'denied') stopTracking()
        locationPermissionDenied.value = error.code === 'denied'
        locationError.value = true
      },
    })
  }

  function setPlaybackSuppressed(value: boolean) {
    playbackSuppressed.value = value
    if (!value) void startNextPlaybackSequence()
  }

  async function end() {
    if (busy.value) return false
    pending.value = true
    error.value = ''
    speech.pause()
    try {
      if (visit.value?.status === 1) await abandonRouteVisit(visit.value)
      journeyVersion += 1
      speech.stop()
      playedBeforeExtraIds.clear()
      clearStoredPlaybackSequence()
      resetPlaybackSequence()
      stopTracking()
      clearCheckpoint()
      writeStoredActiveRoute(null)
      active.value = null
      visit.value = null
      drawerOpen.value = false
      drawerStopId.value = null
      journeyRestored.value = false
      return true
    } catch (caught) { error.value = caught instanceof Error ? caught.message : 'saveFailed'; return false }
    finally { pending.value = false }
  }

  onBeforeUnmount(() => {
    // 离开页面（切到问一问全页、返回地图）时保存断点，回来后可以续播（方案 §5.3）
    if (active.value?.route && visit.value?.status === 1 && !askInterrupt?.wasPlaying && !backgroundResume?.wasPlaying) saveCheckpoint('page-hide')
    persistPlaybackSequence()
    alive = false
    journeyVersion += 1
    loadVersion += 1
    previewVersion += 1
    stopTracking()
  })

  return {
    locale,
    languageReady,
    catalog,
    preview,
    active,
    visit,
    currentIndex,
    playbackSequence,
    autoPlayEnabled,
    contentAutoSwitchLocked,
    stops,
    currentStop,
    narrations,
    narration,
    pending: busy,
    error,
    location,
    locationError,
    locationPermissionDenied,
    tracking,
    speech,
    skipExtraAudio,
    setSkipExtraAudio,
    setAutoPlayEnabled,
    setContentAutoSwitchLocked,
    rememberLanguage,
    restoreLanguage,
    load,
    selectRoute,
    start,
    selectStop,
    enterStop,
    browseBy,
    previousStop,
    nextStop,
    canGoPrevious,
    canGoNext,
    browsing,
    selectionMode,
    completeStop,
    togglePlayback,
    replayCurrentStop,
    playExtraAudio,
    seekBy,
    resumePlayback,
    selectGuide,
    startTracking,
    stopTracking,
    playQueuedStop,
    skipQueuedStop,
    end,
    // v5 新增
    drawerOpen,
    drawerReason,
    drawerStop,
    drawerIndex,
    drawerMatchesPlaying,
    drawerNarrations,
    drawerNarration,
    openContentDrawer,
    closeContentDrawer,
    toggleContentDrawer,
    journeyRestored,
    setPlaybackSuppressed,
    beginAskInterrupt,
    endAskInterrupt,
    handleVisibilityHidden,
    handleVisibilityVisible,
    saveCheckpoint,
    playCurrentStop,
    previousQueueFinished,
  }
}
