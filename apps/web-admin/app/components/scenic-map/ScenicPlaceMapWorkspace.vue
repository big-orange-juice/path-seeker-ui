<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue';
import { toGcj02 } from '@path-seeker/ts-shared';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import CulturalPlaceFormDialog from '@/components/museum-management/CulturalPlaceFormDialog.vue';
import CulturalPlaceMetadataDetails from '@/components/collections/CulturalPlaceMetadataDetails.vue';
import ScenicPlaceMapCanvas from '@/components/scenic-map/ScenicPlaceMapCanvas.vue';
import { useCulturalPlaces } from '@/composables/useCulturalPlaces';
import { boundaryContains, boundaryPolygons, parseBoundary } from '@/utils/scenic-boundary';
import type { CulturalPlaceDraft, CulturalPlaceRecord } from '@/types/cultural-place';
import type { MuseumResponse } from '@/types/museum';

const props = defineProps<{ destination: MuseumResponse; museumOptions: { value: string; label: string }[]; museumPending?: boolean }>();
const emit = defineEmits<{ 'update:museumId': [id: string] }>();
const { request } = useApiClient();
const feedback = useActionFeedback();
const places = useCulturalPlaces(() => props.destination.id || '');
const { records, pending: listPending, error: listError } = places;
const canvas = useTemplateRef<InstanceType<typeof ScenicPlaceMapCanvas>>('canvas');
const keyword = shallowRef('');
const selectedId = shallowRef('');
const detail = shallowRef<CulturalPlaceRecord | null>(null);
const detailPending = shallowRef(false);
const detailError = shallowRef('');
const mapReady = shallowRef(false);
const picking = shallowRef(false);
const movingId = shallowRef('');
const saving = shallowRef(false);
const formOpen = shallowRef(false);
const editing = shallowRef<CulturalPlaceRecord | null>(null);
const initialPosition = shallowRef<{ longitude: number; latitude: number; coordinateSystem: number } | null>(null);
const actionError = shallowRef('');
const deleteOpen = shallowRef(false);
const pendingDelete = shallowRef<CulturalPlaceRecord | null>(null);
let detailVersion = 0;
let alive = true;

const selectedPlace = computed(() => detail.value?.id === selectedId.value ? detail.value : records.value.find(place => place.id === selectedId.value) ?? null);
const filtered = computed(() => records.value.filter(place => `${place.name} ${place.code} ${place.category ?? ''}`.toLowerCase().includes(keyword.value.trim().toLowerCase())));
const locatedCount = computed(() => records.value.filter(place => place.longitude != null && place.latitude != null).length);
const boundary = computed(() => {
  const geometry = parseBoundary(props.destination.boundaryGeoJson);
  if (!geometry) return null;
  const coordinates = boundaryPolygons(geometry).map(polygon => polygon.map(ring => ring.map(point => {
    const projected = toGcj02({ longitude: point[0], latitude: point[1] }, props.destination.coordinateSystem ?? 1);
    return [projected.longitude, projected.latitude] as [number, number];
  })));
  return { type: 'MultiPolygon' as const, coordinates };
});

function requirePositionInside(longitude: number | null, latitude: number | null, coordinateSystem: number) {
  if (longitude == null || latitude == null) throw new Error('请在地图上拾取景点位置。');
  const point = toGcj02({ longitude, latitude }, coordinateSystem);
  if (boundary.value && !boundaryContains(boundary.value, [point.longitude, point.latitude])) throw new Error('所选位置位于景区范围外，请在区域边界内拾取景点位置。');
}

async function loadDetail() {
  const id = selectedId.value;
  const version = ++detailVersion;
  detail.value = null;
  detailError.value = '';
  detailPending.value = false;
  if (!id) return;
  detailPending.value = true;
  try {
    const result = await request<CulturalPlaceRecord>('/api/cultural-place/' + id);
    if (alive && version === detailVersion) detail.value = result;
  } catch (caught) { if (alive && version === detailVersion) detailError.value = caught instanceof Error ? caught.message : '景点详情加载失败。'; }
  finally { if (alive && version === detailVersion) detailPending.value = false; }
}

watch(selectedId, loadDetail);
watch([records, listPending], ([rows, pending]) => {
  if (pending) return;
  if (selectedId.value && !rows.some(place => place.id === selectedId.value)) selectedId.value = '';
});

function selectPlace(id: string) {
  if (saving.value || picking.value || movingId.value) return;
  selectedId.value = id;
  actionError.value = '';
}

function startCreate() {
  if (saving.value || !mapReady.value) return;
  selectedId.value = '';
  movingId.value = '';
  picking.value = true;
  actionError.value = '';
}

function editPlace(place: CulturalPlaceRecord) {
  if (saving.value) return;
  picking.value = false;
  movingId.value = '';
  editing.value = place;
  initialPosition.value = null;
  actionError.value = '';
  formOpen.value = true;
}

function editById(id: string) {
  const place = records.value.find(item => item.id === id);
  if (place) editPlace(place);
}

function startMoving(place: CulturalPlaceRecord) {
  if (saving.value || !mapReady.value) return;
  selectedId.value = place.id;
  movingId.value = place.id;
  picking.value = false;
  actionError.value = '';
}

async function pickPosition(point: { longitude: number; latitude: number; coordinateSystem: number }) {
  if (saving.value) return;
  actionError.value = '';
  try { requirePositionInside(point.longitude, point.latitude, point.coordinateSystem); }
  catch (caught) { actionError.value = caught instanceof Error ? caught.message : '位置无效。'; return; }
  if (movingId.value) {
    saving.value = true;
    const id = movingId.value;
    try {
      await request('/api/cultural-place/position', { method: 'POST', body: { id, museumId: props.destination.id, ...point } });
      await places.refresh();
      if (!alive) return;
      movingId.value = '';
      selectedId.value = id;
      await loadDetail();
      feedback.success('景点位置已保存。');
    } catch (caught) { if (alive) actionError.value = caught instanceof Error ? caught.message : '位置保存失败。'; }
    finally { if (alive) saving.value = false; }
    return;
  }
  if (!picking.value) return;
  picking.value = false;
  editing.value = null;
  initialPosition.value = point;
  formOpen.value = true;
}

async function save(draft: CulturalPlaceDraft) {
  if (saving.value) return;
  actionError.value = '';
  const original = editing.value;
  try {
    if (!draft.id || original?.longitude !== draft.longitude || original?.latitude !== draft.latitude || original?.coordinateSystem !== draft.coordinateSystem)
      requirePositionInside(draft.longitude, draft.latitude, draft.coordinateSystem);
  } catch (caught) { actionError.value = caught instanceof Error ? caught.message : '位置无效。'; return; }
  saving.value = true;
  try {
    const id = await request<string | null>(draft.id ? '/api/cultural-place/update' : '/api/cultural-place/create', { method: 'POST', body: { ...draft, museumId: props.destination.id } });
    await places.refresh();
    if (!alive) return;
    formOpen.value = false;
    selectedId.value = draft.id || String(id || '');
    await loadDetail();
    feedback.success('景点资料已保存。');
  } catch (caught) { if (alive) actionError.value = caught instanceof Error ? caught.message : '景点保存失败。'; }
  finally { if (alive) saving.value = false; }
}

function askDelete(place: CulturalPlaceRecord) {
  if (saving.value) return;
  pendingDelete.value = place;
  deleteOpen.value = true;
}

async function remove() {
  if (saving.value || !pendingDelete.value) return;
  saving.value = true;
  actionError.value = '';
  try {
    await places.remove(pendingDelete.value.id);
    if (!alive) return;
    selectedId.value = '';
    movingId.value = '';
    deleteOpen.value = false;
    pendingDelete.value = null;
    feedback.success('景点已删除。');
  } catch (caught) { if (alive) actionError.value = caught instanceof Error ? caught.message : '景点删除失败。'; }
  finally { if (alive) saving.value = false; }
}

async function refresh() {
  picking.value = false;
  movingId.value = '';
  actionError.value = '';
  await places.refresh();
  await loadDetail();
}

onBeforeUnmount(() => { alive = false; detailVersion += 1; });
</script>

<template>
  <div class="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
    <section class="warm-panel warm-outline shrink-0 rounded-xl border border-border/70 p-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="grid min-w-[240px] flex-1 gap-2 text-sm font-medium">所属景点<Select :model-value="destination.id || ''" :disabled="museumPending || saving" @update:model-value="emit('update:museumId', $event)"><option v-for="option in museumOptions" :key="option.value" :value="option.value">{{ option.label }}</option></Select></label>
        <div class="min-w-[160px] flex-1 space-y-2"><p class="text-sm font-medium">场景</p><p class="rounded-md border border-border bg-background px-3 py-2 text-sm">户外景区 · {{ destination.name }}</p></div>
        <div class="min-w-[160px] flex-1 space-y-2"><p class="text-sm font-medium">地图</p><p class="rounded-md border border-border bg-background px-3 py-2 text-sm">高德地图 · {{ records.length }} 个景点</p></div>
        <div class="flex flex-wrap gap-2">
          <Button v-if="!picking && !movingId" :disabled="!mapReady || saving || listPending" @click="startCreate">新增景点</Button>
          <Button v-else variant="outline" :disabled="saving" @click="picking = false; movingId = ''; actionError = ''">{{ movingId ? '取消移动' : '退出取点' }}</Button>
          <Button variant="outline" :disabled="listPending || saving" @click="refresh">刷新</Button>
          <Button variant="outline" :disabled="!mapReady" @click="canvas?.fit()">查看全域</Button>
        </div>
      </div>
    </section>
    <p v-if="listError || (!formOpen && actionError)" role="alert" class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{{ listError || actionError }}</p>
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>{{ destination.name }} · {{ records.length }} 个景点 · {{ locatedCount }} 个已定位<span v-if="!boundary"> · 尚未设置区域边界</span></span>
      <span v-if="picking || movingId" class="rounded border border-primary/40 bg-primary/10 px-3 py-1 text-primary">{{ movingId ? '拖动选中标记，或点击区域内的新位置' : '点击区域内的位置新增景点' }}</span>
      <span v-else>点击标记查看详情，双击标记编辑景点</span>
    </div>
    <div class="grid min-h-[500px] flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <ScenicPlaceMapCanvas ref="canvas" :destination="destination" :places="records" :active-place-id="selectedId" :picking="picking" :moving-place-id="movingId" :disabled="saving" @ready="mapReady = $event" @select="selectPlace" @edit="editById" @pick="pickPosition" />
      <aside class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-secondary/10">
        <div class="shrink-0 space-y-3 border-b border-border/70 p-4"><h3 class="font-medium">区域内景点</h3><Input v-model="keyword" placeholder="搜索景点名称、编码或分类" /></div>
        <div class="max-h-[200px] shrink-0 overflow-y-auto border-b border-border/70">
          <button v-for="place in filtered" :key="place.id" type="button" class="flex w-full items-center justify-between gap-3 border-b border-border/40 px-4 py-3 text-left text-sm" :class="place.id === selectedId ? 'bg-primary/15' : 'hover:bg-secondary/40'" :disabled="saving || picking || !!movingId" @click="selectPlace(place.id)">
            <span class="min-w-0"><strong class="block truncate font-medium">{{ place.name }}</strong><span class="text-xs text-muted-foreground">{{ place.category || '未分类' }} · {{ place.code }}</span></span>
            <span class="shrink-0 text-xs text-muted-foreground">{{ place.longitude == null || place.latitude == null ? '未定位' : place.status === 2 ? '停用' : '已定位' }}</span>
          </button>
          <p v-if="!filtered.length" class="p-4 text-sm text-muted-foreground">{{ listPending ? '正在加载景点…' : keyword ? '没有匹配的景点' : '暂无景点，点击“新增景点”在地图上取点。' }}</p>
        </div>
        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <template v-if="selectedPlace">
            <div class="flex items-center justify-between gap-2"><h3 class="font-medium">景点详情</h3><span class="text-xs text-muted-foreground">{{ selectedPlace.status === 2 ? '停用' : '启用' }}</span></div>
            <img v-if="selectedPlace.coverUrl" :src="selectedPlace.coverUrl" :alt="selectedPlace.name" class="h-36 w-full rounded-lg object-cover" />
            <h4 class="text-lg font-semibold">{{ selectedPlace.name }}</h4>
            <p class="text-xs text-muted-foreground">{{ selectedPlace.code }} · {{ selectedPlace.category || '未分类' }}</p>
            <p class="text-sm text-muted-foreground">{{ selectedPlace.address || '未填写地址' }}</p>
            <p class="whitespace-pre-wrap text-sm leading-6">{{ selectedPlace.description || '未填写简介' }}</p>
            <p class="text-xs text-muted-foreground">位置：{{ selectedPlace.longitude ?? '未定位' }}，{{ selectedPlace.latitude ?? '未定位' }} · {{ ['','WGS84','GCJ-02','BD-09'][selectedPlace.coordinateSystem] }}</p>
            <p class="text-xs text-muted-foreground">建议停留：{{ selectedPlace.recommendedMinutes ?? '未填写' }}{{ selectedPlace.recommendedMinutes != null ? ' 分钟' : '' }}</p>
            <div class="flex flex-wrap gap-2"><Button size="sm" variant="outline" :disabled="saving" @click="editPlace(selectedPlace)">编辑景点</Button><Button size="sm" variant="outline" :disabled="saving || !mapReady" @click="startMoving(selectedPlace)">调整位置</Button><Button size="sm" variant="ghost" :disabled="saving" @click="askDelete(selectedPlace)">删除</Button></div>
            <p v-if="detailPending" class="text-sm text-muted-foreground">正在加载补充资料…</p>
            <div v-else-if="detailError" class="space-y-2"><p class="text-sm text-destructive">{{ detailError }}</p><Button size="sm" variant="outline" @click="loadDetail">重试详情</Button></div>
            <CulturalPlaceMetadataDetails v-else :extras="selectedPlace.extraList" :archive="selectedPlace.archive" />
          </template>
          <p v-else class="py-10 text-center text-sm text-muted-foreground">点击地图标记或景点列表查看详情。</p>
        </div>
      </aside>
    </div>
    <CulturalPlaceFormDialog :open="formOpen" :museum-id="destination.id || ''" :record="editing" :initial-position="initialPosition" entity-label="景点" :pending="saving" :error="actionError" @update:open="formOpen = $event" @save="save" />
    <Dialog :open="deleteOpen" @update:open="!saving && (deleteOpen = Boolean($event))">
      <DialogContent class="max-w-[min(92vw,420px)] space-y-4 p-5">
        <DialogHeader><DialogTitle>删除景点</DialogTitle></DialogHeader>
        <p class="text-sm leading-6 text-muted-foreground">确认删除“{{ pendingDelete?.name }}”及其补充资料？删除后该景点将不再显示在地图和景点列表中。</p>
        <p v-if="actionError" class="text-sm text-destructive">{{ actionError }}</p>
        <div class="flex justify-end gap-2"><Button variant="outline" :disabled="saving" @click="deleteOpen = false">取消</Button><Button :disabled="saving" @click="remove">{{ saving ? '删除中…' : '确认删除' }}</Button></div>
      </DialogContent>
    </Dialog>
  </div>
</template>
