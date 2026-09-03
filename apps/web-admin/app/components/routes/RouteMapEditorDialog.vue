<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import RouteMapCanvas from '@/components/routes/RouteMapCanvas.vue'
import type { RouteMapDetail, RouteMapSegment } from '@/types/route-map'

const props = defineProps<{ open: boolean; routeId: string; canEdit: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const model = computed({ get: () => props.open, set: value => emit('update:open', value) })
const detail = shallowRef<RouteMapDetail | null>(null)
const pending = shallowRef(false)
const error = shallowRef('')
const editStationId = shallowRef('')
const drawingSegmentNo = shallowRef<number | null>(null)
const draftCoordinates = shallowRef<number[][]>([])
const { request } = useApiClient()

const statusText = computed(() => detail.value?.confirmed ? '已确认' : detail.value?.geometryStatus === 'ready' ? '待确认' : '待完善')
const drawingSegment = computed(() => detail.value?.segments.find(item => item.segmentNo === drawingSegmentNo.value) ?? createEmptySegment(drawingSegmentNo.value))

function createEmptySegment(segmentNo: number | null): RouteMapSegment | null {
  if (!segmentNo || !detail.value) return null
  const from = detail.value.stations.find(item => item.stationNo === segmentNo)
  const to = detail.value.stations.find(item => item.stationNo === segmentNo + 1)
  if (!from || !to) return null
  return { id: '', fromStationId: from.id, toStationId: to.id, segmentNo, sourceType: 2, geometryGeoJson: null, distanceMeters: null, estimatedMinutes: null, status: 0, errorMessage: null }
}

async function load() {
  if (!props.routeId) return
  pending.value = true; error.value = ''
  try { detail.value = await request<RouteMapDetail>('/api/route-map/get', { query: { routeId: props.routeId } }) }
  catch (caught) { error.value = caught instanceof Error ? caught.message : '路线地图加载失败' }
  finally { pending.value = false }
}

async function act(path: string, body: Record<string, unknown> = {}) {
  pending.value = true; error.value = ''
  try { detail.value = await request<RouteMapDetail>(path, { method: 'POST', body: { routeId: props.routeId, ...body } }) }
  catch (caught) { error.value = caught instanceof Error ? caught.message : '操作失败' }
  finally { pending.value = false }
}

async function moveStation(payload: { stationId: string; longitude: number; latitude: number }) {
  await act('/api/route-map/update-station', payload)
  editStationId.value = ''
}

async function saveDrawing() {
  const segment = drawingSegment.value
  if (!segment || draftCoordinates.value.length < 2) { error.value = '请在地图上依次点击至少两个路线点'; return }
  await act('/api/route-map/save-segment', {
    fromStationId: segment.fromStationId,
    toStationId: segment.toStationId,
    segmentNo: segment.segmentNo,
    geometryGeoJson: JSON.stringify({ type: 'LineString', coordinates: draftCoordinates.value }),
  })
  drawingSegmentNo.value = null
}

watch(() => [props.open, props.routeId] as const, ([open]) => { if (open) void load() }, { immediate: true })
</script>

<template>
  <Dialog v-model:open="model">
    <DialogContent class="flex h-[92vh] max-w-[min(96vw,1280px)] flex-col overflow-hidden p-0">
      <DialogHeader class="border-b px-5 py-3">
        <div class="flex items-center justify-between gap-4 pr-8">
          <div><DialogTitle>路线地图</DialogTitle><p class="mt-1 text-xs text-muted-foreground">{{ detail?.title || '路线' }} · {{ statusText }} · 版本 {{ detail?.geometryVersion ?? 0 }}</p></div>
          <div class="flex gap-2">
            <Button size="sm" variant="outline" :disabled="!canEdit || pending" @click="act('/api/route-map/sync-stations')">同步站点</Button>
            <Button size="sm" variant="outline" :disabled="!canEdit || pending || (detail?.stations.length ?? 0) < 2" @click="act('/api/route-map/generate')">生成缺失路段</Button>
            <Button size="sm" variant="outline" :disabled="pending" @click="act('/api/route-map/validate')">检查路线</Button>
            <Button size="sm" :disabled="!canEdit || pending || detail?.geometryStatus !== 'ready'" @click="act('/api/route-map/confirm')">确认路线</Button>
          </div>
        </div>
      </DialogHeader>
      <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px]">
        <div class="relative min-h-0">
          <RouteMapCanvas :detail="detail" :edit-station-id="editStationId" :drawing-segment-no="drawingSegmentNo" @error="error = $event" @station-move="moveStation" @draw-change="draftCoordinates = $event" />
          <div v-if="editStationId" class="absolute left-3 top-3 rounded-md bg-background/95 px-3 py-2 text-xs shadow">点击地图设置站点位置 <Button class="ml-2 h-7" size="sm" variant="ghost" @click="editStationId = ''">取消</Button></div>
          <div v-if="drawingSegmentNo !== null" class="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-background/95 px-3 py-2 text-xs shadow"><span>依次点击路线点（已选 {{ draftCoordinates.length }} 个）</span><Button class="h-7" size="sm" :disabled="draftCoordinates.length < 2 || pending" @click="saveDrawing">保存绘制</Button><Button class="h-7" size="sm" variant="ghost" @click="drawingSegmentNo = null">取消</Button></div>
        </div>
        <aside class="min-h-0 overflow-auto border-l p-4">
          <p v-if="error" class="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">{{ error }}</p>
          <div v-if="detail?.validationMessages.length" class="mb-4 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200"><p v-for="message in detail.validationMessages" :key="message">{{ message }}</p></div>
          <p class="mb-2 text-xs font-medium text-muted-foreground">站点（{{ detail?.stations.length ?? 0 }}）</p>
          <ol class="space-y-2">
            <li v-for="station in detail?.stations ?? []" :key="station.id" class="rounded-md border p-2.5 text-sm">
              <div class="flex items-start justify-between gap-2"><strong>{{ station.stationNo }}. {{ station.title }}</strong><Button v-if="canEdit" class="h-7 px-2 text-xs" size="sm" variant="ghost" @click="editStationId = station.id">调整入口</Button></div>
              <p class="mt-1 text-xs text-muted-foreground">{{ station.longitude.toFixed(6) }}, {{ station.latitude.toFixed(6) }}</p>
            </li>
          </ol>
          <p class="mb-2 mt-5 text-xs font-medium text-muted-foreground">路段（{{ Math.max(0, (detail?.stations.length ?? 0) - 1) }}）</p>
          <div v-for="segmentNo in Math.max(0, (detail?.stations.length ?? 0) - 1)" :key="segmentNo" class="mb-2 rounded-md border p-2.5 text-sm">
            <div class="flex items-center justify-between"><span>第 {{ segmentNo }} 段</span><span class="text-xs text-muted-foreground">{{ detail?.segments.find(item => item.segmentNo === segmentNo)?.sourceType === 2 ? '人工' : detail?.segments.find(item => item.segmentNo === segmentNo) ? '自动' : '待生成' }}</span></div>
            <div v-if="canEdit" class="mt-2 flex gap-1.5"><Button class="h-7 px-2 text-xs" size="sm" variant="outline" :disabled="pending" @click="act('/api/route-map/generate', { segmentNo })">重试自动生成</Button><Button class="h-7 px-2 text-xs" size="sm" variant="outline" :disabled="pending" @click="drawingSegmentNo = segmentNo">人工绘制</Button></div>
          </div>
        </aside>
      </div>
    </DialogContent>
  </Dialog>
</template>
