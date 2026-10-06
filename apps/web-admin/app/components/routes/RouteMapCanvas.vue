<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { gcj02ToWgs84, toGcj02 } from '@path-seeker/ts-shared'
import { loadAdminAMap } from '@/utils/amap'
import { parseRouteLines, ROUTE_SEGMENT_SOURCE, type LngLat } from '@/utils/route-map-geometry'
import type { RouteMapDetail } from '@/types/route-map'

export interface EditableSegmentVertex {
  index: number
  longitude: number
  latitude: number
  fixed: boolean
}

interface MapClickEvent { lnglat: { getLng: () => number; getLat: () => number } }
interface MapMarkerEvent { target?: unknown; lnglat?: { getLng: () => number; getLat: () => number } }

const props = withDefaults(defineProps<{
  detail: RouteMapDetail | null
  editStationId?: string
  drawingSegmentNo?: number | null
  focusedStageId?: string
  journey?: boolean
  presentation?: 'default' | 'workspace'
  /** 进入顶点编辑会话 */
  editable?: boolean
  /** 正在编辑的路段序号 */
  editableSegmentNo?: number | null
  /** 编辑中的顶点（WGS84，含起终点）；由宿主 composable 提供 */
  editablePoints?: LngLat[]
  /** 各路段当前几何（含未保存草稿），用于实时预览 */
  previewPointsBySegmentNo?: Record<number, LngLat[]>
  /** 有待保存草稿的路段序号 */
  dirtySegmentNos?: number[]
}>(), {
  editStationId: '',
  drawingSegmentNo: null,
  focusedStageId: '',
  journey: false,
  presentation: 'default',
  editable: false,
  editableSegmentNo: null,
  editablePoints: () => [],
  previewPointsBySegmentNo: () => ({}),
  dirtySegmentNos: () => [],
})

const emit = defineEmits<{
  error: [message: string]
  stationMove: [payload: { stationId: string; longitude: number; latitude: number }]
  drawChange: [coordinates: number[][]]
  select: [stageId: string]
  edit: [stageId: string]
  vertexMove: [payload: { index: number; longitude: number; latitude: number }]
  vertexAdd: [payload: { longitude: number; latitude: number }]
  vertexRemove: [index: number]
  vertexInsert: [payload: { index: number; longitude: number; latitude: number }]
  segmentSelect: [segmentNo: number]
}>()

const container = useTemplateRef<HTMLDivElement>('container')
const map = shallowRef<any>(null)
const runtimeConfig = useRuntimeConfig()
let sdk: any
let layers: any[] = []
let handleLayer: any[] = []
let draftLayer: any
let draft: number[][] = []
let alive = true
let observer: ResizeObserver | null = null
let lastTap = { stageId: '', at: 0 }
/** 拖动结束时不重复吸附：标记当前正在提交的顶点 */
let draggingVertexIndex: number | null = null

const ACTIVE_SEGMENT_COLOR = '#e5b957'
const DIRTY_SEGMENT_COLOR = '#f59e0b'
const BASE_SEGMENT_COLOR = '#c58536'
const DEFAULT_SEGMENT_COLOR = '#327dce'

function position(longitude: number, latitude: number, coordinateSystem = props.detail?.coordinateSystem ?? 1) {
  const converted = toGcj02({ longitude, latitude }, coordinateSystem)
  return [converted.longitude, converted.latitude]
}

/** 编辑顶点统一按 WGS84 传入，渲染前转 GCJ-02 */
function editorPosition(point: LngLat) {
  return position(point[0], point[1], 1)
}

function parseLines(source: string | null | undefined): number[][][] {
  return parseRouteLines(source).map(line => line.map(point => [point[0], point[1]]))
}

function clearHandles() {
  if (!map.value) return
  if (handleLayer.length) map.value.remove(handleLayer)
  handleLayer = []
}

function activeSegmentPoints(): LngLat[] {
  return props.editablePoints ?? []
}

function segmentPoints(segmentNo: number): LngLat[] | null {
  const preview = props.previewPointsBySegmentNo?.[segmentNo]
  if (preview && preview.length) return preview
  return null
}

function renderSegmentLines() {
  if (!map.value || !sdk) return

  const previewMap = props.previewPointsBySegmentNo ?? {}
  const previewKeys = Object.keys(previewMap)
  if (!previewKeys.length) return

  const dirty = new Set(props.dirtySegmentNos ?? [])

  for (const key of previewKeys) {
    const segmentNo = Number(key)
    const points = previewMap[segmentNo]
    if (!points || points.length < 2) continue

    const isActive = props.editable && props.editableSegmentNo === segmentNo
    const isDirty = dirty.has(segmentNo)
    const strokeColor = isActive ? ACTIVE_SEGMENT_COLOR : (isDirty ? DIRTY_SEGMENT_COLOR : BASE_SEGMENT_COLOR)

    layers.push(new sdk.Polyline({
      path: points.map(point => editorPosition(point)),
      strokeColor,
      strokeWeight: isActive ? 6 : 5,
      strokeStyle: isActive ? 'solid' : 'dashed',
      zIndex: isActive ? 90 : 60,
      lineJoin: 'round',
      isOutline: isActive,
      outlineColor: '#ffffff',
      borderWeight: isActive ? 2 : 0,
    }))

    // 未进入编辑但已有草稿时，用虚线对比服务端原始几何
    if (isDirty && !isActive && props.detail) {
      const server = props.detail.segments.find(item => item.segmentNo === segmentNo)
      for (const line of parseLines(server?.geometryGeoJson ?? null)) {
        layers.push(new sdk.Polyline({
          path: line.map(point => editorPosition([point[0]!, point[1]!])),
          strokeColor: '#6b7280',
          strokeWeight: 3,
          strokeStyle: 'dotted',
          zIndex: 40,
        }))
      }
    }
  }
}

function renderHandles() {
  clearHandles()
  if (!map.value || !sdk || !props.editable || props.editableSegmentNo === null) return

  const points = activeSegmentPoints()
  if (points.length < 2) return

  // 顶点手柄：首尾为固定端点（不可拖动），中间顶点可拖动、可删除
  points.forEach((point, index) => {
    const fixed = index === 0 || index === points.length - 1
    const content = document.createElement('button')
    content.type = 'button'
    content.className = [
      'route-vertex-handle',
      fixed ? 'is-fixed' : 'is-movable',
      draggingVertexIndex === index ? 'is-dragging' : '',
    ].join(' ')
    content.setAttribute('aria-label', fixed ? `路段端点 ${index + 1}（固定）` : `顶点 ${index + 1}（可拖动）`)
    content.title = fixed ? '端点已固定到站点坐标' : '拖动调整顶点；双击删除'
    content.textContent = String(index + 1)

    const marker = new sdk.Marker({
      position: editorPosition(point),
      content,
      anchor: 'center',
      draggable: !fixed,
      zIndex: 320,
    })

    marker.on('dragstart', () => {
      draggingVertexIndex = index
      content.classList.add('is-dragging')
    })

    marker.on('dragend', (event: MapMarkerEvent) => {
      draggingVertexIndex = null
      content.classList.remove('is-dragging')
      const lng = event?.lnglat?.getLng?.()
      const lat = event?.lnglat?.getLat?.()
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
      const converted = gcj02ToWgs84({ longitude: Number(lng), latitude: Number(lat) })
      emit('vertexMove', { index, longitude: converted.longitude, latitude: converted.latitude })
    })

    content.addEventListener('dblclick', (event) => {
      event.stopPropagation()
      if (fixed) {
        emit('error', '路段起终点必须固定在站点坐标上，如需移动请先调整站点位置。')
        return
      }
      emit('vertexRemove', index)
    })

    handleLayer.push(marker)
  })

  // 中点插入手柄：点击在相邻顶点之间插入一个新顶点
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!
    const to = points[index + 1]!
    const midLng = (from[0] + to[0]) / 2
    const midLat = (from[1] + to[1]) / 2

    const insertButton = document.createElement('button')
    insertButton.type = 'button'
    insertButton.className = 'route-vertex-insert'
    insertButton.setAttribute('aria-label', `在第 ${index + 1} 与第 ${index + 2} 个顶点之间插入顶点`)
    insertButton.title = '点击在两点之间插入顶点'
    insertButton.textContent = '+'

    insertButton.addEventListener('click', (event) => {
      event.stopPropagation()
      emit('vertexInsert', { index, longitude: midLng, latitude: midLat })
    })

    handleLayer.push(new sdk.Marker({
      position: editorPosition([midLng, midLat]),
      content: insertButton,
      anchor: 'center',
      zIndex: 300,
    }))
  }

  // 高亮当前编辑路段，便于确认正在改哪一段
  layers.push(new sdk.Polyline({
    path: points.map(point => editorPosition(point)),
    strokeColor: ACTIVE_SEGMENT_COLOR,
    strokeWeight: 7,
    strokeStyle: 'solid',
    zIndex: 95,
    isOutline: true,
    outlineColor: '#ffffff',
    borderWeight: 2,
  }))
}

function render(fit = true, focus = true) {
  if (!map.value || !sdk) return
  map.value.remove(layers)
  layers = []
  for (const station of props.detail?.stations ?? []) {
    const stageId = station.stageId || station.id
    const content = document.createElement('button')
    content.type = 'button'
    content.className = ['route-map-marker', stageId === props.focusedStageId ? 'active' : '', props.presentation === 'workspace' ? 'workspace-marker' : '', props.journey ? 'journey-marker' : ''].join(' ')
    content.setAttribute('aria-label', `${station.stationNo}. ${station.title}`)
    if (props.presentation === 'workspace') {
      const number = document.createElement('span')
      number.className = 'marker-number'
      number.textContent = props.journey ? String(station.stationNo).padStart(2, '0') : String(station.stationNo)
      content.append(number)
      if (props.journey) {
        const label = document.createElement('span')
        label.className = 'marker-label'
        label.textContent = station.title
        content.append(label)
      }
    } else content.textContent = `${station.stationNo}. ${station.title}`
    const marker = new sdk.Marker({ position: position(station.longitude, station.latitude, station.coordinateSystem ?? props.detail?.coordinateSystem ?? 1), content, anchor: props.presentation === 'workspace' ? 'center' : 'bottom-center', zIndex: stageId === props.focusedStageId ? 220 : 160 })
    marker.on('click', () => {
      const now = Date.now()
      const doubleTap = lastTap.stageId === stageId && now - lastTap.at < 380
      lastTap = { stageId, at: doubleTap ? 0 : now }
      if (doubleTap) emit('edit', stageId)
      else emit('select', stageId)
    })
    marker.on('dblclick', () => emit('edit', stageId))
    layers.push(marker)
  }

  const previewMap = props.previewPointsBySegmentNo ?? {}

  if (Object.keys(previewMap).length) {
    // 编辑模式：按路段分别绘制，便于区分人工草稿与服务端几何
    renderSegmentLines()
  } else {
    const color = props.presentation === 'workspace'
      ? (props.journey ? '#08a9e6' : BASE_SEGMENT_COLOR)
      : DEFAULT_SEGMENT_COLOR
    for (const line of parseLines(props.detail?.geometryGeoJson)) {
      layers.push(new sdk.Polyline({
        path: line.map(point => position(point[0]!, point[1]!)),
        strokeColor: color,
        strokeWeight: props.journey ? 8 : 5,
        strokeStyle: props.presentation === 'workspace' && !props.journey ? 'dashed' : 'solid',
        showDir: props.journey,
        isOutline: props.journey,
        outlineColor: '#fff',
        borderWeight: 2,
        zIndex: 50,
      }))
    }
  }

  map.value.add(layers)
  if (fit && layers.length) map.value.setFitView(layers, false, [70, 50, 70, 50])
  map.value.setPitch(props.journey ? 50 : 0)
  const selected = props.detail?.stations.find(station => (station.stageId || station.id) === props.focusedStageId)
  if (selected && props.journey && focus) map.value.setZoomAndCenter(17, position(selected.longitude, selected.latitude, selected.coordinateSystem ?? props.detail?.coordinateSystem ?? 1))

  renderHandles()
}

/** 只重绘顶点手柄，避免拖动后整图重排 */
function refreshHandles() {
  renderHandles()
}

function zoomBy(delta: number) { if (map.value) map.value.setZoom(map.value.getZoom() + delta) }
defineExpose({ zoomBy, fit: () => render(true, false), focus: () => render(false), refreshHandles })

function renderDraft() {
  if (!map.value || !sdk) return
  if (draftLayer) map.value.remove(draftLayer)
  draftLayer = null
  if (draft.length > 1) {
    draftLayer = new sdk.Polyline({ path: draft.map(point => position(point[0]!, point[1]!, 1)), strokeColor: '#d6aa54', strokeWeight: 5, strokeStyle: 'dashed' })
    map.value.add(draftLayer)
  }
}

function mapClick(event: MapClickEvent) {
  const point = gcj02ToWgs84({ longitude: event.lnglat.getLng(), latitude: event.lnglat.getLat() })
  if (props.editStationId) emit('stationMove', { stationId: props.editStationId, ...point })
  else if (props.editable && props.editableSegmentNo !== null) emit('vertexAdd', point)
  else if (props.drawingSegmentNo !== null) { draft = [...draft, [point.longitude, point.latitude]]; renderDraft(); emit('drawChange', draft) }
}

onMounted(async () => {
  try {
    await nextTick()
    sdk = await loadAdminAMap({ key: String(runtimeConfig.public.amapKey || ''), securityCode: String(runtimeConfig.public.amapSecurityCode || ''), securityProxy: String(runtimeConfig.public.amapSecurityProxy || '') })
    if (!alive || !container.value) return
    map.value = new sdk.Map(container.value, { center: [116.38, 39.94], zoom: 16, viewMode: '3D', resizeEnable: true, showBuildingBlock: true, wallColor: '#cad6e2', roofColor: '#edf3f8' })
    map.value.on('click', mapClick)
    render()
    observer = new ResizeObserver(() => map.value?.resize?.())
    observer.observe(container.value)
  } catch (caught) { if (alive) emit('error', caught instanceof Error ? caught.message : '地图初始化失败。') }
})
watch(() => props.detail, () => render())
watch(() => [props.focusedStageId, props.journey], () => render(false))
watch(() => props.drawingSegmentNo, () => { draft = []; renderDraft(); emit('drawChange', []) })
watch(() => [props.editable, props.editableSegmentNo] as const, () => render(false, false))
watch(() => props.editablePoints, () => { if (props.editable) refreshHandles() }, { deep: true })
onBeforeUnmount(() => { alive = false; observer?.disconnect(); clearHandles(); map.value?.destroy(); map.value = null })
</script>

<template><div ref="container" class="route-map-canvas" :class="{ 'is-editing': props.editable }" /></template>

<style scoped>
.route-map-canvas{position:relative;isolation:isolate;overflow:hidden;height:100%;min-height:0;width:100%;background:#ddd8cc}
.route-map-canvas :deep(.amap-maps){position:absolute;inset:0;width:100%;height:100%}
.route-map-canvas :deep(.route-map-marker){max-width:180px;padding:6px 10px;border:2px solid #fff;border-radius:8px;background:#fff;color:#273744;font-size:12px;white-space:nowrap;box-shadow:0 3px 12px #0003}
.route-map-canvas :deep(.route-map-marker.active){background:#327dce;color:#fff}
.route-map-canvas :deep(.workspace-marker){display:flex;align-items:center;justify-content:center;width:34px;height:34px;max-width:none;padding:0;border:3px solid #fff;border-radius:50%;background:#c58536;color:#fff;font-size:14px;font-weight:700;overflow:visible;box-shadow:0 3px 12px #0005}
.route-map-canvas :deep(.workspace-marker.active){background:#183e43}
.route-map-canvas :deep(.journey-marker){width:26px;height:26px;border-width:2px;background:#183e43;font-size:9px}
.route-map-canvas :deep(.journey-marker.active){background:#e5b957;color:#493f24}
.route-map-canvas :deep(.marker-label){position:absolute;top:30px;left:50%;transform:translateX(-50%);padding:3px 6px;border:1px solid #dce5de;border-radius:4px;background:#fff;color:#355149;white-space:nowrap;font-size:8px}
.route-map-canvas :deep(.journey-marker.active .marker-label){background:#183e43;color:#fff;border-color:#183e43}
.route-map-canvas.is-editing :deep(.route-map-marker){opacity:.55}
.route-map-canvas :deep(.route-vertex-handle){display:flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border-radius:50%;font-size:10px;font-weight:700;line-height:1;cursor:grab;user-select:none;box-shadow:0 2px 8px #0006;touch-action:none}
.route-map-canvas :deep(.route-vertex-handle.is-movable){border:2px solid #fff;background:#e5b957;color:#3a2f10}
.route-map-canvas :deep(.route-vertex-handle.is-fixed){border:2px dashed #ffffffcc;background:#183e43;color:#fff;cursor:not-allowed;opacity:.9}
.route-map-canvas :deep(.route-vertex-handle.is-dragging){cursor:grabbing;box-shadow:0 0 0 6px #e5b95755,0 2px 8px #0006}
.route-map-canvas :deep(.route-vertex-insert){display:flex;align-items:center;justify-content:center;width:16px;height:16px;padding:0;border:1px solid #ffffffcc;border-radius:50%;background:#ffffffd9;color:#4a3a12;font-size:12px;font-weight:700;line-height:1;cursor:copy;opacity:.7;transition:opacity .15s ease,transform .15s ease}
.route-map-canvas :deep(.route-vertex-insert:hover){opacity:1;transform:scale(1.2)}
</style>
