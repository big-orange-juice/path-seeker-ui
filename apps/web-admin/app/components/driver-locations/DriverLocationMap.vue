<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import { loadAdminAMap } from '@/utils/amap';
import { driverStatusLabels, type DriverLocation } from '@/types/driver-location';

const props = defineProps<{ rows: DriverLocation[]; selectedId: string }>();
const emit = defineEmits<{ select: [roomId: string] }>();
const container = useTemplateRef<HTMLDivElement>('container');
const runtime = useRuntimeConfig();
const error = shallowRef('');
const loading = shallowRef(true);
let sdk: any;
let map: any;
let alive = true;
let fitted = false;
let observer: ResizeObserver | undefined;
const markers = new Map<string, { marker: any; content: HTMLButtonElement }>();

function render() {
  if (!map) return;
  const visible = new Set<string>();
  for (const row of props.rows) {
    if (row.longitude === null || row.latitude === null) continue;
    visible.add(row.roomId);
    let entry = markers.get(row.roomId);
    if (!entry) {
      const content = document.createElement('button');
      content.type = 'button';
      const marker = new sdk.Marker({ content, anchor: 'bottom-center', position: [row.longitude, row.latitude] });
      marker.on('click', () => emit('select', row.roomId));
      entry = { marker, content };
      markers.set(row.roomId, entry);
      map.add(marker);
    }
    entry.marker.setPosition([row.longitude, row.latitude]);
    entry.marker.setzIndex(row.roomId === props.selectedId ? 200 : 100);
    entry.content.textContent = row.displayName || row.phone || '车夫';
    entry.content.title = `${entry.content.textContent} · ${driverStatusLabels[row.status]}`;
    entry.content.className = `driver-location-marker ${row.status === 'online' ? 'is-online' : ''} ${row.roomId === props.selectedId ? 'is-selected' : ''}`;
  }
  for (const [id, entry] of markers) {
    if (!visible.has(id)) { map.remove(entry.marker); markers.delete(id); }
  }
  if (!fitted && markers.size) {
    map.setFitView([...markers.values()].map(entry => entry.marker), false, [55, 55, 55, 55], 17);
    fitted = true;
  }
}

watch(() => props.rows, render);
watch(() => props.selectedId, () => {
  render();
  const row = props.rows.find(item => item.roomId === props.selectedId);
  if (row?.longitude != null && row.latitude != null) map?.panTo([row.longitude, row.latitude]);
});
onMounted(async () => {
  try {
    sdk = await loadAdminAMap({ key: String(runtime.public.amapKey || ''), securityCode: String(runtime.public.amapSecurityCode || ''), securityProxy: String(runtime.public.amapSecurityProxy || '') });
    if (!alive || !container.value) return;
    map = new sdk.Map(container.value, { center: [116.38, 39.94], zoom: 14, viewMode: '2D' });
    observer = new ResizeObserver(() => map?.resize?.());
    observer.observe(container.value);
    render();
  } catch (caught) { if (alive) error.value = caught instanceof Error ? caught.message : '地图加载失败'; }
  finally { if (alive) loading.value = false; }
});
onBeforeUnmount(() => { alive = false; observer?.disconnect(); map?.destroy(); markers.clear(); });
</script>

<template>
  <div class="relative min-h-[480px] overflow-hidden rounded-lg border border-border/70">
    <div ref="container" class="absolute inset-0" />
    <p v-if="loading || error" :role="error ? 'alert' : 'status'" class="absolute left-3 top-3 rounded-md bg-background/95 p-3 text-sm shadow-sm">{{ error || '地图加载中…' }}</p>
  </div>
</template>

<style>
.driver-location-marker { white-space: nowrap; border: 2px solid #fff; border-radius: 6px; padding: 5px 9px; background: #64748b; color: #fff; font-size: 12px; cursor: pointer; box-shadow: 0 2px 6px #0003; }
.driver-location-marker.is-online { background: #16786b; }
.driver-location-marker.is-selected { outline: 3px solid #e4b763; }
</style>
