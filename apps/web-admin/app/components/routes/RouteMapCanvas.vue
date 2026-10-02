<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { gcj02ToWgs84, toGcj02 } from '@path-seeker/ts-shared'
import { loadAdminAMap } from '@/utils/amap'
import type { RouteMapDetail } from '@/types/route-map'

const props = withDefaults(defineProps<{ detail: RouteMapDetail | null; editStationId?: string; drawingSegmentNo?: number | null; focusedStageId?: string; journey?: boolean }>(), { editStationId: '', drawingSegmentNo: null, focusedStageId: '', journey: false })
const emit = defineEmits<{ error: [message: string]; stationMove: [payload: { stationId: string; longitude: number; latitude: number }]; drawChange: [coordinates: number[][]]; select: [stageId: string]; edit: [stageId: string] }>()
const container = useTemplateRef<HTMLDivElement>('container')
const map = shallowRef<any>(null)
const runtimeConfig = useRuntimeConfig()
let sdk: any
let layers: any[] = []
let draftLayer: any
let draft: number[][] = []
let alive = true

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

function render(fit = true) {
  if (!map.value || !sdk) return
  map.value.remove(layers)
  layers = []
  for (const station of props.detail?.stations ?? []) {
    const stageId = station.stageId || station.id
    const content = document.createElement('button')
    content.type = 'button'
    content.textContent = `${station.stationNo}. ${station.title}`
    content.className = stageId === props.focusedStageId ? 'route-map-marker active' : 'route-map-marker'
    const marker = new sdk.Marker({ position: position(station.longitude, station.latitude), content, anchor: 'bottom-center' })
    marker.on('click', () => emit('select', stageId))
    marker.on('dblclick', () => emit('edit', stageId))
    layers.push(marker)
  }
  for (const line of parseLines(props.detail?.geometryGeoJson)) layers.push(new sdk.Polyline({ path: line.map(point => position(point[0]!, point[1]!)), strokeColor: '#327dce', strokeWeight: 7 }))
  map.value.add(layers)
  if (fit && layers.length) map.value.setFitView(layers, false, [70, 50, 70, 50])
  map.value.setPitch(props.journey ? 50 : 0)
  const selected = props.detail?.stations.find(station => (station.stageId || station.id) === props.focusedStageId)
  if (selected && props.journey) map.value.setZoomAndCenter(18, position(selected.longitude, selected.latitude))
}

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
    sdk = await loadAdminAMap({ key: String(runtimeConfig.public.amapKey || ''), securityCode: String(runtimeConfig.public.amapSecurityCode || ''), securityProxy: String(runtimeConfig.public.amapSecurityProxy || '') })
    if (!alive || !container.value) return
    map.value = new sdk.Map(container.value, { center: [116.38, 39.94], zoom: 16, viewMode: '3D' })
    map.value.on('click', mapClick)
    render()
  } catch (caught) { if (alive) emit('error', caught instanceof Error ? caught.message : '地图初始化失败。') }
})
watch(() => props.detail, () => render())
watch(() => [props.focusedStageId, props.journey], () => render(false))
watch(() => props.drawingSegmentNo, () => { draft = []; renderDraft(); emit('drawChange', []) })
onBeforeUnmount(() => { alive = false; map.value?.destroy(); map.value = null })
</script>

<template><div ref="container" class="route-map-canvas" /></template>

<style scoped>
.route-map-canvas{height:100%;min-height:280px;width:100%;background:#ddd8cc}
.route-map-canvas :deep(.route-map-marker){max-width:180px;padding:6px 10px;border:2px solid #fff;border-radius:8px;background:#fff;color:#273744;font-size:12px;white-space:nowrap;box-shadow:0 3px 12px #0003}
.route-map-canvas :deep(.route-map-marker.active){background:#327dce;color:#fff}
</style>
