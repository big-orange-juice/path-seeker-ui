<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { gcj02ToWgs84, toGcj02 } from '@path-seeker/ts-shared'
import { loadAdminAMap } from '@/utils/amap'
import type { RouteMapDetail } from '@/types/route-map'

const props = withDefaults(defineProps<{ detail: RouteMapDetail | null; editStationId?: string; drawingSegmentNo?: number | null; focusedStageId?: string; journey?: boolean; presentation?: 'default' | 'workspace' }>(), { editStationId: '', drawingSegmentNo: null, focusedStageId: '', journey: false, presentation: 'default' })
const emit = defineEmits<{ error: [message: string]; stationMove: [payload: { stationId: string; longitude: number; latitude: number }]; drawChange: [coordinates: number[][]]; select: [stageId: string]; edit: [stageId: string] }>()
const container = useTemplateRef<HTMLDivElement>('container')
const map = shallowRef<any>(null)
const runtimeConfig = useRuntimeConfig()
let sdk: any
let layers: any[] = []
let draftLayer: any
let draft: number[][] = []
let alive = true
let observer: ResizeObserver | null = null
let lastTap = { stageId: '', at: 0 }

function position(longitude: number, latitude: number, coordinateSystem = props.detail?.coordinateSystem ?? 1) {
  const converted = toGcj02({ longitude, latitude }, coordinateSystem)
  return [converted.longitude, converted.latitude]
}

function parseLines(source: string | null | undefined): number[][][] {
  if (!source) return []
  try {
    const parsed = JSON.parse(source)
    const geometry = parsed.type === 'Feature' ? parsed.geometry : parsed
    const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.type === 'MultiLineString' ? geometry.coordinates : []
    return lines.filter((line: unknown) => Array.isArray(line) && line.every(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])))
  } catch { return [] }
}

function render(fit = true, focus = true) {
  if (!map.value || !sdk) return
  map.value.remove(layers)
  layers = []
  for (const station of props.detail?.stations ?? []) {
    const stageId = station.stageId || station.id
    const content = document.createElement('button')
    content.type = 'button'
    content.className = ['route-map-marker', stageId === props.focusedStageId ? 'active' : '', props.presentation === 'workspace' ? 'workspace-marker' : '', props.journey ? 'journey-marker' : ''].join(' ')
    content.setAttribute('aria-label', `${station.stationNo}. ${station.title}`)
    if (props.presentation === 'workspace') {
      const number = document.createElement('span')
      number.className = 'marker-number'
      number.textContent = props.journey ? String(station.stationNo).padStart(2, '0') : String(station.stationNo)
      content.append(number)
      if (props.journey) {
        const label = document.createElement('span')
        label.className = 'marker-label'
        label.textContent = station.title
        content.append(label)
      }
    } else content.textContent = `${station.stationNo}. ${station.title}`
    const marker = new sdk.Marker({ position: position(station.longitude, station.latitude, station.coordinateSystem ?? props.detail?.coordinateSystem ?? 1), content, anchor: props.presentation === 'workspace' ? 'center' : 'bottom-center', zIndex: stageId === props.focusedStageId ? 220 : 160 })
    marker.on('click', () => {
      const now = Date.now()
      const doubleTap = lastTap.stageId === stageId && now - lastTap.at < 380
      lastTap = { stageId, at: doubleTap ? 0 : now }
      if (doubleTap) emit('edit', stageId)
      else emit('select', stageId)
    })
    marker.on('dblclick', () => emit('edit', stageId))
    layers.push(marker)
  }
  for (const line of parseLines(props.detail?.geometryGeoJson)) layers.push(new sdk.Polyline({ path: line.map(point => position(point[0]!, point[1]!)), strokeColor: props.presentation === 'workspace' ? (props.journey ? '#08a9e6' : '#c58536') : '#327dce', strokeWeight: props.journey ? 8 : 5, strokeStyle: props.presentation === 'workspace' && !props.journey ? 'dashed' : 'solid', showDir: props.journey, isOutline: props.journey, outlineColor: '#fff', borderWeight: 2, zIndex: 50 }))
  map.value.add(layers)
  if (fit && layers.length) map.value.setFitView(layers, false, [70, 50, 70, 50])
  map.value.setPitch(props.journey ? 50 : 0)
  const selected = props.detail?.stations.find(station => (station.stageId || station.id) === props.focusedStageId)
  if (selected && props.journey && focus) map.value.setZoomAndCenter(17, position(selected.longitude, selected.latitude, selected.coordinateSystem ?? props.detail?.coordinateSystem ?? 1))
}

function zoomBy(delta: number) { if (map.value) map.value.setZoom(map.value.getZoom() + delta) }
defineExpose({ zoomBy, fit: () => render(true, false), focus: () => render(false) })

function renderDraft() {
  if (!map.value || !sdk) return
  if (draftLayer) map.value.remove(draftLayer)
  draftLayer = null
  if (draft.length > 1) {
    draftLayer = new sdk.Polyline({ path: draft.map(point => position(point[0]!, point[1]!, 1)), strokeColor: '#d6aa54', strokeWeight: 5, strokeStyle: 'dashed' })
    map.value.add(draftLayer)
  }
}

function mapClick(event: { lnglat: { getLng: () => number; getLat: () => number } }) {
  const point = gcj02ToWgs84({ longitude: event.lnglat.getLng(), latitude: event.lnglat.getLat() })
  if (props.editStationId) emit('stationMove', { stationId: props.editStationId, ...point })
  else if (props.drawingSegmentNo !== null) { draft = [...draft, [point.longitude, point.latitude]]; renderDraft(); emit('drawChange', draft) }
}

onMounted(async () => {
  try {
    await nextTick()
    sdk = await loadAdminAMap({ key: String(runtimeConfig.public.amapKey || ''), securityCode: String(runtimeConfig.public.amapSecurityCode || ''), securityProxy: String(runtimeConfig.public.amapSecurityProxy || '') })
    if (!alive || !container.value) return
    map.value = new sdk.Map(container.value, { center: [116.38, 39.94], zoom: 16, viewMode: '3D', resizeEnable: true, showBuildingBlock: true, wallColor: '#cad6e2', roofColor: '#edf3f8' })
    map.value.on('click', mapClick)
    render()
    observer = new ResizeObserver(() => map.value?.resize?.())
    observer.observe(container.value)
  } catch (caught) { if (alive) emit('error', caught instanceof Error ? caught.message : '地图初始化失败。') }
})
watch(() => props.detail, () => render())
watch(() => [props.focusedStageId, props.journey], () => render(false))
watch(() => props.drawingSegmentNo, () => { draft = []; renderDraft(); emit('drawChange', []) })
onBeforeUnmount(() => { alive = false; observer?.disconnect(); map.value?.destroy(); map.value = null })
</script>

<template><div ref="container" class="route-map-canvas" /></template>

<style scoped>
.route-map-canvas{position:relative;isolation:isolate;overflow:hidden;height:100%;min-height:0;width:100%;background:#ddd8cc}
.route-map-canvas :deep(.amap-maps){position:absolute;inset:0;width:100%;height:100%}
.route-map-canvas :deep(.route-map-marker){max-width:180px;padding:6px 10px;border:2px solid #fff;border-radius:8px;background:#fff;color:#273744;font-size:12px;white-space:nowrap;box-shadow:0 3px 12px #0003}
.route-map-canvas :deep(.route-map-marker.active){background:#327dce;color:#fff}
.route-map-canvas :deep(.workspace-marker){display:flex;align-items:center;justify-content:center;width:34px;height:34px;max-width:none;padding:0;border:3px solid #fff;border-radius:50%;background:#c58536;color:#fff;font-size:14px;font-weight:700;overflow:visible;box-shadow:0 3px 12px #0005}
.route-map-canvas :deep(.workspace-marker.active){background:#183e43}
.route-map-canvas :deep(.journey-marker){width:26px;height:26px;border-width:2px;background:#183e43;font-size:9px}
.route-map-canvas :deep(.journey-marker.active){background:#e5b957;color:#493f24}
.route-map-canvas :deep(.marker-label){position:absolute;top:30px;left:50%;transform:translateX(-50%);padding:3px 6px;border:1px solid #dce5de;border-radius:4px;background:#fff;color:#355149;white-space:nowrap;font-size:8px}
.route-map-canvas :deep(.journey-marker.active .marker-label){background:#183e43;color:#fff;border-color:#183e43}
</style>
