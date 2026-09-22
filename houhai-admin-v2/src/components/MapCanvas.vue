<script setup lang="ts">
import L from 'leaflet'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CulturalPlace, Destination, TourRoute } from '../types'

const props = defineProps<{ destination: Destination; places: CulturalPlace[]; route?: TourRoute | null; activePlaceId?: string; showMarkerLabels?: boolean }>()
const emit = defineEmits<{ selectPlace: [id: string] }>()
const element = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let layerGroup: L.LayerGroup | null = null

function markerIcon(index: number, active: boolean, label: string) {
  const markerNumber = props.showMarkerLabels ? String(index + 1).padStart(2, '0') : String(index + 1)
  return L.divIcon({
    className: '',
    html: `<span class="map-marker-wrap"><span class="map-pin ${active ? 'is-active' : ''}">${markerNumber}</span>${props.showMarkerLabels ? `<span class="map-pin-label ${active ? 'is-active' : ''}">${label}</span>` : ''}</span>`,
    iconSize: [32, 32], iconAnchor: [16, 16],
  })
}

function renderLayers() {
  if (!map) return
  layerGroup?.remove()
  layerGroup = L.layerGroup().addTo(map)
  const routePlaceIds = props.route?.stops.map(stop => stop.placeId) ?? []
  const visible = props.route ? props.places.filter(place => routePlaceIds.includes(place.id)) : props.places
  visible.forEach((place, index) => {
    const marker = L.marker([place.latitude, place.longitude], { icon: markerIcon(index, place.id === props.activePlaceId, place.name) })
      .bindTooltip(place.name, { direction: 'top', offset: [0, -14] })
      .on('click', () => emit('selectPlace', place.id))
    marker.addTo(layerGroup!)
  })
  if (props.route?.geometry.length) {
    L.polyline(props.route.geometry.map(point => [point.latitude, point.longitude] as L.LatLngTuple), { color:'#c58536',weight:6,opacity:.92,lineCap:'round',dashArray:'1 11' }).addTo(layerGroup)
  }
  const points = visible.map(place => [place.latitude, place.longitude] as L.LatLngTuple)
  if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [38, 38] })
  else map.setView([props.destination.latitude, props.destination.longitude], 15)
}

onMounted(async () => {
  await nextTick()
  if (!element.value) return
  map = L.map(element.value, { zoomControl:false, attributionControl:true }).setView([props.destination.latitude, props.destination.longitude], 15)
  L.control.zoom({ position:'bottomright' }).addTo(map)
  L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; OpenStreetMap contributors', maxZoom:19 }).addTo(map)
  renderLayers()
})
watch(() => [props.route, props.places, props.activePlaceId], renderLayers, { deep:true })
onBeforeUnmount(() => { map?.remove(); map = null })
</script>

<template><div ref="element" class="map-canvas" /></template>
