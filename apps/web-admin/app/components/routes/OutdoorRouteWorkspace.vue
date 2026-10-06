<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { ListOrdered, Map, Minus, Pencil, Plus, Route as RouteIcon, Trash2 } from 'lucide-vue-next'
import Button from '@/components/shadcn/button/Button.vue'
import RouteMapCanvas from '@/components/routes/RouteMapCanvas.vue'
import RouteMapEditorDialog from '@/components/routes/RouteMapEditorDialog.vue'
import type { RouteMapDetail } from '@/types/route-map'
import type { RouteNodeResponse } from '@/types/route'

const props = defineProps<{ routeId: string; nodes: RouteNodeResponse[]; selectedStageId: string; canEdit: boolean; distanceMeters?: number | null; estimatedMinutes?: number | null; refreshVersion?: number }>()
const emit = defineEmits<{ select: [stageId: string]; edit: [stageId: string]; remove: [stageId: string]; changed: []; loaded: [detail: RouteMapDetail | null] }>()
const { request } = useApiClient()
const detail = shallowRef<RouteMapDetail | null>(null)
const error = shallowRef('')
const pending = shallowRef(false)
const loading = shallowRef(false)
const stopsOpen = shallowRef(false)
const segmentsOpen = shallowRef(false)
const canvas = shallowRef<{ zoomBy: (delta: number) => void; fit: () => void } | null>(null)
const ordered = computed(() => [...props.nodes].sort((left, right) => (left.sortOrder || left.stageNo) - (right.sortOrder || right.stageNo)))
const active = computed(() => ordered.value.find(node => node.stageId === props.selectedStageId) ?? ordered.value[0] ?? null)
const distance = computed(() => {
  const meters = detail.value?.distanceMeters ?? props.distanceMeters
  return meters == null ? '里程待完善' : `${Number((meters / 1000).toFixed(1))} km`
})
const duration = computed(() => {
  const minutes = detail.value?.estimatedMinutes ?? props.estimatedMinutes
  return minutes == null ? '时长待完善' : `${minutes} min`
})
let version = 0
let alive = true

/** 手动几何编辑入口（设计文档 §6）：路段列表 + 进入/退出编辑 */
const geometryOpen = shallowRef(false)
const focusSegmentNo = shallowRef<number | null>(null)

const segmentRows = computed(() => {
  const current = detail.value
  if (!current || current.stations.length < 2) return []
  const sorted = [...current.stations].sort((left, right) => left.stationNo - right.stationNo)
  const rows: {
    segmentNo: number
    label: string
    sourceType: number
    distanceMeters: number | null
    needsReview: boolean
  }[] = []

  for (let index = 1; index < sorted.length; index += 1) {
    const from = sorted[index - 1]!
    const to = sorted[index]!
    const segment = current.segments.find(item => item.segmentNo === from.stationNo)
    rows.push({
      segmentNo: from.stationNo,
      label: `${from.title} → ${to.title}`,
      sourceType: segment?.sourceType ?? 0,
      distanceMeters: segment?.distanceMeters ?? null,
      // 站点顺序/位置变更后该段进入待检查状态（后端 status != 1）
      needsReview: Boolean(segment) && segment?.status !== 1,
    })
  }

  return rows
})

const openedSegmentLabel = computed(() => {
  const segmentNo = focusSegmentNo.value
  if (segmentNo === null) return ''
  return segmentRows.value.find(row => row.segmentNo === segmentNo)?.label ?? `第 ${segmentNo} 段`
})

function openGeometryEditor(segmentNo: number | null = null) {
  if (!props.canEdit || !props.routeId) return
  focusSegmentNo.value = segmentNo
  geometryOpen.value = true
}

function handleGeometryClosed(value: boolean) {
  geometryOpen.value = value
  if (!value) focusSegmentNo.value = null
}

function handleGeometrySaved() {
  void load()
  emit('changed')
}

async function load() {
  if (!props.routeId) return
  const token = ++version
  loading.value = true
  error.value = ''
  try {
    const result = await request<RouteMapDetail>('/api/route-map/get', { query: { routeId: props.routeId } })
    if (alive && token === version) { detail.value = result; emit('loaded', result) }
  } catch (caught) { if (alive && token === version) error.value = caught instanceof Error ? caught.message : '地图加载失败。' }
  finally { if (alive && token === version) loading.value = false }
}

async function save() {
  if (pending.value || !props.canEdit || !props.routeId) return false
  pending.value = true
  error.value = ''
  try {
    const result = await request<RouteMapDetail>('/api/route-map/sync-stations', { method: 'POST', body: { routeId: props.routeId } })
    if (!alive) return false
    version += 1
    loading.value = false
    detail.value = result
    emit('loaded', result)
    emit('changed')
    return true
  } catch (caught) { if (alive) error.value = caught instanceof Error ? caught.message : '编排保存失败。'; return false }
  finally { if (alive) pending.value = false }
}

async function reorder(index: number, delta: number) {
  if (pending.value || !props.canEdit) return
  const target = index + delta
  if (target < 0 || target >= ordered.value.length) return
  const ids = ordered.value.map(node => node.stageId)
  if (ids.some(id => !id)) return
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  pending.value = true
  error.value = ''
  let orderSaved = false
  try {
    await request('/api/route/stage-reorder', { method: 'POST', body: { routeId: props.routeId, orderedStageIds: ids } })
    orderSaved = true
    const result = await request<RouteMapDetail>('/api/route-map/sync-stations', { method: 'POST', body: { routeId: props.routeId } })
    if (alive) { version += 1; loading.value = false; detail.value = result; emit('loaded', result) }
  } catch (caught) { if (alive) error.value = caught instanceof Error ? caught.message : '顺序保存失败。' }
  finally { if (alive) { pending.value = false; if (orderSaved) emit('changed') } }
}

watch(() => [props.routeId, props.nodes, props.refreshVersion], () => void load(), { immediate: true })
onBeforeUnmount(() => { alive = false; version += 1 })
defineExpose({ save })
</script>

<template>
  <section class="outdoor-workspace">
    <RouteMapCanvas ref="canvas" :detail="detail" :focused-stage-id="active?.stageId || ''" presentation="workspace" @select="emit('select', $event)" @edit="canEdit && emit('edit', $event)" @error="error = $event" />
    <div class="map-toolbar">
      <Map class="h-4 w-4 shrink-0" /><span>高德地图路线</span><b>{{ distance }}</b><b>{{ duration }}</b>
      <Button v-if="canEdit" size="sm" :disabled="!active?.stageId || pending" @click="active?.stageId && emit('edit', active.stageId)"><Pencil class="mr-1 h-3 w-3" />编辑这一站</Button>
      <Button v-if="canEdit" size="sm" variant="outline" :disabled="pending || loading" @click="openGeometryEditor()"><RouteIcon class="mr-1 h-3 w-3" />编辑路线形状</Button>
      <Button v-if="canEdit" size="sm" variant="outline" :disabled="pending || loading" @click="segmentsOpen = !segmentsOpen"><ListOrdered class="mr-1 h-3 w-3" />路段列表</Button>
    </div>
    <div v-if="loading" class="map-loading" role="status">正在加载路线地图…</div>
    <p v-if="error" class="map-error" role="alert">{{ error }}</p>
    <div v-if="!loading && !detail?.stations.length" class="map-empty">当前路线暂无有效地图站点，可点击“保存编排”同步已绑定景点。</div>
    <div v-if="active" class="map-active">
      <span>当前预览 · 双击站点打开编辑</span><strong>{{ active.title || '未命名站点' }}</strong><p>{{ active.subtitle || '尚未维护站点简介，可在编辑弹窗中补充。' }}</p>
      <div class="map-active-actions"><Button v-if="canEdit" size="sm" variant="outline" :disabled="pending || !active.stageId" @click="active.stageId && emit('edit', active.stageId)"><Pencil class="mr-1 h-3.5 w-3.5" />编辑站点内容</Button><Button size="sm" variant="ghost" @click="stopsOpen = !stopsOpen"><ListOrdered class="mr-1 h-3.5 w-3.5" />站点顺序</Button></div>
    </div>
    <div class="map-zoom"><button type="button" aria-label="放大地图" @click="canvas?.zoomBy(1)"><Plus class="h-4 w-4" /></button><button type="button" aria-label="缩小地图" @click="canvas?.zoomBy(-1)"><Minus class="h-4 w-4" /></button></div>
    <aside v-if="stopsOpen" class="map-stops">
      <header><strong>站点顺序 · {{ ordered.length }} 站</strong><button type="button" @click="stopsOpen = false">收起</button></header>
      <ol><li v-for="(node, index) in ordered" :key="node.stageId || index" :class="{ active: node.stageId === active?.stageId }" @dblclick="canEdit && node.stageId && emit('edit', node.stageId)"><button type="button" class="stop-name" :disabled="pending" @click="node.stageId && emit('select', node.stageId)">{{ index + 1 }}. {{ node.title }}</button><div v-if="canEdit" class="stop-actions"><button type="button" :disabled="pending || index === 0" @click="reorder(index, -1)">上移</button><button type="button" :disabled="pending || index === ordered.length - 1" @click="reorder(index, 1)">下移</button><button type="button" :disabled="pending || !node.stageId" aria-label="编辑站点" @click="node.stageId && emit('edit', node.stageId)"><Pencil class="h-3 w-3" /></button><button type="button" :disabled="pending || !node.stageId" aria-label="删除站点" @click="node.stageId && emit('remove', node.stageId)"><Trash2 class="h-3 w-3" /></button></div></li></ol>
    </aside>
    <aside v-if="segmentsOpen" class="map-segments">
      <header><strong>路段列表 · {{ segmentRows.length }} 段</strong><button type="button" @click="segmentsOpen = false">收起</button></header>
      <p v-if="!segmentRows.length" class="map-segments__empty">至少需要两个站点才能编辑路线形状，请先在右侧站点顺序中补齐站点。</p>
      <ol v-else>
        <li v-for="row in segmentRows" :key="row.segmentNo">
          <div class="segment-row">
            <span class="segment-name">第 {{ row.segmentNo }} 段 · {{ row.label }}</span>
            <span class="segment-meta">
              {{ row.sourceType === 2 ? '人工' : row.sourceType === 1 ? '自动' : '待生成' }}
              <template v-if="row.distanceMeters != null"> · {{ row.distanceMeters }} 米</template>
            </span>
          </div>
          <p v-if="row.needsReview" class="segment-review">站点顺序或位置已变化，该段需要重新检查后再确认。</p>
          <div v-if="canEdit" class="segment-actions">
            <button type="button" :disabled="pending" @click="openGeometryEditor(row.segmentNo)">编辑顶点 / 吸附</button>
          </div>
        </li>
      </ol>
    </aside>

    <RouteMapEditorDialog
      :open="geometryOpen"
      :route-id="routeId"
      :can-edit="canEdit"
      :focus-segment-no="focusSegmentNo"
      @update:open="handleGeometryClosed"
      @saved="handleGeometrySaved" />

    <p v-if="geometryOpen && openedSegmentLabel" class="map-editing-hint">
      正在编辑：{{ openedSegmentLabel }}；弹窗内可拖动顶点、撤销重做并选择是否吸附到道路。
    </p>
  </section>
</template>

<style scoped>
.outdoor-workspace{position:relative;isolation:isolate;min-width:0;min-height:0;height:100%;overflow:hidden;border:1px solid #2b2f34;border-radius:10px;background:#101317}
.map-toolbar{position:absolute;z-index:10;top:14px;left:14px;right:14px;width:fit-content;max-width:calc(100% - 28px);display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:9px 12px;border-radius:8px;background:#15181ced;color:#f0f1f2;box-shadow:0 4px 16px #0004;font-size:12px}
.map-toolbar b{padding-left:10px;border-left:1px solid #383c42;white-space:nowrap}
.map-toolbar :deep(button){height:28px;font-size:11px}
.map-active{position:absolute;z-index:10;left:14px;bottom:14px;width:min(330px,calc(100% - 80px));padding:14px;border:1px solid #ffffff1a;border-radius:8px;background:#15181ced;color:#f0f1f2;box-shadow:0 5px 18px #0004}
.map-active>span{color:#d7b45d;font-size:10px}.map-active strong{display:block;font-size:16px;margin-top:5px}.map-active p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:5px 0 10px;color:#a5adb3;font-size:12px;line-height:1.6}.map-active-actions{display:flex;flex-wrap:wrap;gap:5px}.map-active-actions :deep(button){font-size:11px}
.map-zoom{position:absolute;right:14px;bottom:14px;z-index:10;display:flex;flex-direction:column;overflow:hidden;border:1px solid #292d32;border-radius:8px;background:#101216ed}.map-zoom button{display:grid;place-items:center;width:36px;height:36px;color:#e9ecee}.map-zoom button+button{border-top:1px solid #292d32}
.map-error,.map-loading,.map-empty{position:absolute;z-index:12;top:80px;left:14px;right:14px;padding:10px 12px;border-radius:8px;background:#15181ced;font-size:12px;color:#e5bc61}.map-empty{top:50%;transform:translateY(-50%);text-align:center}.map-error{color:#fca5a5}
.map-stops{position:absolute;z-index:15;inset:76px 14px 14px auto;width:min(360px,calc(100% - 28px));display:flex;flex-direction:column;overflow:hidden;border:1px solid #34383e;border-radius:10px;background:#111418f5;box-shadow:0 5px 18px #0005}.map-stops header{display:flex;justify-content:space-between;gap:8px;padding:12px;border-bottom:1px solid #34383e;font-size:12px}.map-stops header button{color:#d7b45d}.map-stops ol{min-height:0;overflow:auto;padding:8px}.map-stops li{padding:9px;border:1px solid #34383e;border-radius:6px;margin-bottom:6px}.map-stops li.active{border-color:#d7b45d;background:#d7b45d10}.stop-name{display:block;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;font-size:13px}.stop-actions{display:flex;gap:12px;align-items:center;margin-top:8px;font-size:11px;color:#acb3ba}.stop-actions button:disabled{opacity:.35;cursor:not-allowed}
.map-segments{position:absolute;z-index:16;inset:76px 14px 14px auto;width:min(400px,calc(100% - 28px));display:flex;flex-direction:column;overflow:hidden;border:1px solid #34383e;border-radius:10px;background:#111418f7;box-shadow:0 5px 18px #0005}.map-segments header{display:flex;justify-content:space-between;gap:8px;padding:12px;border-bottom:1px solid #34383e;font-size:12px}.map-segments header button{color:#d7b45d}.map-segments ol{min-height:0;overflow:auto;padding:8px}.map-segments li{padding:9px;border:1px solid #34383e;border-radius:6px;margin-bottom:6px}.map-segments__empty{padding:12px;color:#a5adb3;font-size:12px;line-height:1.6}.segment-row{display:flex;flex-direction:column;gap:4px}.segment-name{font-size:13px;color:#e9ecee;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.segment-meta{font-size:11px;color:#acb3ba}.segment-review{margin-top:6px;font-size:11px;color:#e5bc61}.segment-actions{display:flex;gap:10px;margin-top:8px;font-size:11px;color:#acb3ba}.segment-actions button{color:#d7b45d}.segment-actions button:disabled{opacity:.35;cursor:not-allowed}
.map-editing-hint{position:absolute;z-index:14;bottom:14px;left:50%;transform:translateX(-50%);padding:8px 12px;border-radius:8px;background:#15181cf2;color:#e5bc61;font-size:11px;box-shadow:0 4px 14px #0005}
</style>
