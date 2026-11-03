<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import { loadAdminAMap } from '@/utils/amap';
import { driverStatusLabels, type DriverLocation, type DriverLocationRecord } from '@/types/driver-location';

const props = defineProps<{
  rows: DriverLocation[];
  selectedId: string;
  focusRequest: number;
  history: DriverLocationRecord[];
  historyPending: boolean;
  historyError: string;
}>();
const emit = defineEmits<{ select: [roomId: string]; retryHistory: [] }>();
const selected = computed(() => props.rows.find(row => row.roomId === props.selectedId));
const hasPosition = computed(() => selected.value?.longitude != null && selected.value.latitude != null);
const container = useTemplateRef<HTMLDivElement>('container');
const runtime = useRuntimeConfig();
const error = shallowRef('');
const loading = shallowRef(true);
let sdk: any;
let map: any;
let alive = true;
let fitted = false;
let trajectory: any;
let startMarker: any;
let observer: ResizeObserver | undefined;
const markers = new Map<string, { marker: any; content: HTMLButtonElement }>();

function focusSelected() {
  const row = selected.value;
  if (row?.longitude != null && row.latitude != null) map?.setZoomAndCenter(17, [row.longitude, row.latitude]);
}

function renderHistory() {
  if (!map) return;
  if (trajectory) map.remove(trajectory);
  if (startMarker) map.remove(startMarker);
  trajectory = undefined;
  startMarker = undefined;
  if (!selected.value || !props.history.length) return;
  const path = props.history.map(record => [record.longitude, record.latitude]);
  if (path.length > 1) {
    trajectory = new sdk.Polyline({
      path, strokeColor: '#16786b', strokeWeight: 5, strokeOpacity: 0.9,
      showDir: true, lineJoin: 'round', lineCap: 'round', zIndex: 50,
    });
    map.add(trajectory);
  }
  const content = document.createElement('span');
  content.textContent = '起点';
  content.className = 'driver-location-track-start';
  startMarker = new sdk.Marker({
    position: path[0], content, anchor: 'bottom-center', zIndex: 90,
    title: `轨迹起点 · ${new Date(props.history[0]!.sampledAt).toLocaleTimeString('zh-CN')}`,
  });
  map.add(startMarker);
}

function fitHistory() {
  const overlays = [trajectory, startMarker, markers.get(props.selectedId)?.marker].filter(Boolean);
  if (overlays.length) map?.setFitView(overlays, false, [70, 70, 70, 70], 17);
}

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
watch(() => [props.selectedId, props.focusRequest], () => {
  render();
  focusSelected();
});
watch([() => props.history, () => selected.value?.roomId], renderHistory);
onMounted(async () => {
  try {
    sdk = await loadAdminAMap({ key: String(runtime.public.amapKey || ''), securityCode: String(runtime.public.amapSecurityCode || ''), securityProxy: String(runtime.public.amapSecurityProxy || '') });
    if (!alive || !container.value) return;
    map = new sdk.Map(container.value, { center: [116.38, 39.94], zoom: 14, viewMode: '2D' });
    observer = new ResizeObserver(() => map?.resize?.());
    observer.observe(container.value);
    render();
    renderHistory();
    focusSelected();
  } catch (caught) { if (alive) error.value = caught instanceof Error ? caught.message : '地图加载失败'; }
  finally { if (alive) loading.value = false; }
});
onBeforeUnmount(() => { alive = false; observer?.disconnect(); map?.destroy(); markers.clear(); });
</script>

<template>
  <div class="relative min-h-[480px] overflow-hidden rounded-lg border border-border/70">
    <div ref="container" class="absolute inset-0" />
    <div v-if="selected && !loading && !error" class="absolute left-3 right-3 top-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-background/95 px-3 py-2 text-xs shadow-sm">
      <div class="grid gap-1" aria-live="polite">
        <span class="font-medium">房间 {{ selected.roomCode }} · 最近 1 小时轨迹</span>
        <span v-if="historyError" role="alert" class="text-destructive">{{ historyError }}{{ history.length ? '；当前显示上次获取的轨迹' : '' }}</span>
        <span v-else class="text-muted-foreground">{{ historyPending ? '正在加载轨迹…' : history.length > 1 ? `${history.length} 个定位点 · 绿色线为行驶轨迹` : history.length === 1 ? '仅 1 个定位点，暂未形成轨迹' : '最近 1 小时暂无轨迹' }}{{ hasPosition ? '' : ' · 暂无当前位置' }}</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button v-if="historyError" size="sm" variant="outline" :disabled="historyPending" @click="emit('retryHistory')">重试轨迹</Button>
        <Button size="sm" variant="outline" :disabled="!hasPosition" @click="focusSelected">聚焦当前位置</Button>
        <Button size="sm" variant="outline" :disabled="!history.length" @click="fitHistory">查看完整轨迹</Button>
      </div>
    </div>
    <p v-if="loading || error" :role="error ? 'alert' : 'status'" class="absolute left-3 top-3 rounded-md bg-background/95 p-3 text-sm shadow-sm">{{ error || '地图加载中…' }}</p>
  </div>
</template>

<style>
.driver-location-marker { white-space: nowrap; border: 2px solid #fff; border-radius: 6px; padding: 5px 9px; background: #64748b; color: #fff; font-size: 12px; cursor: pointer; box-shadow: 0 2px 6px #0003; }
.driver-location-marker.is-online { background: #16786b; }
.driver-location-marker.is-selected { outline: 3px solid #e4b763; }
.driver-location-track-start { display: block; white-space: nowrap; border: 2px solid #fff; border-radius: 5px; padding: 3px 6px; background: #16786b; color: #fff; font-size: 11px; box-shadow: 0 2px 6px #0003; }
</style>
