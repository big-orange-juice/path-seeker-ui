import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { canAutoTriggerStop, mergeVisitArrivalProgress, isTourLocale, isUsableLocation, type TourLocale } from '@path-seeker/ts-shared'
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
import { evaluateTourStop, nearbyTourStops, TOUR_ARRIVAL_POLICY, type TourStopCandidate } from '@/utils/tourProgression'
import {
  browserCheckpointStorage,
  clearTourCheckpoint,
  isCheckpointValid,
  readTourCheckpoint,
  writeTourCheckpoint,
  type TourInterruptReason,
  type TourPlaybackCheckpoint,
} from '@/utils/tourCheckpoint'
import { decideQueueFinishedOutcome, isRangeVersionChanged, resolveAutoAdvanceMode, type AutoAdvanceMode } from '@/utils/tourAutoAdvance'
import type { ClientCatalog, ClientPlace, ClientTourDetail, ClientTourStop, RouteVisit } from '@/types/clientCatalog'
import { playbackFocus } from '@/utils/playbackFocus'
import { hasStableApproach } from '@/utils/tourPlaybackContext'

/** C 端"跳过额外音频"开关的本地持久化键（只存本地，不回写 B 端配置） */
const SKIP_EXTRA_AUDIO_KEY = 'path-seeker:skip-extra-audio'
const AUTO_PLAY_KEY = 'path-seeker:tour-auto-play'
/** 最近一次进行中的游览：重挂载时用它调 RouteVisit/Active 恢复（方案 §5.3） */
const ACTIVE_ROUTE_KEY = 'path-seeker:tour-active-route'
const PLAYBACK_SEQUENCE_KEY_PREFIX = 'path-seeker:tour-playback-sequence'

/** 内容抽屉的打开来源（方案 §3.1） */
export type ContentDrawerOpenReason = 'manual' | 'arrival' | 'map-selection' | 'deep-link' | 'voice-ask' | 'playback'

/** 节点选择模式（方案 §4.4）：决定是否写进度、播完是否自动前进 */
export type StopSelectionMode = 'manual' | 'previous' | 'next' | 'arrival' | 'resume'

/** 全局景点播放序列中的状态；自动入队后同一游览内不再重复入队。 */
export type PlaybackSequenceStatus = 'queued' | 'playing' | 'completed' | 'skipped'

export interface PlaybackSequenceItem {
  stopId: string
  index: number
  status: PlaybackSequenceStatus
  source: 'nearby-auto' | 'arrival-confirmed'
  queuedAt: number
}

/** 一次进入周期内的自动打开/自动播放记录（方案 §7.4） */
interface AutoOpenState {
  stopId: string
  placeId: string
  openedAt: number
  dismissedAt?: number
  autoPlayedAt?: number
  lastRangeVersion: number
}

interface StoredActiveRoute {
  routeId: string
  stageId: string | null
  locale: TourLocale
  updatedAt: number
}

function readSkipExtraAudio() {
  return false
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
  /** 接近候选：多个范围重叠时按路线顺序 + 停靠点距离排序，由用户在卡片上选择 */
  const arrivalCandidates = shallowRef<TourStopCandidate[]>([])
  const arrivalStop = computed(() => arrivalCandidates.value[0]?.stop ?? null)
  /** 最近一次定位是否通过共享的定位质量校验（精度、时效） */
  const approachUsable = shallowRef(false)
  /** 定位质量不足（精度过差 / 位置过期）时状态为未知：不弹接近卡片，但保留手动选择站点能力 */
  const approachUnknown = computed(() => tracking.value && !approachUsable.value)
  /** 定位置信度是否足以外部抑制接近行为（问一问浮层、抽屉交互、页面后台），由页面层设置 */
  const approachSuppressed = shallowRef(false)
  const narrations = computed(() => currentStop.value?.guideNarrations?.filter(item => item.locale === locale.value) ?? [])
  const narration = computed(() => narrations.value.find(item => item.guideId === guideId.value) ?? narrations.value[0] ?? null)
  const placesById = computed(() => {
    const map = new Map<string, ClientPlace>()
    for (const place of catalog.value?.places ?? []) map.set(place.id, place)
    return map
  })

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
  let arrivalTimer: ReturnType<typeof setTimeout> | undefined
  let locationTimer: ReturnType<typeof setTimeout> | undefined
  let candidateKey = ''
  let candidateStartedAt = 0
  let furthest = -1
  let alive = true
  // 手动看视频保留原解说断点，避免刷新后把独立观看误当成整站讲解已完成。
  let standaloneVideoPlayback = false
  let standaloneResume: { version: number; checkpoint: TourPlaybackCheckpoint } | null = null
  let pendingPlayback: { version: number; automatic: boolean } | null = null
  let pendingFinish: { version: number; stageId: string } | null = null
  let pageVisible = true
  let userPaused = false
  /** 本次进入周期的自动打开/自动播放记录，按 stopId 去重 */
  const autoOpenState = new Map<string, AutoOpenState>()
  const arrivalWrites = new Map<string, Promise<void>>()

  function recordPrerequisiteArrival(stopId: string): Promise<void> {
    const currentVisit = visit.value
    if (!currentVisit || currentVisit.status !== 1
      || !stops.value.some(stop => stop.autoTriggerPrerequisiteStageId === stopId)
      || currentVisit.visitedStageIds?.includes(stopId)) return Promise.resolve()
    const key = `${currentVisit.visitId}:${stopId}`
    const existing = arrivalWrites.get(key)
    if (existing) return existing
    const write = (async () => { try {
      const response = await updateRouteVisitStop(currentVisit, stopId, 'arrive')
      if (!alive || visit.value?.visitId !== currentVisit.visitId) return
      // 到站写回与播放器切站可能并行，只合并到访集合，避免旧响应覆盖当前播放进度。
      visit.value = { ...visit.value, visitedStageIds: [...new Set([
        ...(visit.value.visitedStageIds ?? []), ...(response.visitedStageIds ?? []),
      ])] }
    } catch (caught) {
      if (visit.value?.visitId === currentVisit.visitId) error.value = caught instanceof Error ? caught.message : 'saveFailed'
    } finally { arrivalWrites.delete(key) } })()
    arrivalWrites.set(key, write)
    return write
  }
  /** 语音问答打断现场：问答结束据此决定恢复 */
  let askInterrupt: { token: number; routeId: string; stageId: string; wasPlaying: boolean } | null = null
  /** 切后台现场：回到前台据此决定恢复 */
  let backgroundResume: { routeId: string; stageId: string; wasPlaying: boolean } | null = null
  const checkpointStorage = browserCheckpointStorage()
  const previousQueueFinished = shallowRef(0)

  const speech = useTourSpeech(() => { void handleQueueFinished() }, handleStandaloneFinished)

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
        const status = candidate.status === 'completed' || candidate.status === 'skipped' ? candidate.status : 'queued'
        const source = candidate.source === 'arrival-confirmed' ? candidate.source : 'nearby-auto'
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

  /** 当前自动推进模式：定位可用=proximity，不可用=sequential（方案 §4.5） */
  const autoAdvanceMode = computed<AutoAdvanceMode>(() => resolveAutoAdvanceMode({
    tracking: tracking.value,
    locationError: locationError.value,
    fixUsable: approachUsable.value,
  }))

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

  /** 文化点：站点通过 placeId 引用，范围与锚点都取自这里 */
  function placeOf(stop: ClientTourStop | null | undefined) {
    return stop?.placeId ? placesById.value.get(stop.placeId) ?? null : null
  }

  // ==================== 断点（方案 §5） ====================

  function currentStageId() {
    return currentStop.value?.id ?? active.value?.route?.id ?? ''
  }

  function buildCheckpoint(interruptedBy: TourInterruptReason): TourPlaybackCheckpoint | null {
    const route = active.value?.route
    const stop = currentStop.value
    if (!route || !stop || standaloneVideoPlayback) return null
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
    pendingPlayback = null
    standaloneResume = null
    standaloneVideoPlayback = false
    userPaused = false
    if (replayAll) playedBeforeExtraIds.clear()
    const browsing = selectionMode.value === 'previous' || selectionMode.value === 'next'
    speech.play(currentStop.value, narration.value?.chapters ?? [], locale.value, {
      skipExtraAudio: skipExtraAudio.value,
      playedBeforeExtraIds,
      // 浏览模式：前置额外音频不去重（方案 §4.4）
      skipBeforeAudioDedupe: browsing,
    }, resume ?? null)
    if (speech.status.value === 'playing' && (selectionMode.value !== 'arrival' || !contentAutoSwitchLocked.value)) openContentDrawer(currentIndex.value, 'playback')
  }

  function playbackAllowed(automatic: boolean) {
    return pageVisible && !askInterrupt && !approachSuppressed.value && !userPaused && !['ask', 'room'].includes(playbackFocus.current() ?? '')
      && (!automatic || (autoPlayEnabled.value && !contentAutoSwitchLocked.value && !browsing.value))
  }

  function flushPendingPlayback() {
    const request = pendingPlayback
    if (!request) return false
    if (request.version !== journeyVersion || !visit.value || request.automatic && visit.value.status !== 1) { pendingPlayback = null; return false }
    if (busy.value || !playbackAllowed(request.automatic)) return false
    playCurrentStop()
    const stop = currentStop.value
    if (stop) updateSequenceItem(stop.id, 'playing')
    return true
  }

  function handleStandaloneFinished() {
    const snapshot = standaloneResume
    if (!snapshot || snapshot.version !== journeyVersion) { standaloneResume = null; return }
    if (!pageVisible || askInterrupt || approachSuppressed.value || ['ask', 'room'].includes(playbackFocus.current() ?? '')) return
    const cp = snapshot.checkpoint
    playCurrentStop(false, { queueIndex: cp.queueIndex, itemId: cp.itemId, currentTimeSeconds: cp.currentTimeSeconds, sentenceIndex: cp.sentenceIndex, paused: cp.statusBeforeInterrupt !== 'playing' || userPaused })
  }

  function flushPendingFinish() {
    const event = pendingFinish
    if (!event) return
    if (event.version !== journeyVersion || event.stageId !== currentStageId() || visit.value?.completedStageIds?.includes(event.stageId)) { pendingFinish = null; return }
    if (busy.value || !pageVisible || askInterrupt || approachSuppressed.value) return
    pendingFinish = null
    void handleQueueFinished()
  }

  watch([busy, approachSuppressed, autoPlayEnabled, contentAutoSwitchLocked], () => {
    if (!alive || busy.value) return
    flushPendingFinish()
    if (busy.value) return
    if (standaloneResume && speech.status.value === 'idle') handleStandaloneFinished()
    flushPendingPlayback()
  })

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
    if (!value) void startNextPlaybackSequence()
  }

  function invalidateInterrupts() {
    journeyVersion += 1
    if (standaloneResume) standaloneResume.version = journeyVersion
    askInterrupt = null
    backgroundResume = null
  }

  function markStopAutoPlayed(stopId: string, placeId: string, rangeVersion: number | null | undefined) {
    const existing = autoOpenState.get(stopId)
    const next: AutoOpenState = existing
      ? { ...existing, autoPlayedAt: Date.now(), placeId: existing.placeId || placeId, lastRangeVersion: rangeVersion ?? existing.lastRangeVersion }
      : { stopId, placeId, openedAt: Date.now(), autoPlayedAt: Date.now(), lastRangeVersion: rangeVersion ?? 0 }
    autoOpenState.set(stopId, next)
  }

  function markStopAutoOpened(stopId: string, placeId: string, rangeVersion: number | null | undefined) {
    const existing = autoOpenState.get(stopId)
    const next: AutoOpenState = existing
      ? { ...existing, openedAt: Date.now(), placeId: existing.placeId || placeId, lastRangeVersion: rangeVersion ?? existing.lastRangeVersion }
      : { stopId, placeId, openedAt: Date.now(), lastRangeVersion: rangeVersion ?? 0 }
    autoOpenState.set(stopId, next)
  }

  function hasAutoOpened(stopId: string) {
    return Boolean(autoOpenState.get(stopId)?.openedAt)
  }

  function hasAutoPlayed(stopId: string) {
    return Boolean(autoOpenState.get(stopId)?.autoPlayedAt)
  }

  function resetAutoOpenState() {
    autoOpenState.clear()
    arrivalCandidates.value = []
    candidateKey = ''
    candidateStartedAt = 0
  }

  // ==================== 抽屉 ====================

  function openContentDrawer(index: number, reason: ContentDrawerOpenReason) {
    const stop = stops.value[index]
    if (!stop) return
    if (reason === 'arrival' && contentAutoSwitchLocked.value) return
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
      // furthest 用已完成站点重建，避免往回走近站时判定错位
      const completed = (activeVisit.completedStageIds ?? [])
        .map(id => indexOfStop(restoredStops, id))
        .filter(index => index >= 0)
      furthest = Math.max(currentIndex.value, ...(completed.length ? completed : [currentIndex.value]))
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
      visit.value = mergeVisitArrivalProgress(visit.value, response)
      currentIndex.value = Math.max(0, stops.value.findIndex(stop => stop.id === response.currentStageId))
      furthest = currentIndex.value
      resetAutoOpenState()
      journeyRestored.value = false
      writeStoredActiveRoute({ routeId: selected.route.id, stageId: currentStop.value?.id ?? null, locale: locale.value, updatedAt: Date.now() })
      await enterStop(currentIndex.value, 'resume')
      return true
    } catch (caught) { error.value = caught instanceof Error ? caught.message : 'startFailed'; return false }
    finally { pending.value = false }
  }

  // ==================== 切站 ====================

  /** 正式切站（manual / arrival 自动开始）：写 currentStageId，构建并播放新队列，但不标记完成 */
  async function enterStop(index: number, reason: 'manual' | 'arrival' | 'resume' = 'manual', sequenceStopId: string | null = null) {
    const stop = stops.value[index]
    const currentVisit = visit.value
    if (!stop || !currentVisit) return
    if (reason === 'arrival' && !canAutoTriggerStop(stop, stops.value, currentVisit.visitedStageIds ?? currentVisit.completedStageIds ?? [])) return
    stopPending.value = true
    const version = ++journeyVersion
    pendingPlayback = null
    standaloneResume = null
    if (reason === 'manual') userPaused = false
    clearCheckpoint()
    if (!sequenceStopId) markInterruptedSequence()
    speech.stop()
    error.value = ''
    currentIndex.value = index
    guideId.value = null
    selectionMode.value = reason === 'arrival' ? 'arrival' : 'manual'
    furthest = Math.max(furthest, index)
    if (reason !== 'arrival' || !contentAutoSwitchLocked.value) drawerStopId.value = stop.id
    try {
      if (currentVisit.status === 1) {
        const arrivalWrite = arrivalWrites.get(`${currentVisit.visitId}:${stop.id}`)
        if (arrivalWrite) await arrivalWrite
        if (!alive || version !== journeyVersion) return
        const response = await updateRouteVisitStop(currentVisit, stop.id, 'start')
        if (!alive || version !== journeyVersion) return
        visit.value = mergeVisitArrivalProgress(visit.value, response)
      }
      writeStoredActiveRoute({ routeId: active.value?.route?.id ?? '', stageId: stop.id, locale: locale.value, updatedAt: Date.now() })
      if (alive && version === journeyVersion) {
        if (reason !== 'resume') pendingPlayback = { version, automatic: reason === 'arrival' }
        if (reason === 'arrival') {
          // 自动开始播放：去重记账，若被浏览器拦下则走既有的 blocked 提示
          markStopAutoPlayed(stop.id, stop.placeId ?? '', placeOf(stop)?.range?.rangeVersion ?? null)
        }
      }
    } catch (caught) { if (version === journeyVersion) error.value = caught instanceof Error ? caught.message : 'saveFailed' }
    finally { if (version === journeyVersion) { stopPending.value = false; flushPendingPlayback() } }
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
    if (selectionMode.value === 'previous' || selectionMode.value === 'next') return
    const stop = currentStop.value
    const currentVisit = visit.value
    if (!stop || !currentVisit || currentVisit.status !== 1 || currentVisit.completedStageIds?.includes(stop.id)) return
    if (busy.value || !pageVisible || askInterrupt || approachSuppressed.value) { pendingFinish = { version: journeyVersion, stageId: stop.id }; return }
    previousQueueFinished.value += 1
    const sequenceItem = sequenceItemOf(stop.id)
    const version = journeyVersion
    pending.value = true
    let continueSequence = false
    try {
      const response = await updateRouteVisitStop(currentVisit, stop.id, 'complete', 2)
      if (!alive || version !== journeyVersion) return
      visit.value = mergeVisitArrivalProgress(visit.value, response)
      if (response.status !== 1) {
        // 最后一站：结束行程
        if (sequenceItem) updateSequenceItem(stop.id, 'completed')
        speech.stop()
        stopTracking()
        writeStoredActiveRoute(null)
        return
      }
      if (sequenceItem) {
        updateSequenceItem(stop.id, 'completed')
        continueSequence = true
        return
      }
      if (playbackSequence.value.some(item => item.status === 'queued')) {
        continueSequence = true
        return
      }
      const next = currentIndex.value + 1
      const outcome = decideQueueFinishedOutcome({
        browsing: false,
        visitInProgress: response.status === 1,
        mode: autoAdvanceMode.value,
        hasNextStop: next < stops.value.length,
      })
      if (outcome === 'advance' && playbackAllowed(true)) await enterStop(next, 'arrival')
      else if (outcome === 'finish') { speech.stop(); stopTracking() }
      // proximity：只标记完成，停在本节点 idle，等接近触发自动开始
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
      visit.value = mergeVisitArrivalProgress(visit.value, response)
      const nearby = arrivalCandidates.value[0]?.index ?? -1
      const next = nearby > currentIndex.value ? nearby : currentIndex.value + 1
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
      userPaused = true
      invalidateInterrupts()
      speech.pause()
      saveCheckpoint('manual')
      return
    }
    userPaused = false
    if (pendingPlayback) pendingPlayback.automatic = false
    if (pendingPlayback && flushPendingPlayback()) return
    if (speech.status.value === 'paused') {
      speech.resume()
      return
    }
    // 空闲时：当前节点已听完（proximity 模式只标记完成、不切站）则接着播下一站
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
    const checkpoint = standaloneResume?.checkpoint ?? buildCheckpoint('manual')
    invalidateInterrupts()
    standaloneResume = checkpoint && checkpoint.itemId ? { version: journeyVersion, checkpoint } : null
    standaloneVideoPlayback = true
    speech.playExtra(stop, extraAudio, locale.value)
  }

  function playStopVideo() {
    if (busy.value || !drawerMatchesPlaying.value || !drawerStop.value?.video) return
    const checkpoint = standaloneResume?.checkpoint ?? (speech.status.value !== 'idle' ? buildCheckpoint('manual') : null)
    if (speech.status.value !== 'idle') saveCheckpoint('manual')
    invalidateInterrupts()
    standaloneResume = checkpoint && checkpoint.itemId ? { version: journeyVersion, checkpoint } : null
    standaloneVideoPlayback = true
    speech.playVideo(drawerStop.value, locale.value)
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
    userPaused = false
    if (pendingPlayback) pendingPlayback.automatic = false
    if (!flushPendingPlayback()) speech.resume()
  }

  // ==================== 语音问答打断与恢复（方案 §5.2） ====================

  /** 打开问一问前调用：保存断点并暂停（保留队列与位置，不打断用户意图） */
  function beginAskInterrupt() {
    const stageId = currentStageId()
    if (!active.value?.route || !stageId) return
    const wasPlaying = speech.status.value === 'playing' || Boolean(askInterrupt?.token === journeyVersion && askInterrupt.stageId === stageId && askInterrupt.wasPlaying)
    if (speech.status.value === 'playing') saveCheckpoint('voice-ask')
    askInterrupt = { token: journeyVersion, routeId: active.value.route.id, stageId, wasPlaying }
    speech.pause()
  }

  /**
   * 问答收尾调用：问答前在播就尽量自动恢复；前提是没有切站、断点仍属于当前节点。
   * 返回 `resumed` / `blocked-paused` / `noop`，页面据此决定是否提示"继续"。
   */
  function endAskInterrupt(): 'resumed' | 'blocked-paused' | 'noop' {
    if (!pageVisible || approachSuppressed.value || ['ask', 'room'].includes(playbackFocus.current() ?? '')) return 'noop'
    const snapshot = askInterrupt
    askInterrupt = null
    if (!snapshot || !snapshot.wasPlaying) { flushPendingFinish(); return flushPendingPlayback() ? 'resumed' : 'noop' }
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
    if (!pageVisible || askInterrupt || approachSuppressed.value || userPaused) return 'noop'
    if (standaloneResume && speech.status.value === 'idle') { handleStandaloneFinished(); return 'resumed' }
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
    pageVisible = false
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
  function handleVisibilityVisible(allowResume = true): 'resumed' | 'blocked-paused' | 'noop' {
    pageVisible = true
    if (!allowResume) return 'noop'
    if (askInterrupt) endAskInterrupt()
    flushPendingFinish()
    if (flushPendingPlayback()) return 'resumed'
    const snapshot = backgroundResume
    backgroundResume = null
    if (!snapshot?.wasPlaying) return 'noop'
    if (snapshot.routeId !== active.value?.route?.id) return 'noop'
    if (snapshot.stageId !== currentStageId()) return 'noop'
    return resumeRouteNarration()
  }

  // ==================== 接近与自动推进（方案 §7 / §4.5） ====================

  /** 离开退出阈值（默认 80m）后清掉该景点的自动记录，允许再次进入时重新触发（方案 §7.4） */
  function pruneAutoOpenState(now: number) {
    if (!autoOpenState.size) return
    for (const [stopId, state] of [...autoOpenState.entries()]) {
      const stop = stops.value.find(item => item.id === stopId)
      if (!stop) { autoOpenState.delete(stopId); continue }
      const place = placeOf(stop)
      const evaluated = evaluateTourStop(stop, place, location.value, now, TOUR_ARRIVAL_POLICY)
      // 判定不了（定位质量不足）时保留记录，避免抖动误清
      // 景点范围版本变化（B 端改了范围）时清掉记录，允许重新评估（方案 §7.4）
      if (isRangeVersionChanged(state.lastRangeVersion, place?.range?.rangeVersion)) {
        autoOpenState.delete(stopId)
        continue
      }
      if (evaluated && evaluated.releasing) autoOpenState.delete(stopId)
    }
  }

  function stopTracking() {
    locationWatch?.stop()
    locationWatch = null
    tracking.value = false
    location.value = null
    locationPermissionDenied.value = false
    clearTimeout(arrivalTimer)
    clearTimeout(locationTimer)
    approachUsable.value = false
    candidateKey = ''
    candidateStartedAt = 0
    arrivalCandidates.value = []
  }

  /** 候选筛选：与确认、解除共用同一范围与同一策略 */
  function collectCandidates(now: number) {
    return nearbyTourStops(
      stops.value,
      catalog.value?.places ?? [],
      location.value,
      Math.max(-1, indexOfStop(stops.value, visit.value?.currentStageId)),
      now,
      TOUR_ARRIVAL_POLICY,
      visit.value?.completedStageIds ?? [],
      visit.value?.visitedStageIds ?? visit.value?.completedStageIds ?? [],
    ).filter(candidate => !sequenceItemOf(candidate.stop.id))
  }

  function candidateSignature(candidates: TourStopCandidate[]) {
    return candidates.map(candidate => candidate.index).join(',')
  }

  function dismissArrival() {
    if (!arrivalCandidates.value.length) return
    for (const candidate of arrivalCandidates.value) {
      const state = autoOpenState.get(candidate.stop.id)
      if (state) state.dismissedAt = Date.now()
      else autoOpenState.set(candidate.stop.id, {
        stopId: candidate.stop.id,
        placeId: candidate.stop.placeId ?? '',
        openedAt: 0,
        dismissedAt: Date.now(),
        lastRangeVersion: 0,
      })
    }
    arrivalCandidates.value = []
  }

  /** 用户确认"进入该站"：按同一算法复算，已解除接近或定位失效时不再切站 */
  async function acceptArrival(index: number) {
    if (busy.value || visit.value?.status !== 1) return
    const candidate = arrivalCandidates.value.find(item => item.index === index)
    if (!candidate) return
    const evaluated = evaluateTourStop(candidate.stop, candidate.place, location.value, Date.now(), TOUR_ARRIVAL_POLICY)
    if (!evaluated || !evaluated.approaching) { dismissArrival(); return }
    dismissArrival()
    const item = enqueuePlaybackStop(index, 'arrival-confirmed')
    if (item) void recordPrerequisiteArrival(candidate.stop.id)
    if (item && speech.status.value === 'idle') await startNextPlaybackSequence(true)
  }

  /** 播放全局序列中下一个尚未开始的景点；当前景点播放期间只追加，不打断。 */
  async function startNextPlaybackSequence(force = false) {
    if (flushPendingPlayback()) return
    if (pendingPlayback || busy.value || visit.value?.status !== 1 || speech.status.value !== 'idle' || !playbackAllowed(!force)) return
    const next = playbackSequence.value.find(item => item.status === 'queued'
      && stops.value[item.index]?.id === item.stopId
      && canAutoTriggerStop(stops.value[item.index]!, stops.value, visit.value?.visitedStageIds ?? visit.value?.completedStageIds ?? []))
    if (!next) return
    await enterStop(next.index, force ? 'manual' : 'arrival', next.stopId)
  }

  async function playQueuedStop(stopId: string) {
    if (busy.value || visit.value?.status !== 1) return
    const item = sequenceItemOf(stopId)
    if (!item || item.status !== 'queued') return
    if (pendingPlayback?.version === journeyVersion && currentStop.value?.id === stopId) {
      userPaused = false
      pendingPlayback.automatic = false
      flushPendingPlayback()
      return
    }
    markInterruptedSequence()
    await enterStop(item.index, 'manual', item.stopId)
  }

  function skipQueuedStop(stopId: string) {
    const item = sequenceItemOf(stopId)
    if (!item || item.status !== 'queued') return
    if (pendingPlayback && currentStop.value?.id === stopId) pendingPlayback = null
    updateSequenceItem(stopId, 'skipped')
    if (speech.status.value === 'idle') void startNextPlaybackSequence()
  }

  function sortApproachCandidates(candidates: TourStopCandidate[]) {
    return [...candidates].sort((left, right) =>
      ((left.distanceMeters ?? Number.POSITIVE_INFINITY) - (right.distanceMeters ?? Number.POSITIVE_INFINITY))
      || (left.stop.order - right.stop.order)
      || (left.index - right.index))
  }

  /**
   * 接近触发（方案 §7.1 + §4.5）：
   * - 每个游览序列内一个景点只入队一次；
   * - 多个候选按距离由近到远追加到全局序列；
   * - 当前景点播放期间只追加，不打断当前播放。
   */
  function handleApproach(candidates: TourStopCandidate[]) {
    if (!candidates.length) return
    const ending = visit.value?.status !== 1
    const suppressed = approachSuppressed.value || drawerRecentlyInteracted()
    if (ending || suppressed || busy.value) return
    const ordered = sortApproachCandidates(candidates)
    for (const candidate of ordered) {
      if (currentIndex.value === candidate.index && speech.status.value !== 'idle') continue
      if (autoOpenState.get(candidate.stop.id)?.dismissedAt) continue
      const item = enqueuePlaybackStop(candidate.index, 'nearby-auto')
      if (!item) continue
      void recordPrerequisiteArrival(candidate.stop.id)
      const rangeVersion = candidate.place?.range?.rangeVersion ?? null
      if (autoPlayEnabled.value && !contentAutoSwitchLocked.value && speech.status.value === 'idle' && !hasAutoOpened(candidate.stop.id)) {
        openContentDrawer(candidate.index, 'arrival')
        markStopAutoOpened(candidate.stop.id, candidate.stop.placeId ?? '', rangeVersion)
      }
    }
    if (speech.status.value === 'idle') void startNextPlaybackSequence()
  }

  /**
   * 开始近站定位。
   *
   * 取数策略交给 watchLocation：首帧不强制高精度，避免 Android Chromium 在室内
   * 让 `enableHighAccuracy: true` 静默挂起（实测 12 秒 0 回调），拿到可用定位后再
   * 机会性接受高精度改善。这里只负责把每次定位换算成接近判定需要的时间戳与质量。
   */
  function startTracking() {
    if (tracking.value) return
    if (!navigator.geolocation) { locationError.value = true; return }
    tracking.value = true
    locationError.value = false
    locationPermissionDenied.value = false
    locationWatch = watchLocation({
      onFix: fix => handleLocationFix(fix),
      onError: handleLocationError,
    })
  }

  function handleLocationFix(fix: LocationFix) {
    location.value = fix
    locationError.value = false
    locationPermissionDenied.value = false
    const now = Date.now()
    // 定位质量校验复用共享实现；位置过期由下面的定时器把状态改回"未知"
    approachUsable.value = isUsableLocation(location.value, TOUR_ARRIVAL_POLICY, now)
    clearTimeout(locationTimer)
    locationTimer = setTimeout(() => {
      if (!alive) return
      approachUsable.value = false
      candidateKey = ''
      candidateStartedAt = 0
      clearTimeout(arrivalTimer)
    }, TOUR_ARRIVAL_POLICY.maxAgeMs)
    // 离开退出阈值的景点清掉自动记录：再次进入时允许重新自动打开/自动播放
    pruneAutoOpenState(now)
    // 离开提示取消：与候选筛选、确认走同一范围与阈值
    if (arrivalCandidates.value.length) {
      const stillNear = arrivalCandidates.value.filter(candidate => {
        const evaluated = evaluateTourStop(candidate.stop, candidate.place, location.value, now, TOUR_ARRIVAL_POLICY)
        // 判定不了（定位质量不足）时保留卡片，用户仍可手动选择
        return evaluated ? !evaluated.releasing : true
      })
      if (stillNear.length) arrivalCandidates.value = stillNear
      else arrivalCandidates.value = []
    }
    const candidates = collectCandidates(now)
    const key = candidateSignature(candidates)
    if (key === candidateKey) {
      // 候选没变时也要评估自动开始：音频播完后停在范围内，等下一次定位事件即自动开始
      if (candidates.length && hasStableApproach(candidateStartedAt, now, TOUR_ARRIVAL_POLICY.dwellMs)) handleApproach(candidates)
      return
    }
    clearTimeout(arrivalTimer)
    candidateKey = key
    candidateStartedAt = candidates.length ? now : 0
    if (!candidates.length) return
    // 稳定停留一小段时间再触发，减少定位漂移造成的反复提示
    arrivalTimer = setTimeout(() => {
      if (!alive || visit.value?.status !== 1) return
      const fresh = collectCandidates(Date.now())
      if (candidateSignature(fresh) !== key) return
      arrivalCandidates.value = fresh
      handleApproach(fresh)
    }, TOUR_ARRIVAL_POLICY.dwellMs)
  }

  /**
   * 权限被拒时无法靠重试恢复，停止定位让用户去改设置；
   * 其余情况（暂时拿不到定位、单次请求超时）保持 tracking，界面显示"正在等待更准确的定位"。
   */
  function handleLocationError(error: LocationWatchError) {
    if (error.code === 'denied') {
      // 先停掉监听再置状态，避免停止动作本身把权限提示清掉
      stopTracking()
      locationPermissionDenied.value = true
      locationError.value = true
      return
    }
    approachUsable.value = false
  }

  /** 页面层设置抑制（问一问浮层打开、语音识别中、页面后台） */
  function setApproachSuppressed(value: boolean) {
    approachSuppressed.value = value
    if (!value) {
      if (askInterrupt) endAskInterrupt()
      flushPendingFinish()
      if (standaloneResume && speech.status.value === 'idle') handleStandaloneFinished()
      void startNextPlaybackSequence()
    }
    if (!value && candidateKey && hasStableApproach(candidateStartedAt, Date.now(), TOUR_ARRIVAL_POLICY.dwellMs)) {
      handleApproach(collectCandidates(Date.now()))
    }
  }

  /** 抽屉内交互（滚动、点选）：短时间内不再自动切换抽屉内容（方案 §7.5） */
  const drawerInteractionAt = shallowRef(0)
  function markDrawerInteraction() {
    drawerInteractionAt.value = Date.now()
  }
  function drawerRecentlyInteracted() {
    return drawerOpen.value && Date.now() - drawerInteractionAt.value < 6000
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
      resetAutoOpenState()
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
    arrivalStop,
    arrivalCandidates,
    approachUnknown,
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
    playStopVideo,
    seekBy,
    resumePlayback,
    selectGuide,
    startTracking,
    stopTracking,
    acceptArrival,
    dismissArrival,
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
    autoAdvanceMode,
    setApproachSuppressed,
    markDrawerInteraction,
    beginAskInterrupt,
    endAskInterrupt,
    handleVisibilityHidden,
    handleVisibilityVisible,
    saveCheckpoint,
    playCurrentStop,
    previousQueueFinished,
  }
}
