import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { isTourLocale, isUsableLocation, type TourLocale } from '@path-seeker/ts-shared'
import {
  abandonRouteVisit,
  fetchActiveRouteVisit,
  fetchClientCatalog,
  fetchClientTour,
  startRouteVisit,
  updateRouteVisitStop,
} from '@/services/clientCatalog'
import { useTourSpeech } from '@/composables/useTourSpeech'
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
import { resolveAutoAdvanceMode, shouldAdvanceAfterQueue, shouldAutoOpenOnApproach, shouldAutoStartOnApproach, type AutoAdvanceMode } from '@/utils/tourAutoAdvance'
import type { ClientCatalog, ClientPlace, ClientTourDetail, ClientTourStop, RouteVisit } from '@/types/clientCatalog'

/** C 端"跳过额外音频"开关的本地持久化键（只存本地，不回写 B 端配置） */
const SKIP_EXTRA_AUDIO_KEY = 'path-seeker:skip-extra-audio'
/** 最近一次进行中的游览：重挂载时用它调 RouteVisit/Active 恢复（方案 §5.3） */
const ACTIVE_ROUTE_KEY = 'path-seeker:tour-active-route'

/** 内容抽屉的打开来源（方案 §3.1） */
export type ContentDrawerOpenReason = 'manual' | 'arrival' | 'map-selection' | 'deep-link' | 'voice-ask'

/** 节点选择模式（方案 §4.4）：决定是否写进度、播完是否自动前进 */
export type StopSelectionMode = 'manual' | 'previous' | 'next' | 'arrival' | 'resume'

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
  try { return localStorage.getItem(SKIP_EXTRA_AUDIO_KEY) === '1' } catch { return false }
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
  const guideId = shallowRef<string | null>(null)
  const pending = shallowRef(false)
  const stopPending = shallowRef(false)
  const busy = computed(() => pending.value || stopPending.value)
  const error = shallowRef('')
  const location = shallowRef<{ longitude: number; latitude: number; accuracy: number; heading: number | null; timestamp: number } | null>(null)
  const locationError = shallowRef(false)
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
  /** 已恢复进行中游览：页面据此直接进入行程视图 */
  const journeyRestored = shallowRef(false)

  let loadVersion = 0
  let previewVersion = 0
  let journeyVersion = 0
  let watchId: number | undefined
  let arrivalTimer: ReturnType<typeof setTimeout> | undefined
  let locationTimer: ReturnType<typeof setTimeout> | undefined
  let candidateKey = ''
  let furthest = -1
  let alive = true
  /** 本次进入周期的自动打开/自动播放记录，按 stopId 去重 */
  const autoOpenState = new Map<string, AutoOpenState>()
  /** 语音问答打断现场：问答结束据此决定恢复 */
  let askInterrupt: { token: number; routeId: string; stageId: string; wasPlaying: boolean } | null = null
  /** 切后台现场：回到前台据此决定恢复 */
  let backgroundResume: { routeId: string; stageId: string; wasPlaying: boolean } | null = null
  const checkpointStorage = browserCheckpointStorage()
  const previousQueueFinished = shallowRef(0)

  const speech = useTourSpeech(() => { void handleQueueFinished() })

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
      paused: checkpoint.statusBeforeInterrupt === 'paused',
    })
    selectionMode.value = 'resume'
    return true
  }

  /** "跳过额外音频"开关：本地持久化，且不打断正在播放的队列，只影响下一次构建 */
  function setSkipExtraAudio(value: boolean) {
    skipExtraAudio.value = value
    clearCheckpoint()
    try { localStorage.setItem(SKIP_EXTRA_AUDIO_KEY, value ? '1' : '0') } catch {}
  }

  function markStopAutoPlayed(stopId: string, placeId: string) {
    const existing = autoOpenState.get(stopId)
    const next: AutoOpenState = existing
      ? { ...existing, autoPlayedAt: Date.now(), placeId: existing.placeId || placeId }
      : { stopId, placeId, openedAt: Date.now(), autoPlayedAt: Date.now(), lastRangeVersion: 0 }
    autoOpenState.set(stopId, next)
  }

  function markStopAutoOpened(stopId: string, placeId: string) {
    const existing = autoOpenState.get(stopId)
    const next: AutoOpenState = existing
      ? { ...existing, openedAt: Date.now(), placeId: existing.placeId || placeId }
      : { stopId, placeId, openedAt: Date.now(), lastRangeVersion: 0 }
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
  }

  // ==================== 抽屉 ====================

  function openContentDrawer(index: number, reason: ContentDrawerOpenReason) {
    const stop = stops.value[index]
    if (!stop) return
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
    if (!stored || stored.locale !== locale.value) return false
    // 显式深链到别的路线时不抢：只有没指定路线、或指定的就是那条进行中路线才恢复
    if (selectedRouteId && selectedRouteId !== stored.routeId) return false
    if (!routes.some(route => route.id === stored.routeId)) return false
    try {
      const activeVisit = await fetchActiveRouteVisit(stored.routeId)
      if (!activeVisit || activeVisit.status !== 1) {
        writeStoredActiveRoute(null)
        return false
      }
      const detail = await fetchClientTour(stored.routeId, locale.value)
      if (!alive || detail.route?.locale !== locale.value) return false
      active.value = detail
      visit.value = activeVisit
      const restoredStops = [...(detail.stops ?? [])].sort((left, right) => left.order - right.order)
      const stageIndex = indexOfStop(restoredStops, activeVisit.currentStageId) >= 0
        ? indexOfStop(restoredStops, activeVisit.currentStageId)
        : indexOfStop(restoredStops, stored.stageId)
      currentIndex.value = Math.max(0, stageIndex)
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
        restorePlaybackFromCheckpoint()
        pending.value = false
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
      active.value = selected
      visit.value = response
      currentIndex.value = Math.max(0, stops.value.findIndex(stop => stop.id === response.currentStageId))
      furthest = currentIndex.value
      resetAutoOpenState()
      journeyRestored.value = false
      writeStoredActiveRoute({ routeId: selected.route.id, stageId: currentStop.value?.id ?? null, locale: locale.value, updatedAt: Date.now() })
      await selectStop(currentIndex.value)
      return true
    } catch (caught) { error.value = caught instanceof Error ? caught.message : 'startFailed'; return false }
    finally { pending.value = false }
  }

  // ==================== 切站 ====================

  /** 正式切站（manual / arrival 自动开始）：写 currentStageId，构建并播放新队列，但不标记完成 */
  async function enterStop(index: number, reason: 'manual' | 'arrival' | 'resume' = 'manual') {
    const stop = stops.value[index]
    const currentVisit = visit.value
    if (!stop || !currentVisit) return
    stopPending.value = true
    const version = ++journeyVersion
    clearCheckpoint()
    speech.stop()
    error.value = ''
    currentIndex.value = index
    guideId.value = null
    selectionMode.value = reason === 'arrival' ? 'arrival' : 'manual'
    furthest = Math.max(furthest, index)
    drawerStopId.value = stop.id
    try {
      if (currentVisit.status === 1) {
        const response = await updateRouteVisitStop(currentVisit, stop.id, 'start')
        if (!alive || version !== journeyVersion) return
        visit.value = response
      }
      writeStoredActiveRoute({ routeId: active.value?.route?.id ?? '', stageId: stop.id, locale: locale.value, updatedAt: Date.now() })
      if (alive && version === journeyVersion) {
        playCurrentStop()
        if (reason === 'arrival') {
          // 自动开始播放：去重记账，若被浏览器拦下则走既有的 blocked 提示
          markStopAutoPlayed(stop.id, stop.placeId ?? '')
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
    const version = journeyVersion
    pending.value = true
    try {
      const response = await updateRouteVisitStop(currentVisit, stop.id, 'complete', 2)
      if (!alive || version !== journeyVersion) return
      visit.value = response
      if (response.status !== 1) {
        // 最后一站：结束行程
        speech.stop()
        stopTracking()
        writeStoredActiveRoute(null)
        return
      }
      if (shouldAdvanceAfterQueue(autoAdvanceMode.value)) {
        const next = currentIndex.value + 1
        if (next < stops.value.length) await enterStop(next, 'manual')
        else { speech.stop(); stopTracking() }
      }
      // proximity：只标记完成，停在本节点 idle，等接近触发自动开始
    } catch (caught) {
      if (version === journeyVersion) error.value = caught instanceof Error ? caught.message : 'saveFailed'
    } finally { if (alive) pending.value = false }
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
      saveCheckpoint('manual')
      speech.pause()
      return
    }
    if (speech.status.value === 'paused') {
      selectionMode.value = 'manual'
      speech.resume()
      return
    }
    // 空闲时：当前节点已听完（proximity 模式只标记完成、不切站）则接着播下一站
    const stop = currentStop.value
    const completed = visit.value?.completedStageIds ?? []
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
    selectionMode.value = 'manual'
    playCurrentStop(true)
  }

  /** 切换导游：只替换讲解内容，额外音频配置与"已播过的前置音频"都保留 */
  function selectGuide(id: string | null) {
    if (busy.value) return
    guideId.value = id
    clearCheckpoint()
    playCurrentStop()
  }

  /** 单独播放一条额外音频：站点没有讲解章节时也能用 */
  function playExtraAudio(id: string) {
    if (busy.value) return
    const stop = currentStop.value
    const extraAudio = stop?.extraAudios?.find(item => item.id === id)
    if (!stop || !extraAudio) return
    speech.playExtra(stop, extraAudio, locale.value)
  }

  /** ±15 秒：两处入口（底部控制条 / 内容抽屉）共用 */
  function seekBy(deltaSeconds: number) {
    if (busy.value) return { moved: false, precision: 'unavailable' as const, reason: 'idle' as const }
    return speech.seekBy(deltaSeconds)
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
      if (evaluated && evaluated.releasing) autoOpenState.delete(stopId)
    }
  }

  function stopTracking() {
    if (watchId !== undefined) navigator.geolocation?.clearWatch(watchId)
    watchId = undefined
    tracking.value = false
    clearTimeout(arrivalTimer)
    clearTimeout(locationTimer)
    approachUsable.value = false
    candidateKey = ''
    arrivalCandidates.value = []
  }

  /** 候选筛选：与确认、解除共用同一范围与同一策略 */
  function collectCandidates(now: number) {
    return nearbyTourStops(stops.value, catalog.value?.places ?? [], location.value, furthest, now, TOUR_ARRIVAL_POLICY)
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
    await enterStop(index, 'manual')
  }

  /**
   * 接近触发（方案 §7.1 + §4.5）：
   * - 每个景点每个进入周期只自动打开一次；
   * - 定位可用 + 队列空闲 + 唯一候选 → 自动打开并开始播放（每景点只自动一次）；
   * - 在播 / 暂停 / 多候选 / 被抑制 → 只自动打开抽屉。
   */
  function handleApproach(candidates: TourStopCandidate[]) {
    if (!candidates.length) return
    const candidate = candidates[0]!
    const stop = candidate.stop
    const ending = visit.value?.status !== 1
    const state = autoOpenState.get(stop.id)
    const suppressed = approachSuppressed.value || drawerRecentlyInteracted()
    const openable = shouldAutoOpenOnApproach({
      alreadyOpened: hasAutoOpened(stop.id) || Boolean(state?.dismissedAt),
      suppressed,
      busy: busy.value,
      ending,
    })
    if (openable) {
      openContentDrawer(candidate.index, 'arrival')
      markStopAutoOpened(stop.id, stop.placeId ?? '')
    }
    const startable = shouldAutoStartOnApproach({
      mode: autoAdvanceMode.value,
      status: speech.status.value,
      autoPlayed: hasAutoPlayed(stop.id),
      userPlayed: selectionMode.value !== 'arrival' && currentIndex.value === candidate.index,
      dismissed: Boolean(state?.dismissedAt),
      candidateCount: candidates.length,
      busy: busy.value,
      suppressed,
      ending,
    })
    if (!startable) return
    // 已经在播放该节点或正在切站时不再重复触发
    if (currentIndex.value === candidate.index && speech.status.value !== 'idle') return
    void enterStop(candidate.index, 'arrival')
  }

  function startTracking() {
    if (tracking.value) return
    if (!navigator.geolocation) { locationError.value = true; return }
    tracking.value = true
    locationError.value = false
    watchId = navigator.geolocation.watchPosition(position => {
      // heading 只有移动中才有效，静止时浏览器会给 null/NaN，交给地图保持当前朝向
      const heading = Number(position.coords.heading)
      location.value = {
        longitude: position.coords.longitude,
        latitude: position.coords.latitude,
        accuracy: position.coords.accuracy,
        heading: Number.isFinite(heading) ? heading : null,
        timestamp: position.timestamp,
      }
      locationError.value = false
      const now = Date.now()
      // 定位质量校验复用共享实现；位置过期由下面的定时器把状态改回"未知"
      approachUsable.value = isUsableLocation(location.value, TOUR_ARRIVAL_POLICY, now)
      clearTimeout(locationTimer)
      locationTimer = setTimeout(() => { if (alive) approachUsable.value = false }, TOUR_ARRIVAL_POLICY.maxAgeMs)
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
        if (candidates.length) handleApproach(candidates)
        return
      }
      clearTimeout(arrivalTimer)
      candidateKey = key
      if (!candidates.length) return
      // 稳定停留一小段时间再触发，减少定位漂移造成的反复提示
      arrivalTimer = setTimeout(() => {
        if (!alive || visit.value?.status !== 1) return
        const fresh = collectCandidates(Date.now())
        if (candidateSignature(fresh) !== key) return
        arrivalCandidates.value = fresh
        handleApproach(fresh)
      }, TOUR_ARRIVAL_POLICY.dwellMs)
    }, () => { locationError.value = true; stopTracking() }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 })
  }

  /** 页面层设置抑制（问一问浮层打开、语音识别中、页面后台） */
  function setApproachSuppressed(value: boolean) {
    approachSuppressed.value = value
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
    if (active.value?.route && visit.value?.status === 1) saveCheckpoint('page-hide')
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
    tracking,
    speech,
    skipExtraAudio,
    setSkipExtraAudio,
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
    acceptArrival,
    dismissArrival,
    end,
    // v5 新增
    drawerOpen,
    drawerReason,
    drawerStop,
    drawerIndex,
    drawerMatchesPlaying,
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
