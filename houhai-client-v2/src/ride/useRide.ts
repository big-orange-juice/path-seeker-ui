import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { useLiveLocation } from '../composables/useLiveLocation.ts'
import { getRideCatalog } from './catalog.ts'
import { isLocale, isStyle, message, type MessageKey } from './i18n.ts'
import { advanceAfterStory, arrivalPolicy, distanceMeters, nearbyStop, scannedRoute, transitionJourney, type JourneyPlayback } from './progression.ts'
import { useRideSpeech } from './useRideSpeech.ts'
import type { Locale, RideRoute, RideStyle } from './types'

export function useRide() {
  const locale = shallowRef<Locale>('zh')
  const style = shallowRef<RideStyle>('history')
  const page = shallowRef<'language' | 'map' | 'journey'>('language')
  const routes = shallowRef<RideRoute[]>([])
  const selectedId = shallowRef('')
  const activeId = shallowRef('')
  const loading = shallowRef(false)
  const loadError = shallowRef(false)
  const invalidScan = shallowRef(false)
  const arrival = shallowRef<number>()
  const playback = shallowRef<JourneyPlayback>({ current: 0, furthest: -1, status: 'idle', manualPause: false, finished: false })
  const location = useLiveLocation()
  const selected = computed(() => routes.value.find(route => route.id === selectedId.value))
  const active = computed(() => routes.value.find(route => route.id === activeId.value))
  const current = computed(() => active.value?.stops[playback.value.current])
  const next = computed(() => active.value?.stops[playback.value.pending ?? playback.value.current + 1])
  const arrived = computed(() => arrival.value === undefined ? undefined : active.value?.stops[arrival.value])
  const translate = (key: MessageKey) => message(locale.value, key)
  const speech = useRideSpeech(finishStory, () => { playback.value = transitionJourney(playback.value, { type: 'error' }) })
  let candidate: { index: number; since: number } | undefined
  let arrivalTimer: ReturnType<typeof setTimeout> | undefined
  let requestVersion = 0
  let scanApplied = false

  watch(locale, value => {
    document.documentElement.lang = value
    document.title = message(value, 'welcome')
  }, { immediate: true })

  onMounted(() => {
    const param = new URLSearchParams(window.location.search).get('lang')
    try {
      const saved = localStorage.getItem('houhai:language')
      const savedStyle = localStorage.getItem('houhai:style')
      if (isLocale(param)) locale.value = param
      else if (isLocale(saved)) locale.value = saved
      if (isStyle(savedStyle)) style.value = savedStyle
    } catch { if (isLocale(param)) locale.value = param }
  })

  async function enter(value: Locale, nextStyle: RideStyle = style.value) {
    const version = ++requestVersion
    speech.stop()
    if (activeId.value) playback.value = { ...playback.value, status: 'paused', manualPause: true }
    locale.value = value
    style.value = nextStyle
    try { localStorage.setItem('houhai:language', value); localStorage.setItem('houhai:style', nextStyle) } catch {}
    loading.value = true
    loadError.value = false
    try {
      const result = await getRideCatalog(value)
      if (version !== requestVersion) return
      routes.value = result.routes
      if (!scanApplied) {
        const scan = scannedRoute(window.location.search, result.routes.map(route => route.id))
        selectedId.value = scan.id ?? result.routes.find(route => route.styleId === style.value)?.id ?? result.routes[0]?.id ?? ''
        invalidScan.value = scan.invalid
        scanApplied = true
      }
      page.value = 'map'
    } catch { if (version === requestVersion) loadError.value = true }
    finally { if (version === requestVersion) loading.value = false }
  }

  function playCurrent() {
    if (!current.value) return
    const clips = current.value.narrationAudio
    speech.play(clips?.length ? clips : current.value.narration.map(chapter => chapter.text).join('\n'), locale.value)
  }

  function discardDistantPending() {
    const pending = playback.value.pending
    if (pending === undefined) return
    const target = active.value?.stops[pending]?.coordinate
    const fix = location.location.value
    if (!fix || !target || Date.now() - fix.timestamp > arrivalPolicy.maxAgeMs || fix.accuracy > arrivalPolicy.maxAccuracy || distanceMeters(fix.coordinate, target) > arrivalPolicy.releaseRadius) {
      playback.value = transitionJourney(playback.value, { type: 'discardPending' })
    }
  }

  function finishStory() {
    discardDistantPending()
    playback.value = transitionJourney(playback.value, { type: 'end' })
    playback.value = advanceAfterStory(playback.value, active.value?.stops.length ?? 0)
    if (playback.value.status === 'playing') playCurrent()
  }

  function start() {
    if (!selected.value) return
    if (activeId.value === selectedId.value) { page.value = 'journey'; return }
    speech.stop()
    candidate = undefined
    clearTimeout(arrivalTimer)
    arrival.value = undefined
    activeId.value = selectedId.value
    playback.value = { current: 0, furthest: 0, status: 'playing', manualPause: false, finished: false }
    page.value = 'journey'
    location.start()
    playCurrent()
  }

  function togglePlayback() {
    if (playback.value.status === 'playing') {
      speech.pause()
      playback.value = transitionJourney(playback.value, { type: 'pause' })
      return
    }
    discardDistantPending()
    const previous = playback.value
    playback.value = transitionJourney(previous, { type: 'resume' })
    if (previous.status !== 'paused' || previous.current !== playback.value.current || !speech.resume()) playCurrent()
  }

  function selectStop(id: string) {
    const index = active.value?.stops.findIndex(stop => stop.id === id) ?? -1
    if (index < 0) return
    playback.value = transitionJourney(playback.value, { type: 'select', index })
    playCurrent()
  }

  function end() {
    speech.stop()
    location.stop()
    activeId.value = ''
    candidate = undefined
    arrival.value = undefined
    clearTimeout(arrivalTimer)
    page.value = 'map'
  }

  function changeLanguage() {
    if (playback.value.status === 'playing' && activeId.value) togglePlayback()
    page.value = 'language'
  }

  watch(location.location, fix => {
    if (!active.value) return
    const index = nearbyStop(active.value.stops, fix, playback.value.furthest, Date.now())
    if (index === undefined) { candidate = undefined; return }
    if (candidate?.index !== index) { candidate = { index, since: fix!.timestamp }; return }
    if (fix!.timestamp - candidate.since < arrivalPolicy.dwellMs) return
    candidate = undefined
    const before = playback.value
    playback.value = transitionJourney(before, { type: 'arrive', index })
    arrival.value = index
    clearTimeout(arrivalTimer)
    arrivalTimer = setTimeout(() => { arrival.value = undefined }, 8000)
    if (playback.value.current !== before.current) playCurrent()
  })

  onUnmounted(() => { requestVersion += 1; clearTimeout(arrivalTimer) })
  return { locale, page, routes, selectedId, activeId, selected, active, current, next, arrived, playback, loading, loadError, invalidScan, style,
    location, speech, translate, enter, start, togglePlayback, selectStop, end, changeLanguage }
}
