<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { loadAMap } from '@/services/amap'
import { transformWgs84ToGcj02 } from '@/composables/useBrowserLocation'
import type { ClientCatalog, ClientTourDetail } from '@/types/clientCatalog'

const props = defineProps<{ catalog: ClientCatalog | null; detail: ClientTourDetail | null; currentStopId: string | null; journey: boolean; location: { longitude: number; latitude: number } | null }>()
const emit = defineEmits<{ select: [id: string]; error: [] }>()
const container = useTemplateRef<HTMLDivElement>('container')
const map = shallowRef<any>(null)
let sdk: any
let overlays: any[] = []
let userMarker: any
let alive = true

function coordinate(longitude: number, latitude: number) {
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

function render() {
  if (!map.value || !sdk) return
  map.value.remove(overlays)
  overlays = []
  const stops = [...(props.detail?.stops ?? [])].sort((left, right) => left.order - right.order)
  for (const stop of stops) {
    if (stop.longitude == null || stop.latitude == null) continue
    const content = document.createElement('button')
    content.type = 'button'
    content.className = stop.id === props.currentStopId ? 'tour-map-marker active' : 'tour-map-marker'
    content.textContent = `${stop.order}. ${stop.name || ''}`
    content.setAttribute('aria-label', stop.name || String(stop.order))
    const marker = new sdk.Marker({ position: coordinate(stop.longitude, stop.latitude), content, anchor: 'bottom-center' })
    marker.on('click', () => emit('select', stop.id))
    overlays.push(marker)
  }
  const lines = geometryLines(props.detail?.geometry || props.detail?.route?.geometry)
  for (const line of lines) overlays.push(new sdk.Polyline({ path: line.map(point => coordinate(point[0]!, point[1]!)), strokeColor: '#327dce', strokeWeight: 7, strokeOpacity: 0.9 }))
  map.value.add(overlays)
  if (overlays.length) map.value.setFitView(overlays, false, [90, 45, 230, 45])
  else {
    const destination = props.catalog?.destinations?.find(item => item.id === props.detail?.route?.destinationId) ?? props.catalog?.destinations?.[0]
    if (destination?.longitude != null && destination.latitude != null) map.value.setCenter(coordinate(destination.longitude, destination.latitude))
  }
  focusStop()
}

function focusStop() {
  if (!map.value) return
  map.value.setPitch(props.journey ? 50 : 0)
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
onBeforeUnmount(() => { alive = false; map.value?.destroy(); map.value = null })
</script>

<template><div ref="container" class="tour-map" /></template>

<style scoped>
.tour-map{position:absolute;inset:0;background:#d9d5c9}
.tour-map :deep(.tour-map-marker){max-width:180px;border:2px solid #fff;background:#fff;color:#283749;border-radius:8px;padding:6px 10px;font-size:12px;box-shadow:0 3px 10px #0003;white-space:nowrap}
.tour-map :deep(.tour-map-marker.active){background:#327dce;color:#fff}
.tour-map :deep(.tour-map-location){width:18px;height:18px;border:3px solid #fff;background:#327dce;border-radius:50%;box-shadow:0 0 0 7px #327dce33}
</style>
