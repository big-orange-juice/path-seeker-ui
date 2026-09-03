<script setup lang="ts">
import { onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import type { OutdoorMapSceneResponse, OutdoorRouteMapResponse } from '@path-seeker/ts-shared'
import type { BrowserLocationResult } from '@/composables/useBrowserLocation'

const props = defineProps<{ scene: OutdoorMapSceneResponse | null; routeMap: OutdoorRouteMapResponse | null; focusedAssetId: string | null; userLocation: BrowserLocationResult | null }>()
const emit = defineEmits<{ assetSelect: [assetId: string]; stationSelect: [stationId: string]; error: [message: string] }>()
const container = useTemplateRef<HTMLDivElement>('container')
const map = shallowRef<any>(null)
const assetLayer = shallowRef<any>(null)
const stationLayer = shallowRef<any>(null)
const routeLayer = shallowRef<any>(null)
const boundaryLayers = shallowRef<any[]>([])
const userLayer = shallowRef<any>(null)
let sdkPromise: Promise<any> | null = null

function markerIcon(color: string, ring = '#fff7e6') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path fill="${color}" stroke="${ring}" stroke-width="3" d="M16 2C8.8 2 3 7.8 3 15c0 9.6 13 23 13 23s13-13.4 13-23C29 7.8 23.2 2 16 2Z"/><circle cx="16" cy="15" r="4" fill="${ring}"/></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function loadSdk() {
  const existing = (window as any).TMap
  if (existing) return Promise.resolve(existing)
  if (sdkPromise) return sdkPromise
  const key = String(import.meta.env.VITE_TENCENT_MAP_KEY || '').trim()
  if (!key) return Promise.reject(new Error('地图服务尚未配置'))
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = 'tencent-map-gl-client-sdk'
    script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(key)}`
    script.onload = () => resolve((window as any).TMap)
    script.onerror = () => reject(new Error('地图服务加载失败，请稍后重试'))
    document.head.appendChild(script)
  })
  return sdkPromise
}

function parseGeometry(geoJson: string | null | undefined) {
  if (!geoJson) return null
  try { return JSON.parse(geoJson) as { type: string; coordinates: unknown } } catch { return null }
}

function lineStrings() {
  const geometry = parseGeometry(props.routeMap?.geometryGeoJson)
  if (!geometry) return [] as number[][][]
  if (geometry.type === 'LineString') return [geometry.coordinates as number[][]]
  if (geometry.type === 'MultiLineString') return geometry.coordinates as number[][][]
  return [] as number[][][]
}

function polygonPaths(TMap: any, geoJson: string | null | undefined) {
  const geometry = parseGeometry(geoJson)
  if (!geometry) return [] as any[][]
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates as number[][][]] : geometry.type === 'MultiPolygon' ? geometry.coordinates as number[][][][] : []
  return polygons.map(polygon => polygon[0].map(point => new TMap.LatLng(point[1], point[0])))
}

async function renderMap() {
  if (!container.value || !props.scene?.museum) return
  try {
    const TMap = await loadSdk()
    const center = new TMap.LatLng(props.scene.museum.latitude ?? 31.23, props.scene.museum.longitude ?? 121.47)
    if (!map.value) map.value = new TMap.Map(container.value, { center, zoom: 16 })
    assetLayer.value?.setMap(null); stationLayer.value?.setMap(null); routeLayer.value?.setMap(null); userLayer.value?.setMap(null)
    boundaryLayers.value.forEach(layer => layer.setMap(null)); boundaryLayers.value = []

    const boundaryGeometries = [props.scene.museum.boundaryGeoJson, ...props.scene.areas.map(area => area.boundaryGeoJson)]
      .flatMap((geometry, group) => polygonPaths(TMap, geometry).map((paths, index) => ({ id: `boundary-${group}-${index}`, styleId: group === 0 ? 'site' : 'area', paths })))
    if (boundaryGeometries.length) boundaryLayers.value = [new TMap.MultiPolygon({ map: map.value, styles: { site: new TMap.PolygonStyle({ color: 'rgba(187,139,58,.12)', showBorder: true, borderColor: '#a47732', borderWidth: 2 }), area: new TMap.PolygonStyle({ color: 'rgba(187,139,58,.05)', showBorder: true, borderColor: '#c7a968', borderWidth: 1 }) }, geometries: boundaryGeometries })]

    const assets = props.scene.assets.filter(item => item.primaryLocation?.latitude != null && item.primaryLocation?.longitude != null)
      .map(item => ({ id: item.id, styleId: item.id === props.focusedAssetId ? 'active' : 'default', position: new TMap.LatLng(item.primaryLocation!.latitude, item.primaryLocation!.longitude) }))
    if (assets.length) {
      assetLayer.value = new TMap.MultiMarker({ map: map.value, styles: { default: new TMap.MarkerStyle({ width: 26, height: 34, anchor: { x: 13, y: 34 }, src: markerIcon('#8a6030') }), active: new TMap.MarkerStyle({ width: 32, height: 40, anchor: { x: 16, y: 40 }, src: markerIcon('#d29a3d') }) }, geometries: assets })
      assetLayer.value.on('click', (event: { geometry?: { id?: string } }) => { if (event.geometry?.id) emit('assetSelect', event.geometry.id) })
    }

    const lines = lineStrings()
    if (lines.length) routeLayer.value = new TMap.MultiPolyline({ map: map.value, styles: { route: new TMap.PolylineStyle({ color: '#d4a447', width: 8, borderWidth: 2, borderColor: '#2b2115', lineCap: 'round' }) }, geometries: lines.map((line, index) => ({ id: `route-${index}`, styleId: 'route', paths: line.map(point => new TMap.LatLng(point[1], point[0])) })) })
    if (props.routeMap?.stations.length) {
      stationLayer.value = new TMap.MultiMarker({ map: map.value, styles: { station: new TMap.MarkerStyle({ width: 24, height: 31, anchor: { x: 12, y: 31 }, src: markerIcon('#16130f', '#f2cf82') }) }, geometries: props.routeMap.stations.map(station => ({ id: station.id, styleId: 'station', position: new TMap.LatLng(station.latitude, station.longitude) })) })
      stationLayer.value.on('click', (event: { geometry?: { id?: string } }) => { if (event.geometry?.id) emit('stationSelect', event.geometry.id) })
    }
    if (props.userLocation) userLayer.value = new TMap.MultiMarker({ map: map.value, styles: { user: new TMap.MarkerStyle({ width: 22, height: 22, anchor: { x: 11, y: 11 }, src: markerIcon('#2878d0') }) }, geometries: [{ id: 'user', styleId: 'user', position: new TMap.LatLng(props.userLocation.latitude, props.userLocation.longitude) }] })

    const routePoints = lines.flat()
    if (routePoints.length > 1) { const bounds = new TMap.LatLngBounds(); routePoints.forEach(point => bounds.extend(new TMap.LatLng(point[1], point[0]))); map.value.fitBounds(bounds, { padding: 70 }) }
    else if (props.focusedAssetId) { const asset = props.scene.assets.find(item => item.id === props.focusedAssetId); if (asset?.primaryLocation) map.value.easeTo({ center: new TMap.LatLng(asset.primaryLocation.latitude, asset.primaryLocation.longitude), zoom: 18 }) }
    else if (props.userLocation) map.value.easeTo({ center: new TMap.LatLng(props.userLocation.latitude, props.userLocation.longitude), zoom: 17 })
  } catch (caught) { emit('error', caught instanceof Error ? caught.message : '地图加载失败') }
}

watch(() => [props.scene, props.routeMap, props.focusedAssetId, props.userLocation], () => void renderMap(), { immediate: true })
onBeforeUnmount(() => { assetLayer.value?.setMap(null); stationLayer.value?.setMap(null); routeLayer.value?.setMap(null); userLayer.value?.setMap(null); boundaryLayers.value.forEach(layer => layer.setMap(null)); map.value?.destroy(); map.value = null })
</script>

<template><div ref="container" class="outdoor-map-canvas" /></template>
<style scoped>.outdoor-map-canvas{position:absolute;inset:0;background:#ded7c7}</style>
