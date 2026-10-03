<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import { toGcj02 } from '@path-seeker/ts-shared';
import Button from '@/components/shadcn/button/Button.vue';
import { loadAdminAMap } from '@/utils/amap';
import { boundaryPolygons, parseBoundary, type BoundaryPoint } from '@/utils/scenic-boundary';
import type { CulturalPlaceRecord } from '@/types/cultural-place';
import type { MuseumResponse } from '@/types/museum';

const props = defineProps<{ destination: MuseumResponse; places: CulturalPlaceRecord[]; activePlaceId: string; picking: boolean; movingPlaceId: string; disabled: boolean }>();
const emit = defineEmits<{ select: [id: string]; edit: [id: string]; pick: [point: { longitude: number; latitude: number; coordinateSystem: number }]; ready: [value: boolean] }>();
const container = useTemplateRef<HTMLDivElement>('container');
const runtimeConfig = useRuntimeConfig();
const error = shallowRef('');
const loading = shallowRef(true);
let sdk: any;
let map: any;
let layers: any[] = [];
let observer: ResizeObserver | null = null;
let alive = true;

function position(longitude: number, latitude: number, coordinateSystem = 1): BoundaryPoint {
  const point = toGcj02({ longitude, latitude }, coordinateSystem);
  return [point.longitude, point.latitude];
}

function render(fit = false) {
  if (!map) return;
  map.remove(layers);
  layers = [];
  const geometry = parseBoundary(props.destination.boundaryGeoJson);
  if (geometry) {
    for (const polygon of boundaryPolygons(geometry)) {
      layers.push(new sdk.Polygon({ path: polygon.map(ring => ring.map(point => position(point[0], point[1], props.destination.coordinateSystem ?? 1))), strokeColor: '#c7a257', strokeWeight: 3, fillColor: '#c7a257', fillOpacity: 0.13, bubble: true }));
    }
  }
  props.places.forEach((place, index) => {
    if (place.longitude == null || place.latitude == null) return;
    const content = document.createElement('button');
    content.type = 'button';
    content.className = ['scenic-place-marker', place.id === props.activePlaceId ? 'is-active' : '', place.status === 2 ? 'is-disabled' : ''].filter(Boolean).join(' ');
    content.textContent = `${index + 1}. ${place.name}`;
    content.title = `${place.name} · ${place.category || '景点'}`;
    const original = position(place.longitude, place.latitude, place.coordinateSystem);
    const marker = new sdk.Marker({ position: original, content, anchor: 'bottom-center', draggable: !props.disabled && place.id === props.movingPlaceId, zIndex: place.id === props.activePlaceId ? 200 : 100, bubble: false });
    marker.on('click', () => { if (!props.picking && !props.movingPlaceId) emit('select', place.id); });
    marker.on('dblclick', () => { if (!props.disabled && !props.picking && !props.movingPlaceId) emit('edit', place.id); });
    marker.on('dragend', () => {
      const point = marker.getPosition();
      marker.setPosition(original);
      if (!props.disabled) emit('pick', { longitude: point.getLng(), latitude: point.getLat(), coordinateSystem: 2 });
    });
    layers.push(marker);
  });
  map.add(layers);
  if (fit && layers.length) map.setFitView(layers, false, [60, 45, 60, 45], 17);
}

function focusPlace() {
  render();
  const place = props.places.find(item => item.id === props.activePlaceId);
  if (place?.longitude != null && place.latitude != null) map?.panTo(position(place.longitude, place.latitude, place.coordinateSystem));
}

function zoomBy(amount: number) {
  if (map) map.setZoom(map.getZoom() + amount);
}

async function initializeMap() {
  if (!alive || !container.value) return;
  observer?.disconnect();
  map?.destroy();
  map = null;
  layers = [];
  loading.value = true;
  error.value = '';
  emit('ready', false);
  try {
    sdk = await loadAdminAMap({ key: String(runtimeConfig.public.amapKey || ''), securityCode: String(runtimeConfig.public.amapSecurityCode || ''), securityProxy: String(runtimeConfig.public.amapSecurityProxy || '') });
    await nextTick();
    if (!alive || !container.value) return;
    const center = props.destination.longitude != null && props.destination.latitude != null
      ? position(props.destination.longitude, props.destination.latitude, props.destination.coordinateSystem ?? 1) : [116.38, 39.94];
    map = new sdk.Map(container.value, { center, zoom: 15, viewMode: '2D', resizeEnable: true, doubleClickZoom: false });
    map.on('click', (event: any) => {
      if (!props.disabled && (props.picking || props.movingPlaceId)) emit('pick', { longitude: event.lnglat.getLng(), latitude: event.lnglat.getLat(), coordinateSystem: 2 });
    });
    render(true);
    observer = new ResizeObserver(() => map?.resize?.());
    observer.observe(container.value);
    emit('ready', true);
  } catch (caught) { if (alive) error.value = caught instanceof Error ? caught.message : '地图加载失败。'; }
  finally { if (alive) loading.value = false; }
}

watch(() => props.places, (places, previous) => render(!previous.length && places.length > 0));
watch(() => props.destination.boundaryGeoJson, () => render(true));
watch(() => props.activePlaceId, focusPlace);
watch(() => [props.movingPlaceId, props.disabled], () => render());
onMounted(initializeMap);
onBeforeUnmount(() => { alive = false; observer?.disconnect(); map?.destroy(); });
defineExpose({ fit: () => render(true) });
</script>

<template>
  <div class="scenic-place-map-frame rounded-xl border border-border/70 bg-secondary/20">
    <div ref="container" class="scenic-place-map" :class="{ 'cursor-crosshair': picking || movingPlaceId }" />
    <div v-if="!loading && !error" class="absolute right-3 top-3 z-10 flex gap-1 rounded-lg border border-border bg-background/95 p-1">
      <Button size="sm" variant="ghost" aria-label="放大地图" @click="zoomBy(1)">＋</Button>
      <Button size="sm" variant="ghost" aria-label="缩小地图" @click="zoomBy(-1)">－</Button>
      <Button size="sm" variant="ghost" @click="render(true)">全览</Button>
    </div>
    <div v-if="loading || error" class="absolute inset-0 z-20 flex items-center justify-center bg-background/70 p-6 text-center text-sm">
      <div class="space-y-3"><p :class="error ? 'text-destructive' : 'text-muted-foreground'" role="status">{{ error || '正在加载高德地图…' }}</p><Button v-if="error" variant="outline" @click="initializeMap">重新加载地图</Button></div>
    </div>
  </div>
</template>

<style scoped>
.scenic-place-map-frame { position: relative; isolation: isolate; width: 100%; height: 100%; min-height: 420px; min-width: 0; overflow: hidden; }
.scenic-place-map { position: relative; isolation: isolate; width: 100%; height: 100%; min-height: 420px; overflow: hidden; }
.scenic-place-map :deep(.amap-maps) { position: absolute; inset: 0; width: 100%; height: 100%; }
.scenic-place-map :deep(.scenic-place-marker) { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 2px solid #fff; border-radius: 8px; padding: 6px 10px; background: #c7a257; color: #17191c; font-size: 12px; box-shadow: 0 3px 12px #0004; cursor: pointer; }
.scenic-place-map :deep(.scenic-place-marker.is-active) { background: #327dce; color: #fff; }
.scenic-place-map :deep(.scenic-place-marker.is-disabled) { opacity: 0.6; }
</style>
