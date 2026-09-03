<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import type { RouteMapDetail } from '@/types/route-map'

const props = defineProps<{ detail: RouteMapDetail | null; editStationId: string; drawingSegmentNo: number | null }>()
const emit = defineEmits<{
  error: [message: string]
  stationMove: [payload: { stationId: string; longitude: number; latitude: number }]
  drawChange: [coordinates: number[][]]
}>()
const container = shallowRef<HTMLElement | null>(null)
const map = shallowRef<any>(null)
const stationLayer = shallowRef<any>(null)
const routeLayer = shallowRef<any>(null)
const draftLayer = shallowRef<any>(null)
const draft = shallowRef<number[][]>([])
const runtimeConfig = useRuntimeConfig()
let clickListener: any = null

function loadSdk(key: string) {
  if ((window as any).TMap) return Promise.resolve((window as any).TMap)
  const id = 'tencent-map-gl-admin-sdk'
  return new Promise<any>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).TMap), { once: true })
      existing.addEventListener('error', () => reject(new Error('地图服务加载失败')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = id
    script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(key)}`
    script.onload = () => resolve((window as any).TMap)
    script.onerror = () => reject(new Error('地图服务加载失败'))
    document.head.appendChild(script)
  })
}

function parseLines(geoJson: string | null) {
  if (!geoJson) return [] as number[][][]
  try {
    const geometry = JSON.parse(geoJson) as { type: string; coordinates: number[][] | number[][][] }
    return geometry.type === 'LineString' ? [geometry.coordinates as number[][]] : geometry.type === 'MultiLineString' ? geometry.coordinates as number[][][] : []
  } catch {
    return [] as number[][][]
  }
}

function render() {
  const TMap = (window as any).TMap
  if (!map.value || !TMap || !props.detail) return
  stationLayer.value?.setMap(null)
  routeLayer.value?.setMap(null)
  const geometries = props.detail.stations.map(station => ({ id: station.id, styleId: 'station', position: new TMap.LatLng(station.latitude, station.longitude) }))
  if (geometries.length) {
    stationLayer.value = new TMap.MultiMarker({
      map: map.value,
      styles: { station: new TMap.MarkerStyle({ width: 22, height: 22, anchor: { x: 11, y: 11 }, src: 'https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png' }) },
      geometries,
    })
  }
  const lines = parseLines(props.detail.geometryGeoJson)
  if (lines.length) {
    routeLayer.value = new TMap.MultiPolyline({
      map: map.value,
      styles: { route: new TMap.PolylineStyle({ color: '#d6aa54', width: 7, borderWidth: 2, borderColor: '#2e2415', lineCap: 'round' }) },
      geometries: lines.map((line, index) => ({ id: `route-${index}`, styleId: 'route', paths: line.map(point => new TMap.LatLng(point[1], point[0])) })),
    })
  }
  const bounds = new TMap.LatLngBounds()
  props.detail.stations.forEach(station => bounds.extend(new TMap.LatLng(station.latitude, station.longitude)))
  if (props.detail.stations.length) map.value.fitBounds(bounds, { padding: 70 })
}

function renderDraft() {
  const TMap = (window as any).TMap
  draftLayer.value?.setMap(null)
  if (!map.value || !TMap || draft.value.length < 2) return
  draftLayer.value = new TMap.MultiPolyline({
    map: map.value,
    styles: { draft: new TMap.PolylineStyle({ color: '#2563eb', width: 5, borderWidth: 1, borderColor: '#ffffff' }) },
    geometries: [{ id: 'draft', styleId: 'draft', paths: draft.value.map(point => new TMap.LatLng(point[1], point[0])) }],
  })
}

function handleMapClick(event: any) {
  const longitude = Number(event.latLng.getLng())
  const latitude = Number(event.latLng.getLat())
  if (props.editStationId) {
    emit('stationMove', { stationId: props.editStationId, longitude, latitude })
    return
  }
  if (props.drawingSegmentNo !== null) {
    draft.value = [...draft.value, [longitude, latitude]]
    renderDraft()
    emit('drawChange', draft.value)
  }
}

watch(() => props.detail, render, { deep: false })
watch(() => props.drawingSegmentNo, () => { draft.value = []; draftLayer.value?.setMap(null); emit('drawChange', []) })
onMounted(async () => {
  const key = String(runtimeConfig.public.tencentMapKey || '').trim()
  if (!key) { emit('error', '请配置后台地图浏览 Key'); return }
  try {
    const TMap = await loadSdk(key)
    const first = props.detail?.stations[0]
    map.value = new TMap.Map(container.value, { center: new TMap.LatLng(first?.latitude ?? 31.23, first?.longitude ?? 121.47), zoom: 15 })
    clickListener = TMap.event.addListener(map.value, 'click', handleMapClick)
    render()
  } catch (error) { emit('error', error instanceof Error ? error.message : '地图初始化失败') }
})
onBeforeUnmount(() => {
  if (clickListener) (window as any).TMap?.event.removeListener(clickListener)
  stationLayer.value?.setMap(null); routeLayer.value?.setMap(null); draftLayer.value?.setMap(null); map.value?.destroy()
})
</script>

<template><div ref="container" class="h-full min-h-[420px] w-full bg-muted" /></template>
