<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import Input from '@/components/shadcn/input/Input.vue'
import Select from '@/components/shadcn/select/Select.vue'
import Textarea from '@/components/shadcn/textarea/Textarea.vue'
import RouteMapCanvas from '@/components/routes/RouteMapCanvas.vue'
import { useActionFeedback } from '@/composables/useActionFeedback'
import { segmentLengthMeters, useRouteMapEditor } from '@/composables/useRouteMapEditor'
import type { RouteMapDetail, RouteMapStation } from '@/types/route-map'
import type { LngLat } from '@/utils/route-map-geometry'

const props = withDefaults(defineProps<{
  open: boolean
  routeId: string
  canEdit: boolean
  /** 打开时直接进入该路段编辑（由工作台路段列表传入） */
  focusSegmentNo?: number | null
}>(), {
  focusSegmentNo: null,
})

const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [detail: RouteMapDetail] }>()

const model = computed({ get: () => props.open, set: value => emit('update:open', value) })
const actionFeedback = useActionFeedback()
const { request } = useApiClient()
const canvas = shallowRef<{ zoomBy: (delta: number) => void; fit: () => void } | null>(null)

const editor = useRouteMapEditor({
  onDetailApplied: (detail) => emit('saved', detail),
})

const {
  detail,
  segments,
  activeSegmentNo,
  activeSegment,
  editingPoints,
  previewPointsBySegmentNo,
  dirtySegmentNos,
  snapToRoad,
  loading,
  saving,
  error,
  stations,
  geometryVersion,
  validationMessages,
  hasDirty,
  hasVersionConflict,
  dirtySegments,
  canUndo,
  canRedo,
} = editor

/** 仅本次编辑会话内的吸附提示，与后端 validationMessages 分开呈现 */
const snapNotice = shallowRef('')

const editStationId = shallowRef('')
const stationDraft = ref({ id: '', title: '', arrivalNote: '', transportMode: 'rickshaw', stayMinutes: '10' })

const statusText = computed(() => {
  if (!detail.value) return '未加载'
  if (detail.value.confirmed) return '已确认'
  return detail.value.geometryStatus === 'ready' ? '待确认' : '待完善'
})

const editingHint = computed(() => {
  const segment = activeSegment.value
  if (!segment) return '请先同步站点，至少需要两个站点才能编辑路段。'
  return `正在编辑第 ${segment.segmentNo} 段（${segment.fromTitle} → ${segment.toTitle}）：地图上点击空白处追加顶点，拖动中间顶点调整，双击顶点删除，点击白色「+」在两点之间插入。`
})

const dirtyHint = computed(() => {
  if (!hasDirty.value) return ''
  return `有 ${dirtySegments.value.length} 段未保存草稿；保存失败或版本冲突时会保留草稿。`
})

/**
 * 当前编辑路段的顶点列表。
 * 放在 script 里算好，避免模板里反复写 `(editingPoints ?? activeSegment.points)`
 * 这类联合类型表达式（模板推导容易退化成 string | number）。
 */
const activePoints = computed<LngLat[]>(() =>
  editingPoints.value ?? activeSegment.value?.points ?? [])

const activePointCount = computed(() => activePoints.value.length)

const isFixedVertexIndex = (index: number): boolean =>
  index === 0 || index === activePointCount.value - 1

const conflictHint = computed(() =>
  hasVersionConflict.value
    ? `服务端几何版本已变为 ${geometryVersion.value}（本次编辑基于版本 ${editor.baseGeometryVersion.value}）。草稿已保留，请先另存或重新载入后再保存。`
    : '')

function resetLocalState() {
  editStationId.value = ''
  stationDraft.value = { id: '', title: '', arrivalNote: '', transportMode: 'rickshaw', stayMinutes: '10' }
  snapNotice.value = ''
}

async function load() {
  resetLocalState()
  snapNotice.value = ''
  const result = await editor.load(props.routeId, true)
  if (!result) return
  const focus = props.focusSegmentNo
  if (focus !== null && segments.value.some(segment => segment.segmentNo === focus)) {
    editor.enterEdit(focus)
  }
}

/** 统一 POST 动作：站点同步 / 生成 / 校验 / 确认 */
async function runAction(path: string, body: Record<string, unknown> = {}) {
  if (hasDirty.value && !window.confirm('存在未保存的路段草稿，继续操作会丢弃草稿。是否继续？')) {
    return
  }
  actionPending.value = true
  editor.error.value = ''
  try {
    const result = await requestDetail(path, body)
    if (result) {
      editor.discardAll()
      editor.applyDetail(result)
      emit('saved', result)
    }
  } catch (caught) {
    editor.error.value = caught instanceof Error ? caught.message : '操作失败。'
  } finally {
    actionPending.value = false
  }
}

const actionPending = shallowRef(false)

async function requestDetail(path: string, body: Record<string, unknown>): Promise<RouteMapDetail | null> {
  return request<RouteMapDetail>(path, {
    method: 'POST',
    body: { routeId: props.routeId, ...body },
  })
}

async function moveStation(payload: { stationId: string; longitude: number; latitude: number }) {
  editor.error.value = ''
  try {
    const result = await requestDetail('/api/route-map/update-station', { ...payload, coordinateSystem: 1 })
    editStationId.value = ''
    if (result) {
      // 站点位置变化后，受影响路段端点需要重新固定
      editor.applyDetail(result)
      repinEndpointsAfterStationMove(payload.stationId)
    }
  } catch (caught) {
    editor.error.value = caught instanceof Error ? caught.message : '站点位置保存失败。'
  }
}

/** 站点移动后把相邻路段端点重新钉到新坐标，保留中间顶点草稿 */
function repinEndpointsAfterStationMove(stationId: string) {
  for (const segment of segments.value) {
    if (segment.fromStationId !== stationId && segment.toStationId !== stationId) {
      continue
    }
    const from = stations.value.find(item => item.id === segment.fromStationId)
    const to = stations.value.find(item => item.id === segment.toStationId)
    if (!from || !to) continue
    const next = segment.points.map((point, index) => {
      if (index === 0) return [Number(from.longitude), Number(from.latitude)] as LngLat
      if (index === segment.points.length - 1) return [Number(to.longitude), Number(to.latitude)] as LngLat
      return point
    })
    editor.discardActive(segment.segmentNo)
    segment.points = next
    segment.dirty = true
  }
}

function editStation(station: RouteMapStation) {
  stationDraft.value = {
    id: station.id,
    title: station.title,
    arrivalNote: station.arrivalNote || '',
    transportMode: station.transportMode || 'rickshaw',
    stayMinutes: String(station.stayMinutes ?? 10),
  }
}

async function saveStation() {
  editor.error.value = ''
  try {
    const result = await requestDetail('/api/route-map/update-station', {
      stationId: stationDraft.value.id,
      title: stationDraft.value.title,
      arrivalNote: stationDraft.value.arrivalNote,
      transportMode: stationDraft.value.transportMode,
      stayMinutes: stationDraft.value.stayMinutes ? Number(stationDraft.value.stayMinutes) : null,
    })
    if (result) {
      editor.applyDetail(result)
      stationDraft.value.id = ''
      actionFeedback.success('停靠信息已保存。')
    }
  } catch (caught) {
    editor.error.value = caught instanceof Error ? caught.message : '停靠信息保存失败。'
  }
}

async function saveSegment() {
  snapNotice.value = ''
  const ok = await editor.saveSegment()
  if (!ok) {
    return
  }
  const latest = validationMessages.value
  if (latest.length) {
    // 后端逐段吸附结果提示（例如"有 2 段未能吸附到道路，已用直线连接"）
    snapNotice.value = latest[latest.length - 1] || ''
    actionFeedback.success(latest[latest.length - 1] || '路段已保存。')
    return
  }
  actionFeedback.success(snapToRoad.value ? '路段已吸附并保存。' : '已保存原始手绘折线。')
}

async function saveAll() {
  snapNotice.value = ''
  const ok = await editor.saveAll()
  if (!ok) {
    return
  }
  const latest = validationMessages.value
  if (latest.length) {
    snapNotice.value = latest[latest.length - 1] || ''
    actionFeedback.success(latest[latest.length - 1] || '路段已保存。')
    return
  }
  actionFeedback.success('全部路段已保存。')
}

function selectSegment(segmentNo: number) {
  editor.exitEdit()
  editor.enterEdit(segmentNo)
  snapNotice.value = ''
}

function closeDialog() {
  if (hasDirty.value && !window.confirm('存在未保存的路段草稿，关闭将丢弃草稿。是否继续？')) {
    return
  }
  editor.exitEdit()
  model.value = false
}

function reloadFromServer() {
  if (hasDirty.value && !window.confirm('重新载入会丢弃全部未保存草稿。是否继续？')) {
    return
  }
  editor.discardAll()
  void editor.load(props.routeId, true).then((result) => {
    if (!result) return
    actionFeedback.success('已重新载入服务端几何。')
  })
}

/** 编辑会话内撤销重做；仅在地图编辑模式下生效 */
function handleKeydown(event: KeyboardEvent) {
  if (!props.open || !props.canEdit) return
  const meta = event.ctrlKey || event.metaKey
  if (!meta || event.key.toLowerCase() !== 'z') return
  const target = event.target as HTMLElement | null
  const tag = target?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea') return
  event.preventDefault()
  if (event.shiftKey) editor.redo()
  else editor.undo()
}

onMounted(() => window.addEventListener('keydown', handleKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown, true))

watch(
  () => [props.open, props.routeId] as const,
  ([open]) => { if (open) void load() },
  { immediate: true },
)

watch(() => props.focusSegmentNo, (segmentNo) => {
  if (!props.open || segmentNo === null) return
  if (segments.value.some(segment => segment.segmentNo === segmentNo)) {
    editor.enterEdit(segmentNo)
  }
})
</script>

<template>
  <Dialog v-model:open="model">
    <DialogContent class="flex h-[92vh] max-w-[min(96vw,1440px)] flex-col overflow-hidden p-0">
      <DialogHeader class="border-b px-5 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3 pr-8">
          <div>
            <DialogTitle>路线地图 · 手动编辑与道路吸附</DialogTitle>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ detail?.title || '路线' }} · {{ statusText }} · 几何版本 {{ geometryVersion }}
              <span v-if="hasDirty" class="ml-2 text-amber-300">· 未保存 {{ dirtySegments.length }} 段</span>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" :disabled="!canEdit || loading || saving" @click="runAction('/api/route-map/sync-stations')">同步站点</Button>
            <Button size="sm" variant="outline" :disabled="!canEdit || loading || saving || (detail?.stations.length ?? 0) < 2" @click="runAction('/api/route-map/generate')">生成缺失路段</Button>
            <Button size="sm" variant="outline" :disabled="loading || saving" @click="runAction('/api/route-map/validate')">检查路线</Button>
            <Button size="sm" variant="outline" :disabled="!canEdit || loading || saving || detail?.geometryStatus !== 'ready'" @click="runAction('/api/route-map/confirm')">确认路线</Button>
          </div>
        </div>
      </DialogHeader>

      <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px]">
        <div class="relative min-h-0">
          <RouteMapCanvas
            ref="canvas"
            :detail="detail"
            :edit-station-id="editStationId"
            :editable="canEdit && activeSegment !== null"
            :editable-segment-no="activeSegmentNo"
            :editable-points="editingPoints ?? []"
            :preview-points-by-segment-no="previewPointsBySegmentNo"
            :dirty-segment-nos="dirtySegmentNos"
            @error="editor.error.value = $event"
            @station-move="moveStation"
            @vertex-add="editor.addVertex([$event.longitude, $event.latitude])"
            @vertex-move="editor.moveVertex($event.index, [$event.longitude, $event.latitude])"
            @vertex-remove="editor.removeVertex($event)"
            @vertex-insert="editor.insertVertexBetween($event.index, [$event.longitude, $event.latitude])" />

          <div v-if="editStationId" class="absolute left-3 top-3 rounded-md bg-background/95 px-3 py-2 text-xs shadow">
            点击地图设置站点位置
            <Button class="ml-2 h-7" size="sm" variant="ghost" @click="editStationId = ''">取消</Button>
          </div>

          <div v-if="canEdit && activeSegment" class="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2 rounded-md bg-background/95 px-3 py-2 text-xs shadow">
            <span class="min-w-0 flex-1">{{ editingHint }}</span>
            <Button class="h-7" size="sm" variant="outline" :disabled="!canUndo || saving" @click="editor.undo()">撤销</Button>
            <Button class="h-7" size="sm" variant="outline" :disabled="!canRedo || saving" @click="editor.redo()">重做</Button>
          </div>

          <div class="absolute right-3 top-3 flex flex-col gap-1.5">
            <Button class="h-7 w-7 p-0" size="sm" variant="outline" title="放大地图" @click="canvas?.zoomBy(1)">+</Button>
            <Button class="h-7 w-7 p-0" size="sm" variant="outline" title="缩小地图" @click="canvas?.zoomBy(-1)">−</Button>
            <Button class="h-7 w-7 p-0" size="sm" variant="outline" title="适应窗口" @click="canvas?.fit()">⤢</Button>
          </div>
        </div>

        <aside class="min-h-0 overflow-auto border-l p-4">
          <p v-if="error" class="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">{{ error }}</p>
          <p v-if="conflictHint" class="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{{ conflictHint }}</p>
          <p v-if="dirtyHint" class="mb-3 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">{{ dirtyHint }}</p>

          <!-- 吸附开关：只影响本次保存，不改变已保存几何 -->
          <section class="mb-4 rounded-md border p-3">
            <label class="flex cursor-pointer items-start gap-2 text-sm">
              <input v-model="snapToRoad" type="checkbox" class="mt-0.5 h-4 w-4" :disabled="!canEdit || saving">
              <span>
                <strong class="font-medium">保存时吸附到道路</strong>
                <span class="mt-1 block text-xs text-muted-foreground">
                  开启后后端逐段调用步行路径规划，把相邻顶点之间的连线替换为沿路折线，起终点仍强制回到站点坐标；关闭则保存原始手绘折线。任一段吸附失败时该段退回直线，并在下方显示提示。
                </span>
              </span>
            </label>
          </section>

          <!-- 后端 validationMessages：吸附结果与路线校验提示 -->
          <section v-if="validationMessages.length" class="mb-4 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
            <p class="mb-1 font-medium">后端校验与吸附结果</p>
            <p v-for="message in validationMessages" :key="message">· {{ message }}</p>
          </section>

          <section v-if="snapNotice" class="mb-4 rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs text-emerald-200">
            {{ snapNotice }}
          </section>

          <p class="mb-2 text-xs font-medium text-muted-foreground">路段（{{ segments.length }}）</p>
          <div
            v-for="segment in segments"
            :key="segment.segmentNo"
            class="mb-2 rounded-md border p-2.5 text-sm"
            :class="segment.segmentNo === activeSegmentNo ? 'border-primary/60 bg-primary/5' : ''">
            <div class="flex items-center justify-between gap-2">
              <span class="min-w-0 truncate">第 {{ segment.segmentNo }} 段 · {{ segment.fromTitle }} → {{ segment.toTitle }}</span>
              <span class="shrink-0 text-xs text-muted-foreground">
                {{ segment.dirty ? '草稿' : segment.serverSourceType === 2 ? '人工' : segment.serverSourceType === 1 ? '自动' : '待生成' }}
              </span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ segment.points.length }} 个顶点 · 约 {{ Math.round(segmentLengthMeters(segment)) }} 米
              <span v-if="segment.distanceMeters"> · 服务端 {{ segment.distanceMeters }} 米</span>
            </p>
            <p v-if="segment.error" class="mt-1 text-xs text-destructive">{{ segment.error }}</p>
            <div v-if="canEdit" class="mt-2 flex flex-wrap gap-1.5">
              <Button
                class="h-7 px-2 text-xs"
                size="sm"
                :variant="segment.segmentNo === activeSegmentNo ? 'default' : 'outline'"
                :disabled="saving"
                @click="selectSegment(segment.segmentNo)">
                编辑顶点
              </Button>
              <Button class="h-7 px-2 text-xs" size="sm" variant="outline" :disabled="saving" @click="runAction('/api/route-map/generate', { segmentNo: segment.segmentNo })">
                重新自动生成
              </Button>
              <Button v-if="segment.dirty" class="h-7 px-2 text-xs" size="sm" variant="ghost" :disabled="saving" @click="editor.discardActive(segment.segmentNo)">
                放弃草稿
              </Button>
            </div>
            <p class="mt-1 text-[11px] text-muted-foreground">重新自动生成会清除该段人工标记，需要显式确认后执行。</p>
          </div>

          <template v-if="activeSegment">
            <p class="mb-2 mt-5 text-xs font-medium text-muted-foreground">
              第 {{ activeSegment.segmentNo }} 段顶点（{{ activePointCount }}）
            </p>
            <ol class="space-y-1.5">
              <li
                v-for="(point, index) in activePoints"
                :key="`${index}-${point[0]}-${point[1]}`"
                class="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs">
                <span class="min-w-0 truncate">
                  <b>{{ index + 1 }}</b>
                  <span v-if="isFixedVertexIndex(index)" class="ml-1 text-amber-300">端点（固定）</span>
                  <span class="ml-1 text-muted-foreground">{{ point[0].toFixed(6) }}, {{ point[1].toFixed(6) }}</span>
                </span>
                <Button
                  v-if="!isFixedVertexIndex(index)"
                  class="h-6 shrink-0 px-2 text-[11px]"
                  size="sm"
                  variant="ghost"
                  :disabled="saving"
                  @click="editor.removeVertex(index)">
                  删除
                </Button>
              </li>
            </ol>
            <div class="mt-3 flex flex-wrap gap-2">
              <Button size="sm" :disabled="!canEdit || saving" @click="saveSegment">
                {{ saving ? '保存中…' : (snapToRoad ? '吸附并保存本段' : '保存本段（不吸附）') }}
              </Button>
              <Button size="sm" variant="outline" :disabled="saving || !activeSegment.dirty" @click="editor.discardActive()">放弃本段草稿</Button>
            </div>
          </template>

          <template v-if="dirtySegments.length > 1">
            <Button class="mt-3 w-full" size="sm" :disabled="!canEdit || saving" @click="saveAll">
              {{ saving ? '保存中…' : `保存全部 ${dirtySegments.length} 段草稿` }}
            </Button>
          </template>

          <p class="mb-2 mt-6 text-xs font-medium text-muted-foreground">站点（{{ stations.length }}）</p>
          <ol class="space-y-2">
            <li v-for="station in stations" :key="station.id" class="rounded-md border p-2.5 text-sm">
              <div class="flex items-start justify-between gap-2">
                <strong class="min-w-0 truncate">{{ station.stationNo }}. {{ station.title }}</strong>
                <Button v-if="canEdit" class="h-7 px-2 text-xs" size="sm" variant="ghost" @click="editStationId = station.id">调整入口</Button>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">{{ station.longitude.toFixed(6) }}, {{ station.latitude.toFixed(6) }}</p>
              <p v-if="station.arrivalNote" class="mt-1 text-xs text-muted-foreground">{{ station.arrivalNote }}</p>
              <Button v-if="canEdit" class="mt-2 h-7 px-2 text-xs" size="sm" variant="outline" :disabled="saving || loading" @click="editStation(station)">停靠信息</Button>
              <form v-if="stationDraft.id === station.id" class="mt-3 space-y-2 border-t pt-3" @submit.prevent="saveStation">
                <label class="block text-xs">站点名称<Input v-model="stationDraft.title" :disabled="saving" /></label>
                <label class="block text-xs">抵达说明<Textarea v-model="stationDraft.arrivalNote" rows="3" :disabled="saving" /></label>
                <label class="block text-xs">交通方式
                  <Select v-model="stationDraft.transportMode" :disabled="saving">
                    <option value="rickshaw">黄包车</option>
                    <option value="walk">步行</option>
                    <option value="indoor">馆内</option>
                    <option value="mixed">混合接驳</option>
                  </Select>
                </label>
                <label class="block text-xs">停留时长（分钟）<Input v-model="stationDraft.stayMinutes" type="number" min="0" :disabled="saving" /></label>
                <div class="flex gap-2">
                  <Button type="submit" size="sm" :disabled="saving">保存</Button>
                  <Button type="button" size="sm" variant="ghost" :disabled="saving" @click="stationDraft.id = ''">取消</Button>
                </div>
              </form>
            </li>
          </ol>
        </aside>
      </div>

      <div class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
        <span class="mr-auto text-xs text-muted-foreground">Ctrl / Cmd + Z 撤销，Shift 组合重做（仅编辑会话内）</span>
        <Button size="sm" variant="outline" :disabled="loading || saving" @click="reloadFromServer">重新载入服务端几何</Button>
        <Button size="sm" variant="ghost" :disabled="saving" @click="closeDialog">关闭</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
