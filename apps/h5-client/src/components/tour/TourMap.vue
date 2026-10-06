<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { boundaryPolygons, circleToRing, parseBoundary, type ApproachPoint, type PlaceRange } from '@path-seeker/ts-shared'
import { loadAMap } from '@/services/amap'
import { transformWgs84ToGcj02 } from '@/composables/useBrowserLocation'
import type { ClientCatalog, ClientTourDetail } from '@/types/clientCatalog'

interface TourLocation {
  longitude: number
  latitude: number
  accuracy?: number
  heading?: number | null
  timestamp?: number
}

const props = defineProps<{ catalog: ClientCatalog | null; detail: ClientTourDetail | null; currentStopId: string | null; journey: boolean; location: TourLocation | null }>()
const emit = defineEmits<{ select: [id: string]; error: [] }>()
const container = useTemplateRef<HTMLDivElement>('container')
const map = shallowRef<any>(null)
/** 跟随视角：把实时位置压在屏幕下方四分之一处，前方留视野 */
const following = shallowRef(false)
let sdk: any
let overlays: any[] = []
let userMarker: any
let alive = true

/** 跟随模式下当前应保持的缩放级别；缩放按钮改它，镜头重算不再覆盖用户选择 */
let followZoom = 17

const FOLLOW_PITCH = 50
const OVERVIEW_INSETS: [number, number, number, number] = [90, 45, 230, 45]

function coordinate(longitude: number, latitude: number): [number, number] {
  const point = transformWgs84ToGcj02(longitude, latitude)
  return [point.longitude, point.latitude]
}

function geometryLines(source: string | null | undefined): number[][][] {
  if (!source) return []
  try {
    const parsed = JSON.parse(source)
    const geometry = parsed.type === 'Feature' ? parsed.geometry : parsed
    const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.type === 'MultiLineString' ? geometry.coordinates : []
    return lines.filter((line: unknown) => Array.isArray(line) && line.every(point => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])))
  } catch { return [] }
}

/** 一个环：[[lng, lat], ...]；绘制前统一由 coordinate() 转 GCJ-02 */
function projectRing(ring: [number, number][]): number[][] {
  return ring.map(point => coordinate(point[0], point[1]))
}

/**
 * 景点范围的多边形路径（每个多边形含外环与内环，交给 AMap 的 Polygon 处理）。
 * 几何解析与圆环生成都用 ts-shared 的共享实现，C 端不再自写第二份。
 */
function rangePolygons(range: PlaceRange | null | undefined, anchor: ApproachPoint | null): number[][][][] {
  if (!range || range.type === 'point') return []
  const geometry = parseBoundary(range.boundaryGeoJson)
  if (geometry) return boundaryPolygons(geometry).map(polygon => polygon.map(projectRing))
  // 圆形缺少边界几何时用共享工具生成环（判定仍按半径计算，绘制只为展示）
  if (range.type === 'circle' && anchor && range.radiusMeters) return [[projectRing(circleToRing(anchor, range.radiusMeters))]]
  return []
}

/** 文化点锚点：优先文化点经纬度，缺坐标时回落到站点坐标 */
function rangeAnchor(stopLongitude: number | null, stopLatitude: number | null, place: { longitude: number | null; latitude: number | null } | null): ApproachPoint | null {
  const longitude = place?.longitude ?? stopLongitude
  const latitude = place?.latitude ?? stopLatitude
  if (longitude == null || latitude == null) return null
  return { longitude, latitude }
}

function fitRoute(animated = false) {
  if (!map.value) return
  map.value.setRotation(0, animated)
  map.value.setPitch(props.journey ? FOLLOW_PITCH : 0, animated)
  if (overlays.length) map.value.setFitView(overlays, animated, OVERVIEW_INSETS)
}

function render() {
  if (!map.value || !sdk) return
  map.value.remove(overlays)
  overlays = []
  const stops = [...(props.detail?.stops ?? [])].sort((left, right) => left.order - right.order)
  const places = props.catalog?.places ?? []
  const placeById = new Map(places.map(place => [place.id, place]))
  const destination = props.catalog?.destinations?.find(item => item.id === props.detail?.route?.destinationId)
  // 先铺范围面（目的地边界 → 景点范围），再画路线与站点标注，避免遮挡标注
  const destinationBoundary = parseBoundary(destination?.boundaryGeoJson)
  if (destinationBoundary) {
    for (const polygon of boundaryPolygons(destinationBoundary)) {
      overlays.push(new sdk.Polygon({ path: polygon.map(projectRing), strokeColor: '#c7a257', strokeWeight: 2, fillColor: '#c7a257', fillOpacity: 0.08, zIndex: 5, bubble: true }))
    }
  }
  const drawnPlaces = new Set<string>()
  for (const stop of stops) {
    const place = stop.placeId ? placeById.get(stop.placeId) : undefined
    if (!place || drawnPlaces.has(place.id)) continue
    const anchor = rangeAnchor(stop.longitude, stop.latitude, place)
    const polygons = rangePolygons(place.range, anchor)
    if (!polygons.length) continue
    drawnPlaces.add(place.id)
    for (const path of polygons) {
      overlays.push(new sdk.Polygon({ path, strokeColor: '#24616a', strokeWeight: 2, fillColor: '#24616a', fillOpacity: 0.12, zIndex: 6, bubble: true }))
    }
  }
  const lines = geometryLines(props.detail?.geometry || props.detail?.route?.geometry)
  for (const line of lines) overlays.push(new sdk.Polyline({ path: line.map(point => coordinate(point[0]!, point[1]!)), strokeColor: '#24616a', strokeWeight: 7, strokeOpacity: 0.9 }))
  for (const stop of stops) {
    if (stop.longitude == null || stop.latitude == null) continue
    const content = document.createElement('button')
    content.type = 'button'
    content.className = stop.id === props.currentStopId ? 'tour-map-marker active' : 'tour-map-marker'
    content.textContent = `${stop.order}. ${stop.name || ''}`
    content.setAttribute('aria-label', stop.name || String(stop.order))
    const marker = new sdk.Marker({ position: coordinate(stop.longitude, stop.latitude), content, anchor: 'bottom-center', zIndex: 100 })
    marker.on('click', () => emit('select', stop.id))
    overlays.push(marker)
  }
  map.value.add(overlays)
  if (overlays.length) map.value.setFitView(overlays, false, OVERVIEW_INSETS)
  else {
    const center = destination ?? props.catalog?.destinations?.[0]
    if (center?.longitude != null && center.latitude != null) map.value.setCenter(coordinate(center.longitude, center.latitude))
  }
  focusStop()
  applyFollow()
}

/** 行程中把镜头落到当前站点；跟随视角开着时交给 applyFollow */
function focusStop() {
  if (!map.value || following.value) return
  map.value.setPitch(props.journey ? FOLLOW_PITCH : 0)
  const stop = props.detail?.stops?.find(item => item.id === props.currentStopId)
  if (props.journey && stop?.longitude != null && stop.latitude != null) map.value.setZoomAndCenter(18, coordinate(stop.longitude, stop.latitude))
}

function renderLocation() {
  if (!map.value || !sdk || !props.location) return
  const position = coordinate(props.location.longitude, props.location.latitude)
  if (!userMarker) {
    const content = document.createElement('div')
    content.className = 'tour-map-location'
    userMarker = new sdk.Marker({ position, content, anchor: 'center', zIndex: 150 })
    map.value.add(userMarker)
  } else userMarker.setPosition(position)
  applyFollow()
}

/**
 * 跟随镜头：俯仰抬起、按行进方向转正，再把位置压到屏幕下方 1/4 处。
 * 高德是透视投影，一次 setCenter 到不了位，按容器锚点迭代校正。
 */
function applyFollow() {
  if (!following.value || !map.value || !props.location) return
  const position = coordinate(props.location.longitude, props.location.latitude)
  map.value.setPitch(FOLLOW_PITCH)
  const heading = props.location.heading
  if (typeof heading === 'number' && Number.isFinite(heading)) {
    map.value.setRotation((360 - heading) % 360)
  }
  map.value.setZoomAndCenter(followZoom, position)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!container.value) break
    const anchor = map.value.containerToLngLat([container.value.clientWidth / 2, container.value.clientHeight * 0.75])
    const center = map.value.getCenter()
    map.value.setCenter([center.getLng() + position[0] - anchor.getLng(), center.getLat() + position[1] - anchor.getLat()])
  }
}

function setFollowing(next: boolean) {
  // 没有定位就不进跟随，交给「开启近站讲解」先拿到位置
  if (next && !props.location) return false
  following.value = next
  if (next) applyFollow()
  else fitRoute(false)
  return following.value
}

/** 缩放手势交给底部工具栏；跟随中同步记下级别，避免下一秒被镜头重算覆盖 */
function zoomBy(delta: number) {
  if (!map.value) return
  const next = Math.min(19, Math.max(3, Number(map.value.getZoom()) + delta))
  followZoom = next
  map.value.setZoom(next)
}

/** 全览：退出跟随，恢复正北朝上与整条路线可见 */
function overview() {
  if (following.value) following.value = false
  fitRoute(true)
}

onMounted(async () => {
  try {
    sdk = await loadAMap()
    if (!alive || !container.value) return
    map.value = new sdk.Map(container.value, { zoom: 16, center: [116.38, 39.94], viewMode: '3D' })
    render()
    renderLocation()
  } catch { if (alive) emit('error') }
})
watch(() => [props.catalog, props.detail], render)
watch(() => [props.currentStopId, props.journey], render)
watch(() => props.location, renderLocation)
// 结束行程后镜头不该还跟着一个已释放的定位
watch(() => props.journey, value => { if (!value) following.value = false })
onBeforeUnmount(() => { alive = false; map.value?.destroy(); map.value = null })

defineExpose({ zoomBy, overview, setFollowing, following })
</script>

<template><div ref="container" class="tour-map" /></template>

<style scoped>
.tour-map{position:absolute;inset:0;background:#d9d5c9}
.tour-map :deep(.tour-map-marker){max-width:180px;border:2px solid #fff;background:#fff;color:#2b4039;border-radius:8px;padding:6px 10px;font-size:12px;box-shadow:0 3px 10px #183e4330;white-space:nowrap}
.tour-map :deep(.tour-map-marker.active){background:#183e43;color:#fff}
.tour-map :deep(.tour-map-location){width:18px;height:18px;border:3px solid #fff;background:#287f91;border-radius:50%;box-shadow:0 0 0 7px #287f9133}
</style>
