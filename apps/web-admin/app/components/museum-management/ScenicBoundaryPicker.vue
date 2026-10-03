<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import { toGcj02 } from '@path-seeker/ts-shared';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import { loadAdminAMap } from '@/utils/amap';
import { boundaryContains, boundaryPolygons, matchingDefaultArea, parseBoundary, type BoundaryPoint } from '@/utils/scenic-boundary';
import type { MuseumDraft } from '@/types/museum';

const props = defineProps<{ disabled?: boolean }>();
const model = defineModel<MuseumDraft>({ required: true });
const runtimeConfig = useRuntimeConfig();
const container = useTemplateRef<HTMLDivElement>('container');
const ready = shallowRef(false);
const busy = shallowRef(false);
const drawing = shallowRef(false);
const picking = shallowRef(false);
const keyword = shallowRef(model.value.name);
const message = shallowRef('搜索景点或点击地图拾取位置，再沿边界逐点划取范围。');
const error = shallowRef('');
const vertices = shallowRef<BoundaryPoint[]>([]);
const searchResults = shallowRef<any[]>([]);
let sdk: any;
let map: any;
let placeSearch: any;
let districtSearch: any;
let layers: any[] = [];
let draftLayer: any;
let alive = true;
let readyPromise: Promise<void>;

function pointOf(point: any): BoundaryPoint {
  return [Number(point.getLng?.() ?? point.lng ?? point[0]), Number(point.getLat?.() ?? point.lat ?? point[1])];
}

function project(point: BoundaryPoint): BoundaryPoint {
  const converted = toGcj02({ longitude: point[0], latitude: point[1] }, model.value.coordinateSystem ?? 1);
  return [converted.longitude, converted.latitude];
}

function render(fit = false) {
  if (!map) return;
  map.remove(layers);
  layers = [];
  const geometry = parseBoundary(model.value.boundaryGeoJson);
  if (geometry) {
    for (const polygon of boundaryPolygons(geometry)) {
      layers.push(new sdk.Polygon({ path: polygon.map(ring => ring.map(project)), strokeColor: '#327dce', strokeWeight: 3, fillColor: '#327dce', fillOpacity: 0.18, bubble: true }));
    }
  }
  if (model.value.longitude != null && model.value.latitude != null) {
    layers.push(new sdk.Marker({ position: project([model.value.longitude, model.value.latitude]), title: '景点位置', bubble: true }));
  }
  map.add(layers);
  if (fit && layers.length) map.setFitView(layers, false, [45, 45, 45, 45], 18);
}

function renderDraft() {
  if (!map) return;
  if (draftLayer) map.remove(draftLayer);
  draftLayer = null;
  if (vertices.value.length > 1) {
    const options = { path: vertices.value, strokeColor: '#d6aa54', strokeWeight: 3, fillOpacity: 0.2, bubble: true };
    draftLayer = vertices.value.length >= 3 ? new sdk.Polygon(options) : new sdk.Polyline(options);
    map.add(draftLayer);
  }
}

function useGcj02() {
  if ((model.value.coordinateSystem ?? 1) !== 2) {
    const geometry = parseBoundary(model.value.boundaryGeoJson);
    if (geometry) {
      const polygons = boundaryPolygons(geometry).map(polygon => polygon.map(ring => ring.map(project)));
      model.value.boundaryGeoJson = JSON.stringify({ type: geometry.type, coordinates: geometry.type === 'Polygon' ? polygons[0] : polygons });
    }
    if (model.value.longitude != null && model.value.latitude != null) {
      const point = project([model.value.longitude, model.value.latitude]);
      model.value.longitude = point[0];
      model.value.latitude = point[1];
    }
  }
  model.value.coordinateSystem = 2;
  model.value.mapProvider = 1;
}

function setPosition(point: BoundaryPoint) {
  useGcj02();
  model.value.longitude = point[0];
  model.value.latitude = point[1];
  picking.value = false;
  message.value = '已拾取景点位置。可以手动划取范围或查询高德默认范围。';
  render();
}

function startDrawing() {
  drawing.value = true;
  picking.value = false;
  vertices.value = [];
  error.value = '';
  message.value = '沿景点边界依次点击至少 3 个不同顶点，完成后点击“完成划区”。';
  renderDraft();
}

function cancelDrawing() {
  drawing.value = false;
  vertices.value = [];
  renderDraft();
}

function finishDrawing() {
  const ring = [...vertices.value, vertices.value[0]];
  const boundary = JSON.stringify({ type: 'Polygon', coordinates: [ring] });
  if (!parseBoundary(boundary)) { error.value = '请划取至少 3 个不同且不共线的顶点。'; return; }
  useGcj02();
  model.value.boundaryGeoJson = boundary;
  cancelDrawing();
  error.value = '';
  message.value = '已划定景点范围，保存后写入数据库。';
  render();
}

function mapClick(event: any) {
  if (props.disabled || busy.value) return;
  const point = pointOf(event.lnglat);
  if (drawing.value) {
    if (vertices.value.length >= 2000) { error.value = '最多支持 2000 个顶点。'; return; }
    vertices.value = [...vertices.value, point];
    renderDraft();
  } else if (picking.value) setPosition(point);
}

function query(service: any, name: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('地图查询超时，请重试或手动划取范围。')), 12000);
    service.search(name, (status: string, result: any) => {
      clearTimeout(timer);
      if (status === 'complete') resolve(result);
      else if (status === 'no_data') resolve(null);
      else reject(new Error('高德查询失败，请检查地图服务配置或手动划取范围。'));
    });
  });
}

async function searchPlaces() {
  if (!keyword.value.trim()) { error.value = '请输入景点名称或地址。'; return; }
  busy.value = true;
  error.value = '';
  try {
    await readyPromise;
    if (!ready.value) throw new Error('地图未加载，请检查高德配置后重试。');
    const result = await query(placeSearch, keyword.value.trim());
    if (!alive) return;
    searchResults.value = result?.poiList?.pois ?? [];
    if (!searchResults.value.length) message.value = '没有找到对应地点，请点击地图手动拾取位置。';
  } catch (caught) { if (alive) error.value = caught instanceof Error ? caught.message : '地点查询失败。'; }
  finally { if (alive) busy.value = false; }
}

function selectPlace(place: any) {
  if (!place.location) return;
  setPosition(pointOf(place.location));
  if (!model.value.name.trim()) model.value.name = place.name;
  if (!model.value.address.trim()) model.value.address = [place.pname, place.cityname, place.adname, place.address].filter(Boolean).join('');
  searchResults.value = [];
  render(true);
}

async function lookupBoundary(): Promise<boolean> {
  if (props.disabled || busy.value) return false;
  busy.value = true;
  error.value = '';
  try {
    if (!model.value.name.trim()) throw new Error('请先填写景点名称。');
    if (model.value.longitude == null || model.value.latitude == null) throw new Error('请先搜索地点或点击地图拾取景点位置，再查询默认范围。');
    await readyPromise;
    if (!ready.value) throw new Error('地图未加载，请检查高德配置后重试。');
    const result = await query(districtSearch, model.value.name.trim());
    if (!alive) return false;
    const area = matchingDefaultArea<any>(model.value.name, result?.districtList ?? []);
    const paths = area?.boundaries ?? area?.boundary;
    if (Array.isArray(paths) && paths.length) {
      const polygons = paths.map((path: any[]) => {
        const ring = path.map(pointOf);
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push([...first]);
        return [ring];
      });
      const boundary = JSON.stringify({ type: polygons.length === 1 ? 'Polygon' : 'MultiPolygon', coordinates: polygons.length === 1 ? polygons[0] : polygons });
      const geometry = parseBoundary(boundary);
      if (geometry && boundaryContains(geometry, project([model.value.longitude, model.value.latitude]))) {
        useGcj02();
        model.value.boundaryGeoJson = boundary;
        message.value = '已获取名称匹配的高德默认范围，保存后写入数据库；可重新划取调整。';
        render(true);
        return true;
      }
    }
    error.value = '未查询到对应景点的默认范围，请在地图上手动划取范围。';
    return false;
  } catch (caught) { if (alive) error.value = caught instanceof Error ? caught.message : '范围查询失败，请手动划取。'; return false; }
  finally { if (alive) busy.value = false; }
}

async function ensureBoundary(): Promise<boolean> {
  if (drawing.value) { error.value = '请先完成或取消当前划区。'; return false; }
  if (parseBoundary(model.value.boundaryGeoJson)) return true;
  if (model.value.boundaryGeoJson) { error.value = '现有范围数据无效，请重新划取范围。'; return false; }
  return lookupBoundary();
}

onMounted(() => {
  readyPromise = (async () => {
    try {
      sdk = await loadAdminAMap({ key: String(runtimeConfig.public.amapKey || ''), securityCode: String(runtimeConfig.public.amapSecurityCode || ''), securityProxy: String(runtimeConfig.public.amapSecurityProxy || '') });
      if (!alive || !container.value) return;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('高德搜索插件加载超时。')), 12000);
        sdk.plugin(['AMap.PlaceSearch', 'AMap.DistrictSearch'], () => { clearTimeout(timer); resolve(); });
      });
      await nextTick();
      if (!alive || !container.value) return;
      map = new sdk.Map(container.value, { center: [116.38, 39.94], zoom: 15, doubleClickZoom: false, resizeEnable: true });
      map.on('click', mapClick);
      placeSearch = new sdk.PlaceSearch({ pageSize: 8, extensions: 'all' });
      districtSearch = new sdk.DistrictSearch({ subdistrict: 0, extensions: 'all', showbiz: true });
      ready.value = true;
      render(true);
    } catch (caught) { if (alive) error.value = caught instanceof Error ? caught.message : '地图加载失败。'; }
  })();
});

watch(() => [model.value.boundaryGeoJson, model.value.longitude, model.value.latitude, model.value.coordinateSystem], () => render());
watch(() => model.value.name, value => { keyword.value = value; searchResults.value = []; });
onBeforeUnmount(() => { alive = false; map?.destroy(); });
defineExpose({ ensureBoundary });
</script>

<template>
  <section class="min-w-0 space-y-3 rounded-lg border border-border/70 p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-medium">景点位置与范围</h3>
      <span class="text-xs text-muted-foreground">{{ model.boundaryGeoJson ? '已设置范围' : '尚未设置范围' }} · 高德地图</span>
    </div>
    <div class="flex gap-2">
      <Input v-model="keyword" class="min-w-0 flex-1" placeholder="搜索景点名称或地址，例如：北京后海" :disabled="props.disabled || busy" @keydown.enter.prevent="searchPlaces" />
      <Button type="button" variant="outline" class="shrink-0" :disabled="!ready || props.disabled || busy" @click="searchPlaces">搜索位置</Button>
    </div>
    <div v-if="searchResults.length" class="max-h-44 overflow-auto rounded border border-border">
      <button v-for="place in searchResults" :key="place.id" type="button" class="block w-full border-b border-border/50 px-3 py-2 text-left text-sm hover:bg-secondary/50" :disabled="props.disabled || busy || drawing" @click="selectPlace(place)">
        {{ place.name }} <span class="text-xs text-muted-foreground">{{ place.cityname }} {{ place.adname }} {{ place.address }}</span>
      </button>
    </div>
    <div class="flex flex-wrap gap-2">
      <Button type="button" variant="outline" :disabled="!ready || props.disabled || busy || drawing" @click="picking = !picking">{{ picking ? '取消拾取' : '拾取景点位置' }}</Button>
      <Button v-if="!drawing" type="button" variant="outline" :disabled="!ready || props.disabled || busy" @click="startDrawing">{{ model.boundaryGeoJson ? '重新划区' : '手动划取范围' }}</Button>
      <template v-else>
        <Button type="button" :disabled="props.disabled || vertices.length < 3" @click="finishDrawing">完成划区（{{ vertices.length }} 点）</Button>
        <Button type="button" variant="outline" :disabled="props.disabled || !vertices.length" @click="vertices = vertices.slice(0, -1); renderDraft()">撤销一点</Button>
        <Button type="button" variant="ghost" :disabled="props.disabled" @click="cancelDrawing">取消划区</Button>
      </template>
      <Button type="button" variant="outline" :disabled="!ready || props.disabled || busy || drawing || !!model.boundaryGeoJson" @click="lookupBoundary">{{ busy ? '查询中…' : '查询默认范围' }}</Button>
      <Button type="button" variant="ghost" :disabled="props.disabled || busy || drawing || !model.boundaryGeoJson" @click="model.boundaryGeoJson = null; message = '范围已清除。请重新划取或查询默认范围。'">清除范围</Button>
    </div>
    <div class="scenic-boundary-map-frame rounded-lg border border-border/60 bg-secondary/40">
      <div ref="container" class="scenic-boundary-map" :class="{ 'cursor-crosshair': drawing || picking }" />
    </div>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
    <p v-else class="text-sm text-muted-foreground">{{ message }}</p>
    <p class="text-xs text-muted-foreground">位置：{{ model.longitude ?? '未拾取' }}，{{ model.latitude ?? '未拾取' }}。未划区时，保存会先查询高德默认范围；查询不到需要手动划取。</p>
  </section>
</template>

<style scoped>
.scenic-boundary-map-frame {
  position: relative;
  isolation: isolate;
  width: 100%;
  min-width: 0;
  height: clamp(320px, 46vh, 420px);
  overflow: hidden;
}

.scenic-boundary-map {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.scenic-boundary-map :deep(.amap-maps) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
