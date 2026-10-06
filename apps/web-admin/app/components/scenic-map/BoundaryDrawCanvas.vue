<script setup lang="ts">
/**
 * 范围绘制画布（景点范围编辑与片区边界划取共用）。
 *
 * 设计依据：doc/b-admin-functional-optimization-plan.md §5.2 / §5.5。
 * - 复用既有 `ScenicBoundaryPicker.vue` 的交互方式与 `loadAdminAMap` 加载链路；
 * - 几何解析、包含与距离判定一律走 `@/utils/scenic-boundary`（其实现已上移到
 *   `@path-seeker/ts-shared`），本组件只负责「画」和「坐标转换」，不做第二套几何实现；
 * - 坐标约定：`destinationBoundaryGeoJson` / `siteAreaBoundaryGeoJson` / `simulatedPoint` 为 **WGS84**；
 *   `boundaryGeoJson` + `center` 为 `coordinateSystem` 指定的坐标系（与景点存储一致）；
 *   高德地图使用 GCJ-02，进出地图时统一转换。
 */
import { nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { gcj02ToWgs84, toGcj02 } from '@path-seeker/ts-shared'
import Button from '@/components/shadcn/button/Button.vue'
import { loadAdminAMap } from '@/utils/amap'
import { boundaryPolygons, circleToRing, parseBoundary, type BoundaryPoint } from '@/utils/scenic-boundary'

type DrawPoint = { longitude: number; latitude: number }

const props = withDefaults(defineProps<{
  /** 景点锚点（按 coordinateSystem）；圆与点范围的圆心 */
  center?: DrawPoint | null
  /** 锚点与 boundaryGeoJson 的坐标系：1=WGS84 2=GCJ-02 3=BD-09 */
  coordinateSystem?: number
  /** 当前景点范围 GeoJSON（按 coordinateSystem） */
  boundaryGeoJson?: string | null
  /** 圆形半径（米）；rangeType=2 时使用 */
  radiusMeters?: number | null
  /** 1=点 2=圆 3=多边形 */
  rangeType?: number
  /** 目的地边界 GeoJSON（WGS84） */
  destinationBoundaryGeoJson?: string | null
  /** 归属片区边界 GeoJSON（WGS84） */
  siteAreaBoundaryGeoJson?: string | null
  /** 生效的接近阈值（米）：用于绘制接近缓冲区 */
  proximityMeters?: number | null
  /** 解除阈值（米）；大于接近阈值时仅作说明 */
  releaseMeters?: number | null
  /** 模拟用户位置（WGS84） */
  simulatedPoint?: DrawPoint | null
  /** idle / pick-center / pick-simulated / draw / edit */
  mode?: string
  disabled?: boolean
  heightClass?: string
}>(), {
  center: null,
  coordinateSystem: 1,
  boundaryGeoJson: null,
  radiusMeters: null,
  rangeType: 1,
  destinationBoundaryGeoJson: null,
  siteAreaBoundaryGeoJson: null,
  proximityMeters: null,
  releaseMeters: null,
  simulatedPoint: null,
  mode: 'idle',
  disabled: false,
  heightClass: 'h-[420px]',
})

const emit = defineEmits<{
  'update:boundaryGeoJson': [value: string]
  /** 拾取中心点：按 coordinateSystem 返回，可直接写入景点坐标 */
  'pick-center': [point: DrawPoint]
  /** 拾取模拟用户位置：返回 WGS84，直接交给 EvaluateRange */
  'pick-simulated': [point: DrawPoint]
  /** 绘制顶点数量变化，供父级控制「完成划区」按钮 */
  'draw-progress': [count: number]
  ready: [value: boolean]
  error: [message: string]
}>()

const container = useTemplateRef<HTMLDivElement>('container')
const runtimeConfig = useRuntimeConfig()
const loading = shallowRef(true)
const mapError = shallowRef('')
const vertices = shallowRef<BoundaryPoint[]>([])

let sdk: any
let map: any
let alive = true
let readyPromise: Promise<void> | null = null
let staticLayers: any[] = []
let draftLayer: any = null
let vertexHandles: any[] = []

/* ---------------------------------------------------------------- 坐标转换 */

function projectBoundary(geometry: ReturnType<typeof parseBoundary>, source: number) {
  if (!geometry) return []
  return boundaryPolygons(geometry).map(polygon => polygon.map(ring => ring.map(point => {
    const converted = toGcj02({ longitude: point[0], latitude: point[1] }, source)
    return [converted.longitude, converted.latitude] as BoundaryPoint
  })))
}

function projectPoint(point: DrawPoint, source: number): BoundaryPoint {
  const converted = toGcj02({ longitude: point.longitude, latitude: point.latitude }, source)
  return [converted.longitude, converted.latitude]
}

/** 地图 GCJ-02 坐标 → 目标坐标系；BD-09 前端没有可靠逆变换，明确拒绝而不是给出错误坐标 */
function unproject(point: BoundaryPoint, target: number): BoundaryPoint {
  if (target === 2) return point
  if (target === 1) {
    const converted = gcj02ToWgs84({ longitude: point[0], latitude: point[1] })
    return [converted.longitude, converted.latitude]
  }
  throw new Error('BD-09 坐标系暂不支持地图划取，请改用坐标拾取或手工粘贴 GeoJSON。')
}

/* ---------------------------------------------------------------- 渲染 */

function clearLayers() {
  if (!map) return
  if (staticLayers.length) map.remove(staticLayers)
  if (draftLayer) map.remove(draftLayer)
  if (vertexHandles.length) map.remove(vertexHandles)
  staticLayers = []
  draftLayer = null
  vertexHandles = []
}

function render(fit = false) {
  if (!map) return
  clearLayers()

  // 1. 目的地边界（上限，越界判定依据）
  const destination = parseBoundary(props.destinationBoundaryGeoJson)
  for (const polygon of projectBoundary(destination, 1)) {
    staticLayers.push(new sdk.Polygon({
      path: polygon,
      strokeColor: '#c7a257',
      strokeWeight: 3,
      strokeStyle: 'dashed',
      fillColor: '#c7a257',
      fillOpacity: 0.08,
      bubble: true,
    }))
  }

  // 2. 归属片区边界（仅用于对齐，不参与判定）
  const siteArea = parseBoundary(props.siteAreaBoundaryGeoJson)
  for (const polygon of projectBoundary(siteArea, 1)) {
    staticLayers.push(new sdk.Polygon({
      path: polygon,
      strokeColor: '#5b8ff9',
      strokeWeight: 2,
      fillColor: '#5b8ff9',
      fillOpacity: 0.06,
      bubble: true,
    }))
  }

  // 3. 当前景点范围
  const source = Number(props.coordinateSystem) || 1
  const geometry = parseBoundary(props.boundaryGeoJson)
  const anchor = props.center ? projectPoint(props.center, source) : null
  const proximity = Number(props.proximityMeters) || 0

  if (Number(props.rangeType) === 2 && anchor && Number(props.radiusMeters) > 0) {
    const projected = projectBoundary(
      parseBoundary(JSON.stringify({ type: 'Polygon', coordinates: [circleToRing({ longitude: anchor[0], latitude: anchor[1] }, Number(props.radiusMeters))] })),
      2,
    )
    for (const polygon of projected) {
      staticLayers.push(new sdk.Polygon({ path: polygon, strokeColor: '#327dce', strokeWeight: 3, fillColor: '#327dce', fillOpacity: 0.18, bubble: true }))
    }
    if (proximity > 0) {
      const buffer = projectBoundary(
        parseBoundary(JSON.stringify({ type: 'Polygon', coordinates: [circleToRing({ longitude: anchor[0], latitude: anchor[1] }, Number(props.radiusMeters) + proximity)] })),
        2,
      )
      for (const polygon of buffer) {
        staticLayers.push(new sdk.Polygon({ path: polygon, strokeColor: '#41b883', strokeWeight: 2, strokeStyle: 'dashed', fillColor: '#41b883', fillOpacity: 0.07, bubble: true }))
      }
    }
  } else if (Number(props.rangeType) === 3 && geometry) {
    for (const polygon of projectBoundary(geometry, source)) {
      staticLayers.push(new sdk.Polygon({ path: polygon, strokeColor: '#327dce', strokeWeight: 3, fillColor: '#327dce', fillOpacity: 0.18, bubble: true }))
      // 多边形接近缓冲区：用与阈值等宽的描边做近似外扩（判定仍由后端/共享几何算法完成）
      const bufferWeight = proximity > 0 ? metersToStrokeWeight(proximity, polygon[0] ?? []) : 0
      if (bufferWeight > 0) {
        staticLayers.push(new sdk.Polygon({ path: polygon, strokeColor: '#41b883', strokeWeight: bufferWeight, strokeOpacity: 0.25, fillOpacity: 0, bubble: false }))
      }
    }
  }

  if (anchor) {
    staticLayers.push(new sdk.Marker({ position: anchor, title: '景点锚点（圆心）', bubble: true }))
  }

  // 4. 模拟用户位置
  if (props.simulatedPoint) {
    const point = projectPoint(props.simulatedPoint, 1)
    const content = document.createElement('div')
    content.className = 'range-canvas-simulated'
    content.textContent = '模拟位置'
    staticLayers.push(new sdk.Marker({ position: point, content, anchor: 'bottom-center', zIndex: 300, bubble: false }))
  }

  if (staticLayers.length) map.add(staticLayers)

  renderVertexHandles()
  if (fit && staticLayers.length) map.setFitView(staticLayers, false, [50, 50, 50, 50], 17)
}

/**
 * 把「米」换算成近似像素描边宽度：用同一经线方向上临近两点的屏幕距离反推当前缩放比例。
 * 只用于可视化接近缓冲区，不参与任何判定。
 */
function metersToStrokeWeight(meters: number, path: BoundaryPoint[]): number {
  const reference = path[0]
  if (!map || !reference) return 0
  const latitudeOffset = meters / 111320
  const from = map.lngLatToContainer(new sdk.LngLat(reference[0], reference[1]))
  const to = map.lngLatToContainer(new sdk.LngLat(reference[0], reference[1] + latitudeOffset))
  const pixels = Math.abs(Number(to?.y) - Number(from?.y))
  if (!Number.isFinite(pixels) || pixels <= 0) return 0
  return Math.round(pixels * 2)
}

function renderDraft() {
  if (!map) return
  if (draftLayer) { map.remove(draftLayer); draftLayer = null }
  if (vertices.value.length > 1) {
    const options = { path: vertices.value, strokeColor: '#d6aa54', strokeWeight: 3, fillColor: '#d6aa54', fillOpacity: 0.2, bubble: true }
    draftLayer = vertices.value.length >= 3 ? new sdk.Polygon(options) : new sdk.Polyline(options)
    map.add(draftLayer)
  }
  emit('draw-progress', vertices.value.length)
}

/** 顶点手柄：多边形的每个环都可拖动修改，闭合重复点跟随首点 */
function renderVertexHandles() {
  if (!map) return
  if (vertexHandles.length) { map.remove(vertexHandles); vertexHandles = [] }
  if (props.mode !== 'edit' || props.disabled || Number(props.rangeType) !== 3) return

  const source = Number(props.coordinateSystem) || 1
  const geometry = parseBoundary(props.boundaryGeoJson)
  if (!geometry) return

  boundaryPolygons(geometry).forEach((polygon, polygonIndex) => {
    polygon.forEach((ring, ringIndex) => {
      // 闭合环的最后一个点与首点重合，不单独生成手柄
      ring.slice(0, -1).forEach((point, vertexIndex) => {
        const handle = new sdk.Marker({
          position: projectPoint({ longitude: point[0], latitude: point[1] }, source),
          draggable: true,
          anchor: 'center',
          zIndex: 260,
          content: '<div class="range-canvas-vertex"></div>',
          bubble: false,
        })
        handle.on('dragend', () => {
          const position = handle.getPosition()
          commitVertexDrag(polygonIndex, ringIndex, vertexIndex, [position.getLng(), position.getLat()])
        })
        vertexHandles.push(handle)
      })
    })
  })

  if (vertexHandles.length) map.add(vertexHandles)
}

function commitVertexDrag(polygonIndex: number, ringIndex: number, vertexIndex: number, gcjPoint: BoundaryPoint) {
  try {
    const source = Number(props.coordinateSystem) || 1
    const geometry = parseBoundary(props.boundaryGeoJson)
    if (!geometry) return
    // 深拷贝后修改，避免直接改 props 传入的解析结果
    const clone = JSON.parse(JSON.stringify(geometry)) as {
      type: 'Polygon' | 'MultiPolygon'
      coordinates: BoundaryPoint[][] | BoundaryPoint[][][]
    }
    const polygons = clone.type === 'Polygon'
      ? [clone.coordinates as BoundaryPoint[][]]
      : (clone.coordinates as BoundaryPoint[][][])
    const ring = polygons[polygonIndex]?.[ringIndex]
    if (!ring) return

    const converted = unproject(gcjPoint, source)
    ring[vertexIndex] = converted
    if (vertexIndex === 0) ring[ring.length - 1] = [...converted]

    const next = JSON.stringify(clone)
    // 顶点拖动后几何可能自交，用共享解析器校验，非法时不落回父级
    if (!parseBoundary(next)) {
      emit('error', '拖动后的顶点会让范围几何失效（自交或点数不足），请撤销该次拖动。')
      render()
      return
    }
    emit('update:boundaryGeoJson', next)
  } catch (caught) {
    emit('error', caught instanceof Error ? caught.message : '顶点更新失败。')
    render()
  }
}

/* ---------------------------------------------------------------- 交互 */

function mapClick(event: any) {
  if (props.disabled) return
  const point: BoundaryPoint = [Number(event.lnglat.getLng()), Number(event.lnglat.getLat())]
  if (props.mode === 'draw') {
    if (vertices.value.length >= 2000) { emit('error', '最多支持 2000 个顶点。'); return }
    vertices.value = [...vertices.value, point]
    renderDraft()
    return
  }
  if (props.mode === 'pick-center') {
    try {
      const converted = unproject(point, Number(props.coordinateSystem) || 1)
      emit('pick-center', { longitude: converted[0], latitude: converted[1] })
    } catch (caught) {
      emit('error', caught instanceof Error ? caught.message : '坐标转换失败。')
    }
    return
  }
  if (props.mode === 'pick-simulated') {
    const converted = unproject(point, 1)
    emit('pick-simulated', { longitude: converted[0], latitude: converted[1] })
  }
}

/** 完成划区：闭合环并按 coordinateSystem 输出 Polygon。几何非法时返回 false */
function finishDrawing(): boolean {
  if (vertices.value.length < 3) {
    emit('error', '请至少划取 3 个不同且不共线的顶点。')
    return false
  }
  try {
    const ring = [...vertices.value, vertices.value[0]!]
    const source = JSON.stringify({
      type: 'Polygon',
      coordinates: [unprojectAll(ring, Number(props.coordinateSystem) || 1)],
    })
    if (!parseBoundary(source)) {
      emit('error', '请划取至少 3 个不同且不共线的顶点。')
      return false
    }
    vertices.value = []
    renderDraft()
    emit('update:boundaryGeoJson', source)
    return true
  } catch (caught) {
    emit('error', caught instanceof Error ? caught.message : '划区失败。')
    return false
  }
}

function unprojectAll(ring: BoundaryPoint[], target: number): BoundaryPoint[] {
  return ring.map(point => unproject(point, target))
}

function undoVertex() {
  vertices.value = vertices.value.slice(0, -1)
  renderDraft()
}

function cancelDrawing() {
  vertices.value = []
  renderDraft()
}

/** 用外部 GeoJSON（如「复制片区边界」返回结果）覆盖草稿，便于在地图上继续微调 */
function setDraftFromGeoJson(geometryGeoJson: string): boolean {
  const geometry = parseBoundary(geometryGeoJson)
  if (!geometry) return false
  const source = Number(props.coordinateSystem) || 1
  const ring = boundaryPolygons(geometry)[0]?.[0]
  if (!ring?.length) return false
  vertices.value = ring.slice(0, -1).map(point => projectPoint({ longitude: point[0], latitude: point[1] }, source))
  renderDraft()
  return true
}

function zoomBy(amount: number) {
  if (map) map.setZoom(map.getZoom() + amount)
}

async function initializeMap() {
  if (!alive || !container.value) return
  map?.destroy()
  map = null
  staticLayers = []
  draftLayer = null
  vertexHandles = []
  loading.value = true
  mapError.value = ''
  emit('ready', false)
  try {
    sdk = await loadAdminAMap({
      key: String(runtimeConfig.public.amapKey || ''),
      securityCode: String(runtimeConfig.public.amapSecurityCode || ''),
      securityProxy: String(runtimeConfig.public.amapSecurityProxy || ''),
    })
    await nextTick()
    if (!alive || !container.value) return
    const source = Number(props.coordinateSystem) || 1
    const center = props.center
      ? projectPoint(props.center, source)
      : props.simulatedPoint
        ? projectPoint(props.simulatedPoint, 1)
        : [116.38, 39.94]
    map = new sdk.Map(container.value, { center, zoom: 16, viewMode: '2D', resizeEnable: true, doubleClickZoom: false })
    map.on('click', mapClick)
    render(true)
    emit('ready', true)
  } catch (caught) {
    if (alive) {
      mapError.value = caught instanceof Error ? caught.message : '地图加载失败。'
      emit('error', mapError.value)
    }
  } finally {
    if (alive) loading.value = false
  }
}

onMounted(() => { readyPromise = initializeMap(); void readyPromise })

watch(
  () => [props.destinationBoundaryGeoJson, props.siteAreaBoundaryGeoJson, props.boundaryGeoJson, props.rangeType, props.radiusMeters, props.coordinateSystem, props.mode, props.disabled],
  () => render(),
)
watch(() => props.center, () => render())
watch(() => props.simulatedPoint, () => render())
watch(() => props.proximityMeters, () => render())

onBeforeUnmount(() => {
  alive = false
  map?.destroy()
  map = null
})

defineExpose({
  finishDrawing,
  undoVertex,
  cancelDrawing,
  setDraftFromGeoJson,
  zoomBy,
  redraw: () => render(true),
  vertexCount: () => vertices.value.length,
  /** 未使用，保留给父级等待地图就绪 */
  whenReady: () => readyPromise,
})
</script>

<template>
  <div class="range-canvas" :class="props.heightClass">
    <div ref="container" class="range-canvas__map" :class="{ 'cursor-crosshair': ['draw', 'pick-center', 'pick-simulated'].includes(props.mode) }" />
    <div v-if="!loading && !mapError" class="absolute right-3 top-3 z-10 flex gap-1 rounded-lg border border-border bg-background/95 p-1">
      <Button size="sm" variant="ghost" aria-label="放大地图" @click="zoomBy(1)">＋</Button>
      <Button size="sm" variant="ghost" aria-label="缩小地图" @click="zoomBy(-1)">－</Button>
      <Button size="sm" variant="ghost" @click="render(true)">全览</Button>
    </div>
    <div class="pointer-events-none absolute bottom-3 left-3 z-10 space-y-0.5 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs">
      <p><span class="range-canvas__swatch range-canvas__swatch--destination" />目的地边界（范围上限）</p>
      <p><span class="range-canvas__swatch range-canvas__swatch--area" />归属片区边界</p>
      <p><span class="range-canvas__swatch range-canvas__swatch--range" />当前景点范围</p>
      <p><span class="range-canvas__swatch range-canvas__swatch--buffer" />接近缓冲区</p>
    </div>
    <div v-if="loading || mapError" class="absolute inset-0 z-20 flex items-center justify-center bg-background/70 p-6 text-center text-sm">
      <div class="space-y-3">
        <p :class="mapError ? 'text-destructive' : 'text-muted-foreground'" role="status">{{ mapError || '正在加载高德地图…' }}</p>
        <Button v-if="mapError" variant="outline" @click="initializeMap">重新加载地图</Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.range-canvas { position: relative; isolation: isolate; width: 100%; min-width: 0; overflow: hidden; }
.range-canvas__map { position: relative; width: 100%; height: 100%; overflow: hidden; }
.range-canvas__map :deep(.amap-maps) { position: absolute; inset: 0; width: 100%; height: 100%; }
.range-canvas :deep(.range-canvas-vertex) { width: 12px; height: 12px; border: 2px solid #fff; border-radius: 999px; background: #327dce; box-shadow: 0 1px 4px rgb(0 0 0 / 45%); cursor: move; }
.range-canvas :deep(.range-canvas-simulated) { border: 2px solid #fff; border-radius: 6px; padding: 4px 8px; background: #d64545; color: #fff; font-size: 11px; box-shadow: 0 2px 8px rgb(0 0 0 / 35%); }
.range-canvas__swatch { display: inline-block; width: 10px; height: 10px; margin-right: 4px; border-radius: 2px; vertical-align: middle; }
.range-canvas__swatch--destination { background: #c7a257; }
.range-canvas__swatch--area { background: #5b8ff9; }
.range-canvas__swatch--range { background: #327dce; }
.range-canvas__swatch--buffer { background: #41b883; }
</style>
