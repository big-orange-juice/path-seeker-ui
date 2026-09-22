import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import type { Catalog, Destination, Journey, Scene } from '../types'
import { getCatalog } from '../services/mockApi'
import { completeStop, preferredRoute, restoreProgress, routesForPlace } from '../domain/explorer'

const storageKey = 'path-seeker:houhai-v2:progress:v1'

export function useExplorer() {
  const catalog = shallowRef<Catalog>({ destinations: [], places: [], routes: [] })
  const loading = shallowRef(true)
  const error = shallowRef('')
  const scene = shallowRef<Scene>('rickshaw')
  const destinationId = shallowRef('beijing-houhai')
  const destinationNotice = shallowRef('')
  const selectedPlaceId = shallowRef('')
  const selectedRouteId = shallowRef('')
  const section = shallowRef<'explore' | 'favorites' | 'journeys'>('explore')
  const detailTab = shallowRef<'place' | 'route'>('place')
  const favorites = ref<string[]>([])
  const journeys = ref<Journey[]>([])
  const storageWarning = shallowRef('')
  const currentDestination = computed(() => catalog.value.destinations.find(destination => destination.id === destinationId.value))
  const destinations = computed(() => catalog.value.destinations.filter(destination => destination.scene === scene.value))
  const places = computed(() => catalog.value.places.filter(place => place.scene === scene.value && place.destinationId === destinationId.value))
  const routes = computed(() => catalog.value.routes.filter(route => route.scene === scene.value && route.destinationId === destinationId.value))
  const selectedPlace = computed(() => places.value.find(place => place.id === selectedPlaceId.value))
  const selectedRoute = computed(() => routes.value.find(route => route.id === selectedRouteId.value))
  const relatedRoutes = computed(() => routesForPlace(routes.value, selectedPlaceId.value))
  const routeStops = computed(() => selectedRoute.value?.stopIds.flatMap(id => places.value.find(place => place.id === id) ?? []) ?? [])
  const journey = computed(() => journeys.value.find(item => item.routeId === selectedRouteId.value))
  const nextStopId = computed(() => selectedRoute.value?.stopIds.find(id => !journey.value?.completedStopIds.includes(id)))
  const favoritePlaces = computed(() => catalog.value.places.filter(place => favorites.value.includes(place.id)))
  const visitedPlaces = computed(() => catalog.value.places.filter(place => journeys.value.some(item => item.completedStopIds.includes(place.id))))
  const completedRoutes = computed(() => journeys.value.filter(item => {
    const route = catalog.value.routes.find(candidate => candidate.id === item.routeId)
    return route && route.stopIds.length === item.completedStopIds.length
  }).length)

  function selectPlace(id: string) {
    const place = catalog.value.places.find(item => item.id === id)
    if (!place) return
    scene.value = place.scene
    destinationId.value = place.destinationId
    selectedPlaceId.value = id
    selectedRouteId.value = preferredRoute(routes.value, id, selectedRouteId.value)?.id ?? ''
    section.value = 'explore'
    detailTab.value = 'place'
  }

  function switchDestination(id: string) {
    const destination = catalog.value.destinations.find(item => item.id === id)
    if (!destination) return
    if (destination.status === 'comingSoon') {
      destinationNotice.value = `${destination.name}正在筹备中，当前先保留在${currentDestination.value?.name ?? '当前地点'}。`
      return
    }
    destinationNotice.value = ''
    destinationId.value = destination.id
    scene.value = destination.scene
    selectedPlaceId.value = catalog.value.places.find(place => place.destinationId === destination.id)?.id ?? ''
    selectedRouteId.value = catalog.value.routes.find(route => route.destinationId === destination.id)?.id ?? ''
    section.value = 'explore'
    detailTab.value = 'place'
  }

  function selectRoute(id: string) {
    const route = catalog.value.routes.find(item => item.id === id)
    if (!route) return
    scene.value = route.scene
    destinationId.value = route.destinationId
    selectedRouteId.value = id
    if (!route.stopIds.includes(selectedPlaceId.value)) selectedPlaceId.value = route.stopIds[0]
    section.value = 'explore'
    detailTab.value = 'route'
  }

  function switchScene(value: Scene) {
    if (scene.value === value) return
    destinationNotice.value = ''
    scene.value = value
    const nextDestination = catalog.value.destinations.find(destination => destination.scene === value && destination.status === 'available')
    if (nextDestination) destinationId.value = nextDestination.id
    selectedRouteId.value = routes.value[0]?.id ?? ''
    selectedPlaceId.value = places.value[0]?.id ?? ''
    section.value = 'explore'
    detailTab.value = 'place'
  }

  function toggleFavorite(id: string) {
    favorites.value = favorites.value.includes(id) ? favorites.value.filter(item => item !== id) : [...favorites.value, id]
  }

  function startJourney() {
    if (!selectedRoute.value) return
    if (!journey.value) journeys.value.push({ routeId: selectedRoute.value.id, completedStopIds: [], startedAt: new Date().toISOString() })
    if (nextStopId.value) selectedPlaceId.value = nextStopId.value
    detailTab.value = 'route'
  }

  function finishStop() {
    if (!journey.value || !selectedRoute.value) return
    const updated = completeStop(journey.value, selectedRoute.value, selectedPlaceId.value)
    journeys.value = journeys.value.map(item => item.routeId === updated.routeId ? updated : item)
    if (nextStopId.value) selectedPlaceId.value = nextStopId.value
  }

  async function load() {
    loading.value = true
    error.value = ''
    try {
      catalog.value = await getCatalog()
      try {
        const restored = restoreProgress(localStorage.getItem(storageKey), catalog.value)
        favorites.value = restored.favorites
        journeys.value = restored.journeys
      } catch {
        storageWarning.value = '浏览器无法保存记录，本次仍可正常体验。'
      }
      selectedPlaceId.value = places.value[0]?.id ?? ''
      selectedRouteId.value = routes.value[0]?.id ?? ''
    } catch {
      error.value = '游览内容加载失败，请重试。'
    } finally {
      loading.value = false
    }
  }

  watch([favorites, journeys], () => {
    if (loading.value) return
    try {
      localStorage.setItem(storageKey, JSON.stringify({ favorites: favorites.value, journeys: journeys.value }))
    } catch {
      storageWarning.value = '记录暂时无法保存，刷新后可能丢失。'
    }
  }, { deep: true })

  onMounted(load)
  return { loading, error, load, scene, destinationId, destinations, currentDestination, destinationNotice, section, detailTab, places, routes, selectedPlace, selectedRoute, relatedRoutes, routeStops, journey, journeys, completedRoutes, nextStopId, favorites, favoritePlaces, visitedPlaces, storageWarning, selectPlace, selectRoute, switchDestination, switchScene, toggleFavorite, startJourney, finishStop }
}
