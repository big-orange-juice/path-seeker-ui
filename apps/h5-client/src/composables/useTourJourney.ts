import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { isTourLocale, type TourLocale } from '@path-seeker/ts-shared'
import { abandonRouteVisit, fetchClientCatalog, fetchClientTour, startRouteVisit, updateRouteVisitStop } from '@/services/clientCatalog'
import { useTourSpeech } from '@/composables/useTourSpeech'
import { nearbyTourStop, TOUR_ARRIVAL_POLICY, tourDistanceMeters } from '@/utils/tourProgression'
import type { ClientCatalog, ClientTourDetail, RouteVisit } from '@/types/clientCatalog'

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
  const location = shallowRef<{ longitude: number; latitude: number; accuracy: number; timestamp: number } | null>(null)
  const locationError = shallowRef(false)
  const tracking = shallowRef(false)
  const stops = computed(() => [...(active.value?.stops ?? [])].sort((left, right) => left.order - right.order))
  const currentStop = computed(() => stops.value[currentIndex.value] ?? null)
  const narrations = computed(() => currentStop.value?.guideNarrations?.filter(item => item.locale === locale.value) ?? [])
  const narration = computed(() => narrations.value.find(item => item.guideId === guideId.value) ?? narrations.value[0] ?? null)
  let loadVersion = 0
  let previewVersion = 0
  let journeyVersion = 0
  let watchId: number | undefined
  let arrivalTimer: ReturnType<typeof setTimeout> | undefined
  let candidateIndex = -1
  let furthest = -1
  let queuedIndex = -1
  let alive = true
  const speech = useTourSpeech(() => { void completeStop(true) })

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
      active.value = selected
      visit.value = response
      currentIndex.value = Math.max(0, stops.value.findIndex(stop => stop.id === response.currentStageId))
      furthest = currentIndex.value
      queuedIndex = -1
      await selectStop(currentIndex.value)
      return true
    } catch (caught) { error.value = caught instanceof Error ? caught.message : 'startFailed'; return false }
    finally { pending.value = false }
  }

  async function selectStop(index: number) {
    const stop = stops.value[index]
    const currentVisit = visit.value
    if (!stop || !currentVisit || stopPending.value) return
    stopPending.value = true
    const version = ++journeyVersion
    speech.stop()
    error.value = ''
    currentIndex.value = index
    guideId.value = null
    furthest = Math.max(furthest, index)
    queuedIndex = -1
    try {
      if (currentVisit.status === 1) {
        const response = await updateRouteVisitStop(currentVisit, stop.id, 'start')
        if (!alive || version !== journeyVersion) return
        visit.value = response
      }
      if (alive && version === journeyVersion) speech.play(narration.value?.chapters ?? [], locale.value)
    } catch (caught) { if (version === journeyVersion) error.value = caught instanceof Error ? caught.message : 'saveFailed' }
    finally { stopPending.value = false }
  }

  async function completeStop(automatic = false) {
    const stop = currentStop.value
    const currentVisit = visit.value
    if (!stop || !currentVisit || currentVisit.status !== 1 || busy.value) return
    const version = journeyVersion
    pending.value = true
    error.value = ''
    try {
      const response = await updateRouteVisitStop(currentVisit, stop.id, 'complete', automatic ? 2 : 1)
      if (!alive || version !== journeyVersion) return
      visit.value = response
      const next = queuedIndex > currentIndex.value ? queuedIndex : currentIndex.value + 1
      if (response.status === 1 && next < stops.value.length) await selectStop(next)
      else {
        speech.stop()
        stopTracking()
      }
    } catch (caught) { if (version === journeyVersion) error.value = caught instanceof Error ? caught.message : 'saveFailed' }
    finally { if (alive) pending.value = false }
  }

  function togglePlayback() {
    if (busy.value) return
    if (speech.status.value === 'playing') speech.pause()
    else if (speech.status.value === 'paused') speech.resume()
    else speech.play(narration.value?.chapters ?? [], locale.value)
  }

  function selectGuide(id: string | null) {
    if (busy.value) return
    guideId.value = id
    speech.play(narration.value?.chapters ?? [], locale.value)
  }

  function stopTracking() {
    if (watchId !== undefined) navigator.geolocation?.clearWatch(watchId)
    watchId = undefined
    tracking.value = false
    clearTimeout(arrivalTimer)
    candidateIndex = -1
    queuedIndex = -1
  }

  function confirmArrival(index: number) {
    if (visit.value?.status !== 1 || !location.value || nearbyTourStop(stops.value, location.value, furthest, Date.now()) !== index) return
    furthest = index
    if (speech.status.value === 'playing' || speech.status.value === 'paused' || busy.value) queuedIndex = index
    else void selectStop(index)
  }

  function startTracking() {
    if (tracking.value) return
    if (!navigator.geolocation) { locationError.value = true; return }
    tracking.value = true
    locationError.value = false
    watchId = navigator.geolocation.watchPosition(position => {
      location.value = { longitude: position.coords.longitude, latitude: position.coords.latitude, accuracy: position.coords.accuracy, timestamp: position.timestamp }
      locationError.value = false
      const queued = stops.value[queuedIndex]
      if (queued?.longitude != null && queued.latitude != null
        && tourDistanceMeters(location.value, { longitude: queued.longitude, latitude: queued.latitude }) > TOUR_ARRIVAL_POLICY.releaseRadius) queuedIndex = -1
      const index = nearbyTourStop(stops.value, location.value, furthest, Date.now())
      if (index === candidateIndex) return
      clearTimeout(arrivalTimer)
      candidateIndex = index
      if (index >= 0) arrivalTimer = setTimeout(() => confirmArrival(index), TOUR_ARRIVAL_POLICY.dwellMs)
    }, () => { locationError.value = true; stopTracking() }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 })
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
      stopTracking()
      active.value = null
      visit.value = null
      return true
    } catch (caught) { error.value = caught instanceof Error ? caught.message : 'saveFailed'; return false }
    finally { pending.value = false }
  }

  onBeforeUnmount(() => { alive = false; journeyVersion += 1; loadVersion += 1; previewVersion += 1; stopTracking() })
  return { locale, languageReady, catalog, preview, active, visit, currentIndex, stops, currentStop, narrations, narration, pending: busy, error, location, locationError, tracking, speech, rememberLanguage, restoreLanguage, load, selectRoute, start, selectStop, completeStop, togglePlayback, selectGuide, startTracking, stopTracking, end }
}
