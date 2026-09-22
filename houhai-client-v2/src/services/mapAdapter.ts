import { mapConfig } from '../config/map'
import { wgs84ToGcj02 } from '../domain/coordinates'
import type { Coordinate, CulturalPlace, LiveLocation, TourRoute } from '../types'
import type { MapInsets } from '../domain/mapViewport'

export interface MapState {
  places: CulturalPlace[]
  selectedPlaceId: string
  route?: TourRoute
  insets?: MapInsets
  tilt?: number
}

export interface MapAdapter {
  update: (state: MapState) => void
  fit: () => void
  zoom: (direction: number) => void
  resize: () => void
  setLocation: (location?: LiveLocation) => void
  focusLocation: () => boolean
  setTourMode: (enabled: boolean) => boolean
  destroy: () => void
}

type SelectPlace = (id: string) => void
function markerElement(place: CulturalPlace, index: number, selected: boolean) {
  const marker = document.createElement('button')
  marker.type = 'button'
  marker.className = `culture-pin${selected ? ' is-selected' : ''}${place.artwork === 'hutong' ? ' label-above' : ''}`
  marker.setAttribute('aria-label', place.name)
  marker.setAttribute('aria-pressed', String(selected))
  const number = document.createElement('span')
  number.className = 'pin-number'
  number.textContent = index >= 0 ? String(index + 1).padStart(2, '0') : '·'
  const name = document.createElement('span')
  name.className = 'pin-label'
  name.textContent = place.name
  marker.append(number, name)
  return marker
}

function bearingBetween(start: Coordinate, end: Coordinate) {
  const startLatitude = start[1] * Math.PI / 180
  const endLatitude = end[1] * Math.PI / 180
  const longitudeDelta = (end[0] - start[0]) * Math.PI / 180
  const horizontal = Math.sin(longitudeDelta) * Math.cos(endLatitude)
  const vertical = Math.cos(startLatitude) * Math.sin(endLatitude) - Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDelta)
  return (Math.atan2(horizontal, vertical) * 180 / Math.PI + 360) % 360
}

function distanceMeters(start: Coordinate, end: Coordinate) {
  const latitudeDelta = (end[1] - start[1]) * Math.PI / 180
  const longitudeDelta = (end[0] - start[0]) * Math.PI / 180
  const startLatitude = start[1] * Math.PI / 180
  const endLatitude = end[1] * Math.PI / 180
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

interface AmapOverlay {
  on: (event: string, callback: () => void) => void
  setPosition?: (position: Coordinate) => void
  setCenter?: (position: Coordinate) => void
  setRadius?: (radius: number) => void
}
interface AmapInstance {
  add: (overlays: AmapOverlay[]) => void
  remove: (overlays: AmapOverlay[]) => void
  setFitView: (overlays: AmapOverlay[], immediately: boolean, padding: number[], maxZoom: number) => void
  getZoom: () => number
  setZoom: (zoom: number) => void
  setZoomAndCenter: (zoom: number, center: Coordinate, immediately?: boolean) => void
  setPitch: (pitch: number, immediately?: boolean) => void
  setRotation: (rotation: number, immediately?: boolean) => void
  getCenter: () => { getLng: () => number; getLat: () => number }
  setCenter: (center: Coordinate, immediately?: boolean) => void
  containerToLngLat: (pixel: [number, number]) => { getLng: () => number; getLat: () => number }
  setFeatures: (features: string[]) => void
  resize: () => void
  destroy: () => void
}
interface AmapSdk {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => AmapInstance
  Marker: new (options: Record<string, unknown>) => AmapOverlay
  Polyline: new (options: Record<string, unknown>) => AmapOverlay
  Circle: new (options: Record<string, unknown>) => AmapOverlay
  Pixel: new (horizontal: number, vertical: number) => unknown
}
declare global {
  interface Window {
    AMap?: AmapSdk
    _AMapSecurityConfig?: { serviceHost?: string; securityJsCode?: string }
  }
}

let amapPromise: Promise<AmapSdk> | undefined

function loadAmap(): Promise<AmapSdk> {
  if (!mapConfig.amapKey || (!mapConfig.amapSecurityCode && !mapConfig.amapSecurityProxy)) return Promise.reject(new Error('高德地图尚未配置，请检查本地 Key 与安全配置。'))
  if (window.AMap) return Promise.resolve(window.AMap)
  if (amapPromise) return amapPromise
  amapPromise = new Promise((resolve, reject) => {
    window._AMapSecurityConfig = mapConfig.amapSecurityProxy
      ? { serviceHost: mapConfig.amapSecurityProxy }
      : { securityJsCode: mapConfig.amapSecurityCode }
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => fail(), 12000)
    function fail() {
      window.clearTimeout(timeout)
      script.remove()
      amapPromise = undefined
      reject(new Error('高德地图加载失败，请检查 Key、域名白名单和安全配置。'))
    }
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(mapConfig.amapKey)}`
    script.onerror = fail
    script.onload = () => {
      window.clearTimeout(timeout)
      if (window.AMap) resolve(window.AMap)
      else fail()
    }
    document.head.append(script)
  })
  return amapPromise
}

export async function createAmap(container: HTMLElement, selectPlace: SelectPlace): Promise<MapAdapter> {
  const sdk = await loadAmap()
  const map = new sdk.Map(container, { center: wgs84ToGcj02(mapConfig.center), zoom: mapConfig.zoom, zooms: [mapConfig.minZoom, 20], viewMode: '3D', pitch: 0, rotation: 0, showBuildingBlock: true, wallColor: '#cad6e2', roofColor: '#edf3f8', skyColor: '#a9d8f7' })
  let overlays: AmapOverlay[] = []
  let previousRoute = ''
  let previousPlace = ''
  let insets: MapInsets = { top: 65, right: 65, bottom: 65, left: 65 }
  let previousInsets = ''
  let baseTilt = 0
  let liveLocation: LiveLocation | undefined
  let locationOverlays: AmapOverlay[] = []
  let currentState: MapState = { places: [], selectedPlaceId: '' }
  let tourMode = false
  let tourZoom = 19
  let tourPath: Coordinate[] = []
  let tourCumulative: number[] = [0]
  let tourTotal = 0
  let roamDistance = 0
  let roamTimer: ReturnType<typeof setInterval> | undefined
  let roamTimestamp = 0
  let tourMarker: AmapOverlay | undefined
  const roamPaceSeconds = 240

  function rebuildTourPath() {
    tourPath = (currentState.route?.geometry ?? []).map(wgs84ToGcj02)
    tourCumulative = [0]
    for (let index = 1; index < tourPath.length; index += 1) {
      tourCumulative.push(tourCumulative[index - 1]! + distanceMeters(tourPath[index - 1]!, tourPath[index]!))
    }
    tourTotal = tourCumulative[tourPath.length - 1] ?? 0
  }
  function roamPoint(distance: number): { position?: Coordinate; bearing: number } {
    if (!tourPath.length) return { bearing: 0 }
    const clamped = Math.max(0, Math.min(distance, tourTotal))
    let index = 1
    while (index < tourCumulative.length - 1 && tourCumulative[index]! < clamped) index += 1
    const start = tourPath[index - 1]!
    const end = tourPath[index] ?? start
    const span = tourCumulative[index]! - tourCumulative[index - 1]!
    const ratio = span > 0 ? (clamped - tourCumulative[index - 1]!) / span : 0
    return { position: [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio], bearing: bearingBetween(start, end) }
  }
  function bearingOnPath(target: Coordinate) {
    let nearest = 0
    for (let index = 1; index < tourPath.length; index += 1) {
      if (distanceMeters(target, tourPath[index]!) < distanceMeters(target, tourPath[nearest]!)) nearest = index
    }
    const ahead = tourPath.slice(nearest + 1).find(point => distanceMeters(tourPath[nearest]!, point) > 3)
    return ahead ? bearingBetween(tourPath[nearest]!, ahead) : 0
  }
  function distanceAlongPath(target: Coordinate) {
    let best = 0
    let shortest = Number.POSITIVE_INFINITY
    tourPath.forEach((point, index) => {
      const distance = distanceMeters(target, point)
      if (distance < shortest) { shortest = distance; best = tourCumulative[index] ?? 0 }
    })
    return best
  }
  function liveOnRoute() {
    if (!liveLocation || !Number.isFinite(liveLocation.accuracy) || Date.now() - liveLocation.timestamp > 30000) return false
    const position = wgs84ToGcj02(liveLocation.coordinate)
    return tourPath.some(point => distanceMeters(position, point) <= 2000)
  }
  function tourTarget(): { position?: Coordinate; bearing: number } {
    if (!tourPath.length) return { bearing: 0 }
    if (liveOnRoute()) {
      const position = wgs84ToGcj02(liveLocation!.coordinate)
      return { position, bearing: bearingOnPath(position) }
    }
    return roamPoint(roamDistance)
  }
  function followCamera() {
    const target = tourTarget()
    if (!target.position) return
    map.setZoomAndCenter(tourZoom, target.position, true)
    map.setRotation((360 - target.bearing) % 360, true)
    map.setPitch(70, true)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const anchor = map.containerToLngLat([container.clientWidth / 2, container.clientHeight * 0.75])
      const center = map.getCenter()
      map.setCenter([center.getLng() + target.position[0] - anchor.getLng(), center.getLat() + target.position[1] - anchor.getLat()], true)
    }
  }
  function roamTick() {
    if (!tourMode || tourTotal <= 0) return
    if (liveOnRoute()) {
      roamTimestamp = performance.now()
      roamDistance = distanceAlongPath(wgs84ToGcj02(liveLocation!.coordinate))
      return
    }
    if (roamDistance >= tourTotal) return
    const now = performance.now()
    const delta = Math.min(now - roamTimestamp, 500)
    roamTimestamp = now
    roamDistance = Math.min(roamDistance + (tourTotal / roamPaceSeconds) * delta / 1000, tourTotal)
    const point = roamPoint(roamDistance)
    if (point.position) tourMarker?.setPosition?.(point.position)
    followCamera()
  }
  function startRoam() {
    stopRoam()
    roamTimestamp = performance.now()
    roamTimer = setInterval(roamTick, 80)
  }
  function stopRoam() {
    if (roamTimer !== undefined) clearInterval(roamTimer)
    roamTimer = undefined
  }
  function fit() {
    if (tourMode) { followCamera(); return }
    if (overlays.length) map.setFitView(overlays, true, [insets.top, insets.right, insets.bottom + (baseTilt > 0 ? 70 : 0), insets.left], 16)
    map.setRotation(0, true)
    map.setPitch(baseTilt, true)
  }
  function renderLocation() {
    map.remove(locationOverlays)
    locationOverlays = []
    tourMarker = undefined
    const position = tourMode ? tourTarget().position : liveLocation && wgs84ToGcj02(liveLocation.coordinate)
    if (!position) return
    locationOverlays = tourMode
      ? [new sdk.Marker({ position, content: '<span class="navigation-location" role="img" aria-label="游览位置"><span></span></span>', offset: new sdk.Pixel(-25, -25), zIndex: 400 })]
      : [
          new sdk.Circle({ center: position, radius: Math.max(6, liveLocation?.accuracy ?? 6), strokeColor: '#287f91', strokeWeight: 1, strokeOpacity: 0.75, fillColor: '#54a9b7', fillOpacity: 0.14, zIndex: 250 }),
          new sdk.Marker({ position, content: '<span class="live-location-dot"><span></span></span>', offset: new sdk.Pixel(-12, -12), zIndex: 300 }),
        ]
    if (tourMode) tourMarker = locationOverlays[0]
    map.add(locationOverlays)
  }
  function renderState(state: MapState) {
    currentState = state
    insets = state.insets ?? { top: 65, right: 65, bottom: 65, left: 65 }
    if (state.tilt !== undefined) baseTilt = state.tilt
    if ((state.route?.id ?? '') !== previousRoute) { rebuildTourPath(); roamDistance = 0 }
    map.remove(overlays)
    overlays = []
    if (state.route?.geometry.length) overlays.push(new sdk.Polyline({
      path: state.route.geometry.map(wgs84ToGcj02),
      strokeColor: tourMode ? '#08a9e6' : state.route.color,
      strokeWeight: tourMode ? 12 : 5,
      strokeOpacity: 1,
      showDir: tourMode,
      strokeStyle: tourMode ? 'solid' : 'dashed',
      outlineColor: '#ffffff',
      borderWeight: tourMode ? 3 : 1,
      isOutline: true,
      lineJoin: 'round',
      lineCap: 'round',
      zIndex: tourMode ? 280 : 50,
    }))
    for (const place of state.places) {
      if (!place.coordinate) continue
      if (tourMode) continue
      const marker = new sdk.Marker({ position: wgs84ToGcj02(place.coordinate), content: markerElement(place, state.route?.stopIds.indexOf(place.id) ?? -1, place.id === state.selectedPlaceId), offset: new sdk.Pixel(-18, -42), zIndex: place.id === state.selectedPlaceId ? 200 : 100 })
      marker.on('click', () => selectPlace(place.id))
      overlays.push(marker)
    }
    map.add(overlays)
    const insetsKey = JSON.stringify(insets)
    if (!tourMode && (previousRoute !== state.route?.id || previousPlace !== state.selectedPlaceId || previousInsets !== insetsKey)) fit()
    if (tourMode && previousPlace !== state.selectedPlaceId && state.selectedPlaceId) {
      const stop = state.places.find(place => place.id === state.selectedPlaceId)
      if (stop?.coordinate) roamDistance = distanceAlongPath(wgs84ToGcj02(stop.coordinate))
    }
    previousRoute = state.route?.id ?? ''
    previousPlace = state.selectedPlaceId
    previousInsets = insetsKey
    if (tourMode) { renderLocation(); followCamera() }
  }
  return {
    update: renderState,
    fit,
    zoom(direction) {
      if (tourMode) {
        tourZoom = Math.max(17, Math.min(20, tourZoom + direction))
        followCamera()
      } else map.setZoom(map.getZoom() + direction)
    },
    resize: () => { map.resize(); if (tourMode) followCamera() },
    setLocation(location) {
      liveLocation = location
      renderLocation()
      if (tourMode) followCamera()
    },
    focusLocation() {
      if (tourMode) { followCamera(); return true }
      if (!liveLocation) return false
      map.setZoomAndCenter(Math.max(map.getZoom(), 17), wgs84ToGcj02(liveLocation.coordinate), true)
      return true
    },
    setTourMode(enabled) {
      if (enabled && !currentState.route?.geometry.length) return false
      tourMode = enabled
      map.setFeatures(enabled ? ['bg', 'road', 'building'] : ['bg', 'point', 'road', 'building'])
      renderState(currentState)
      renderLocation()
      if (!enabled) {
        stopRoam()
        fit()
        return true
      }
      startRoam()
      followCamera()
      return true
    },
    destroy() { stopRoam(); map.remove(locationOverlays); map.destroy() },
  }
}
