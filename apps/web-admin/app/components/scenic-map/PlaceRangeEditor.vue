<script setup lang="ts">
/**
 * 景点范围编辑器（点 / 圆 / 多边形 + 接近与解除阈值 + 归属片区）。
 *
 * 设计依据：doc/b-admin-functional-optimization-plan.md §5.1 / §5.2 / §5.5。
 * - 几何与判定复用 `@/utils/scenic-boundary`（实现已在 `@path-seeker/ts-shared`，禁止再造一套）；
 * - 画区交互复用既有的手动划取方式，并在 `BoundaryDrawCanvas` 上同时显示
 *   目的地边界、归属片区边界、当前景点范围与接近缓冲区；
 * - 「复制片区边界」调用 `/api/CulturalPlace/CopyAreaBoundary`，结果先填入编辑框由人工确认，
 *   再通过 `UpdateRange` 保存（不做运行时引用）；
 * - 越界（后端 code=12011）不落库：这里给出「先扩大父级目的地边界」的明确引导，
 *   并提供跳转到目的地边界编辑界面的入口，带上当前范围参考坐标。
 */
import { computed, reactive, shallowRef, useTemplateRef, watch } from 'vue'
import { gcj02ToWgs84 } from '@path-seeker/ts-shared'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import Input from '@/components/shadcn/input/Input.vue'
import Select from '@/components/shadcn/select/Select.vue'
import Textarea from '@/components/shadcn/textarea/Textarea.vue'
import BoundaryDrawCanvas from '@/components/scenic-map/BoundaryDrawCanvas.vue'
import { resolveApiErrorMessage, useApiClient } from '@/composables/useApiClient'
import { useActionFeedback } from '@/composables/useActionFeedback'
import { isBusinessErrorCode, isConflictError } from '@/utils/api-error'
import { boundaryPolygons, circleToRing, parseBoundary } from '@/utils/scenic-boundary'
import {
  PLACE_RANGE_ERROR_CODE,
  PLACE_RANGE_TYPE,
  PLACE_RANGE_TYPE_LABEL,
  type PlaceRangeEvaluation,
  type PlaceRangeType,
  type RangeOutOfDestinationContext,
  type UpdatePlaceRangeRequest,
} from '@/types/cultural-place-range'
import type { CulturalPlaceRecord } from '@/types/cultural-place'
import type { MuseumResponse } from '@/types/museum'
import type { SiteAreaPageResult, SiteAreaResponse } from '@/types/site-area'

type MapMode = 'idle' | 'pick-center' | 'pick-simulated' | 'draw' | 'edit'
type DrawPoint = { longitude: number; latitude: number }

const props = defineProps<{
  open: boolean
  place: CulturalPlaceRecord | null
  destination: MuseumResponse | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** 范围或景点锚点已保存，父级需要刷新列表与详情 */
  saved: []
}>()

const { request } = useApiClient()
const feedback = useActionFeedback()
const canvas = useTemplateRef<InstanceType<typeof BoundaryDrawCanvas>>('canvas')

const saving = shallowRef(false)
const copying = shallowRef(false)
const evaluating = shallowRef(false)
const message = shallowRef('')
const actionError = shallowRef('')
const conflictMessage = shallowRef('')
const outOfDestination = shallowRef<RangeOutOfDestinationContext | null>(null)

const mapMode = shallowRef<MapMode>('idle')
const drawCount = shallowRef(0)

const rangeVersion = shallowRef(0)
const defaultProximity = shallowRef<number | null>(null)
const defaultRelease = shallowRef<number | null>(null)
const destinationBoundaryGeoJson = shallowRef<string | null>(null)
const siteAreaBoundaryGeoJson = shallowRef<string | null>(null)
const anchor = shallowRef<DrawPoint | null>(null)
const coordinateSystem = shallowRef(1)

const simulatedPoint = shallowRef<DrawPoint | null>(null)
const evaluation = shallowRef<PlaceRangeEvaluation | null>(null)

const siteAreas = shallowRef<SiteAreaResponse[]>([])
const siteAreasLoaded = shallowRef(false)

const form = reactive({
  rangeType: PLACE_RANGE_TYPE.POINT as PlaceRangeType,
  rangeRadiusMeters: '',
  boundaryGeoJson: '',
  siteAreaId: '0',
  proximity: '',
  release: '',
})

/** 生效阈值：表单留空时显示全局默认值 */
const effectiveProximity = computed(() => {
  const value = Number(form.proximity)
  return Number.isFinite(value) && form.proximity !== '' ? value : defaultProximity.value
})
const effectiveRelease = computed(() => {
  const value = Number(form.release)
  return Number.isFinite(value) && form.release !== '' ? value : defaultRelease.value
})

const thresholdError = computed(() => {
  const proximity = effectiveProximity.value
  const release = effectiveRelease.value
  if (proximity == null || release == null) return ''
  return release < proximity ? '解除阈值不能小于接近阈值。' : ''
})

const canSave = computed(() =>
  Boolean(props.place?.id)
  && !saving.value
  && !copying.value
  && !thresholdError.value
  && (form.rangeType !== PLACE_RANGE_TYPE.CIRCLE || Number(form.rangeRadiusMeters) > 0)
  && (form.rangeType !== PLACE_RANGE_TYPE.POLYGON || Boolean(parseBoundary(form.boundaryGeoJson))),
)

const hasDestinationBoundary = computed(() => Boolean(parseBoundary(destinationBoundaryGeoJson.value)))

const destinationId = computed(() => String(props.place?.museumId || props.destination?.id || ''))
const destinationName = computed(() => props.destination?.name || '父级目的地')

const rangeMeta = computed(() => {
  if (form.rangeType === PLACE_RANGE_TYPE.POINT) return '点范围：按景点坐标做接近判定，不再额外圈定区域。'
  if (form.rangeType === PLACE_RANGE_TYPE.CIRCLE) return '圆范围：圆心复用景点坐标，半径按米填写。'
  return '多边形范围：可在图上划取或拖动顶点修改；允许内环（水域、不开放区域）。'
})

/* ------------------------------------------------------------------ 初始化 */

function reset() {
  const place = props.place
  mapMode.value = 'idle'
  drawCount.value = 0
  simulatedPoint.value = null
  evaluation.value = null
  outOfDestination.value = null
  conflictMessage.value = ''
  actionError.value = ''
  message.value = ''
  if (!place) return

  coordinateSystem.value = Number(place.coordinateSystem) || 1
  anchor.value = place.longitude != null && place.latitude != null
    ? { longitude: Number(place.longitude), latitude: Number(place.latitude) }
    : null
  rangeVersion.value = Number(place.rangeVersion) || 0
  defaultProximity.value = place.defaultProximityDistanceMeters ?? null
  defaultRelease.value = place.defaultReleaseDistanceMeters ?? null
  destinationBoundaryGeoJson.value = place.destinationBoundaryGeoJson ?? null
  siteAreaBoundaryGeoJson.value = place.siteAreaBoundaryGeoJson ?? null

  form.rangeType = ([1, 2, 3].includes(Number(place.rangeType)) ? Number(place.rangeType) : 1) as PlaceRangeType
  form.rangeRadiusMeters = place.rangeRadiusMeters != null ? String(place.rangeRadiusMeters) : ''
  form.boundaryGeoJson = place.boundaryGeoJson || ''
  form.siteAreaId = String(place.siteAreaId || '0')
  form.proximity = place.proximityDistanceMeters != null ? String(place.proximityDistanceMeters) : ''
  form.release = place.releaseDistanceMeters != null ? String(place.releaseDistanceMeters) : ''
}

async function loadSiteAreas() {
  const museumId = destinationId.value
  if (!museumId || siteAreasLoaded.value) return
  try {
    const result = await request<SiteAreaPageResult<SiteAreaResponse>>('/api/site-area/query', {
      method: 'POST',
      body: { museumId, pageIndex: 1, pageSize: 200 },
    })
    siteAreas.value = result?.list ?? []
  } catch {
    // 片区列表只用于「归属片区」下拉，加载失败不阻断范围编辑
    siteAreas.value = []
  } finally {
    siteAreasLoaded.value = true
  }
}

watch(() => [props.open, props.place?.id], () => {
  if (!props.open) return
  reset()
  void loadSiteAreas()
}, { immediate: true })

watch(() => props.place, () => { if (props.open) reset() })

/* ------------------------------------------------------------------ 绘制交互 */

function startPickCenter() {
  if (saving.value) return
  void canvas.value?.cancelDrawing()
  mapMode.value = mapMode.value === 'pick-center' ? 'idle' : 'pick-center'
  actionError.value = ''
  if (mapMode.value === 'pick-center') message.value = '点击地图拾取景点锚点（同时作为圆心）；保存后立即生效。'
}

function startPickSimulated() {
  void canvas.value?.cancelDrawing()
  mapMode.value = mapMode.value === 'pick-simulated' ? 'idle' : 'pick-simulated'
  evaluation.value = null
  actionError.value = ''
  if (mapMode.value === 'pick-simulated') message.value = '点击地图选择模拟用户位置，然后点击「校验判定结果」。'
}

function startDrawing() {
  if (saving.value) return
  form.rangeType = PLACE_RANGE_TYPE.POLYGON
  mapMode.value = 'draw'
  drawCount.value = 0
  void canvas.value?.cancelDrawing()
  actionError.value = ''
  message.value = '沿景点边界依次点击至少 3 个不同顶点，完成后点击「完成划区」。'
}

function startEditVertices() {
  if (saving.value) return
  if (mapMode.value === 'edit') {
    mapMode.value = 'idle'
    message.value = '已结束顶点修改。'
    return
  }
  if (form.rangeType !== PLACE_RANGE_TYPE.POLYGON || !parseBoundary(form.boundaryGeoJson)) {
    actionError.value = '请先划取或复制一个多边形范围，再修改顶点。'
    return
  }
  void canvas.value?.cancelDrawing()
  mapMode.value = 'edit'
  actionError.value = ''
  message.value = '拖动蓝色顶点调整范围；松开顶点后自动校验几何，非法时会被拒绝。'
}

/** 范围类型切换：圆与多边形需要先补齐必填内容 */
function setRangeType(value: string) {
  const next = Number(value)
  if (![1, 2, 3].includes(next)) return
  form.rangeType = next as PlaceRangeType
  mapMode.value = 'idle'
  actionError.value = ''
}

function finishDrawing() {
  if (canvas.value?.finishDrawing()) {
    mapMode.value = 'idle'
    drawCount.value = 0
    message.value = '已划定范围，保存后写入数据库。'
  }
}

function cancelDrawing() {
  void canvas.value?.cancelDrawing()
  drawCount.value = 0
  mapMode.value = 'idle'
}

function clearRange() {
  form.boundaryGeoJson = ''
  form.rangeRadiusMeters = ''
  form.rangeType = PLACE_RANGE_TYPE.POINT
  void canvas.value?.cancelDrawing()
  mapMode.value = 'idle'
  evaluation.value = null
  message.value = '已清空范围草稿，保存后该景点恢复为点语义。'
}

async function handlePickCenter(point: DrawPoint) {
  const place = props.place
  if (!place?.id) return
  mapMode.value = 'idle'
  saving.value = true
  actionError.value = ''
  try {
    await request('/api/cultural-place/position', {
      method: 'POST',
      body: {
        id: place.id,
        museumId: destinationId.value,
        longitude: point.longitude,
        latitude: point.latitude,
        coordinateSystem: coordinateSystem.value,
      },
    })
    anchor.value = point
    message.value = '景点锚点已更新。圆形与点范围的圆心使用该坐标。'
    emit('saved')
  } catch (caught) {
    actionError.value = resolveApiErrorMessage(caught, '景点锚点保存失败。')
  } finally {
    saving.value = false
  }
}

function handlePickSimulated(point: DrawPoint) {
  mapMode.value = 'idle'
  simulatedPoint.value = point
  evaluation.value = null
  message.value = `模拟位置：${point.longitude.toFixed(6)}, ${point.latitude.toFixed(6)}。`
}

/* ------------------------------------------------------------------ 复制片区边界 */

async function copyAreaBoundary() {
  const place = props.place
  if (!place?.id) return
  if (form.siteAreaId === '0') {
    actionError.value = '请先选择归属片区，再复制片区边界。'
    return
  }
  copying.value = true
  actionError.value = ''
  message.value = ''
  try {
    const geojson = await request<string>('/api/cultural-place/copy-area-boundary', {
      method: 'POST',
      body: { id: place.id, siteAreaId: form.siteAreaId },
    })
    if (!geojson || !parseBoundary(geojson)) throw new Error('该片区尚未设置有效边界。')
    form.rangeType = PLACE_RANGE_TYPE.POLYGON
    form.boundaryGeoJson = geojson
    mapMode.value = 'idle'
    canvas.value?.setDraftFromGeoJson(geojson)
    message.value = '片区边界已填入范围编辑框，请确认后再点「保存范围」；保存的是复制结果，后续片区改动不会影响该景点。'
  } catch (caught) {
    actionError.value = resolveApiErrorMessage(caught, '复制片区边界失败。')
  } finally {
    copying.value = false
  }
}

/* ------------------------------------------------------------------ 模拟判定 */

async function evaluate() {
  const place = props.place
  if (!place?.id) return
  if (!simulatedPoint.value) {
    actionError.value = '请先在地图上选择模拟用户位置。'
    return
  }
  evaluating.value = true
  actionError.value = ''
  try {
    evaluation.value = await request<PlaceRangeEvaluation>('/api/cultural-place/evaluate-range', {
      method: 'POST',
      body: { id: place.id, longitude: simulatedPoint.value.longitude, latitude: simulatedPoint.value.latitude },
    })
  } catch (caught) {
    evaluation.value = null
    actionError.value = resolveApiErrorMessage(caught, '范围判定失败。')
  } finally {
    evaluating.value = false
  }
}

/* ------------------------------------------------------------------ 保存与越界引导 */

const optionalNumber = (value: string): number | null => {
  const text = value.trim()
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

/** 当前范围的关键坐标（WGS84），作为跳转目的地边界编辑的参考 */
function collectReferencePoints(): DrawPoint[] {
  const source = coordinateSystem.value
  const toWgs84 = (point: DrawPoint): DrawPoint | null => {
    if (source === 1) return point
    if (source === 2) {
      const converted = gcj02ToWgs84({ longitude: point.longitude, latitude: point.latitude })
      return { longitude: converted.longitude, latitude: converted.latitude }
    }
    // BD-09 没有前端可用的可靠逆变换：宁可不给参考坐标，也不给错坐标
    return null
  }

  const raw: DrawPoint[] = []
  if (form.rangeType === PLACE_RANGE_TYPE.POLYGON) {
    const geometry = parseBoundary(form.boundaryGeoJson)
    if (geometry) {
      outer: for (const polygon of boundaryPolygons(geometry)) {
        for (const ring of polygon) {
          for (const point of ring) {
            raw.push({ longitude: point[0], latitude: point[1] })
            if (raw.length >= 12) break outer
          }
        }
      }
    }
  } else if (form.rangeType === PLACE_RANGE_TYPE.CIRCLE && anchor.value && Number(form.rangeRadiusMeters) > 0) {
    const ring = circleToRing(anchor.value, Number(form.rangeRadiusMeters), 16)
    for (const point of ring) raw.push({ longitude: point[0], latitude: point[1] })
  } else if (anchor.value) {
    raw.push(anchor.value)
  }

  return raw.map(toWgs84).filter((point): point is DrawPoint => point !== null).slice(0, 12)
}

async function save() {
  const place = props.place
  if (!place?.id) return
  if (mapMode.value === 'draw') {
    actionError.value = '请先完成或取消当前划区。'
    return
  }
  saving.value = true
  actionError.value = ''
  conflictMessage.value = ''
  outOfDestination.value = null
  try {
    const body: UpdatePlaceRangeRequest = {
      id: place.id,
      rangeType: form.rangeType,
      rangeRadiusMeters: form.rangeType === PLACE_RANGE_TYPE.CIRCLE ? Number(form.rangeRadiusMeters) : null,
      boundaryGeoJson: form.rangeType === PLACE_RANGE_TYPE.POLYGON ? form.boundaryGeoJson : null,
      siteAreaId: form.siteAreaId || '0',
      proximityDistanceMeters: optionalNumber(form.proximity),
      releaseDistanceMeters: optionalNumber(form.release),
      rangeVersion: rangeVersion.value,
    }
    await request('/api/cultural-place/update-range', { method: 'POST', body })
    feedback.success('景点范围已保存。')
    emit('saved')
    emit('update:open', false)
  } catch (caught) {
    if (isBusinessErrorCode(caught, PLACE_RANGE_ERROR_CODE.RANGE_OUT_OF_DESTINATION)) {
      // 越界数据不落库：这里给出「先扩大父级目的地边界」的引导，而不是只弹一个错误
      outOfDestination.value = {
        destinationId: destinationId.value,
        destinationName: destinationName.value,
        referencePoints: collectReferencePoints(),
        message: resolveApiErrorMessage(caught, '景点范围超出父级目的地边界，请先扩大目的地边界。'),
      }
      return
    }
    if (isConflictError(caught)) {
      conflictMessage.value = '范围已被他人修改，请刷新后重试'
      return
    }
    actionError.value = resolveApiErrorMessage(caught, '景点范围保存失败。')
  } finally {
    saving.value = false
  }
}

/** 带当前范围参考坐标跳到父级目的地边界编辑界面 */
function goToDestinationBoundary() {
  const context = outOfDestination.value
  if (!context) return
  const reference = context.referencePoints.map(point => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`).join(';')
  void navigateTo({
    path: '/console/museums',
    query: {
      museumId: context.destinationId,
      focus: 'boundary',
      ...(reference ? { ref: reference } : {}),
    },
  })
}

async function copyReferencePoints() {
  const reference = outOfDestination.value?.referencePoints ?? []
  if (!reference.length) return
  const text = reference.map(point => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    feedback.success('参考坐标已复制。')
  } catch {
    actionError.value = '浏览器拒绝写入剪贴板，请手工抄录下方坐标。'
  }
}

function close() {
  if (saving.value) return
  emit('update:open', false)
}

defineExpose({ refresh: reset })
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', Boolean($event))">
    <DialogContent class="max-w-[min(96vw,1100px)] space-y-4 p-5">
      <DialogHeader>
        <DialogTitle>景点范围 · {{ props.place?.name || '未选择景点' }}</DialogTitle>
        <DialogDescription>
          {{ destinationName }} · {{ PLACE_RANGE_TYPE_LABEL[form.rangeType] }}范围 · 版本 {{ rangeVersion }}
          <span v-if="!hasDestinationBoundary"> · 该目的地尚未设置边界，暂不校验越界</span>
        </DialogDescription>
      </DialogHeader>

      <!-- 12011：越界引导（越界数据未落库） -->
      <section v-if="outOfDestination" role="alert" class="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
        <p class="font-medium text-destructive">范围超出父级目的地边界，本次未保存</p>
        <p class="leading-6 text-muted-foreground">{{ outOfDestination.message }}</p>
        <p class="leading-6 text-muted-foreground">
          处理方式：先把「{{ outOfDestination.destinationName }}」的目的地边界扩大，覆盖当前范围后回到本页重新保存。
          越界数据不会写入数据库，当前草稿仍保留在编辑框里。
        </p>
        <div v-if="outOfDestination.referencePoints.length" class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-muted-foreground">需要覆盖的参考坐标（WGS84，共 {{ outOfDestination.referencePoints.length }} 个）</span>
            <Button type="button" size="sm" variant="outline" @click="copyReferencePoints">复制坐标</Button>
          </div>
          <p class="max-h-20 overflow-auto rounded border border-border/60 bg-background/60 p-2 font-mono text-xs leading-5">
            {{ outOfDestination.referencePoints.map(point => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`).join('  ') }}
          </p>
        </div>
        <p v-else class="text-xs text-muted-foreground">
          当前坐标系无法在前端可靠转换为 WGS84，未生成参考坐标，请按地图上的范围自行扩大边界。
        </p>
        <div class="flex justify-end gap-2">
          <Button type="button" variant="outline" @click="outOfDestination = null">留在本页调整范围</Button>
          <Button type="button" @click="goToDestinationBoundary">去编辑「{{ outOfDestination.destinationName }}」边界</Button>
        </div>
      </section>

      <div
        v-if="conflictMessage"
        role="alert"
        class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
        <span>{{ conflictMessage }}</span>
        <Button type="button" size="sm" variant="outline" :disabled="saving" @click="reset(); $emit('saved')">刷新范围数据</Button>
      </div>

      <p v-if="actionError" role="alert" class="text-sm text-destructive">{{ actionError }}</p>
      <p v-else-if="message" class="text-sm text-muted-foreground">{{ message }}</p>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="space-y-2">
          <BoundaryDrawCanvas
            ref="canvas"
            height-class="h-[440px] rounded-lg border border-border/60"
            :center="anchor"
            :coordinate-system="coordinateSystem"
            :boundary-geo-json="form.boundaryGeoJson || null"
            :radius-meters="Number(form.rangeRadiusMeters) || null"
            :range-type="form.rangeType"
            :destination-boundary-geo-json="destinationBoundaryGeoJson"
            :site-area-boundary-geo-json="siteAreaBoundaryGeoJson"
            :proximity-meters="effectiveProximity"
            :release-meters="effectiveRelease"
            :simulated-point="simulatedPoint"
            :mode="mapMode"
            :disabled="saving"
            @update:boundary-geo-json="form.boundaryGeoJson = $event"
            @pick-center="handlePickCenter"
            @pick-simulated="handlePickSimulated"
            @draw-progress="drawCount = $event" />
          <div class="flex flex-wrap gap-2">
            <Button type="button" variant="outline" :disabled="saving" @click="startPickCenter">
              {{ mapMode === 'pick-center' ? '取消拾取锚点' : '拾取锚点/圆心' }}
            </Button>
            <template v-if="mapMode !== 'draw'">
              <Button type="button" variant="outline" :disabled="saving" @click="startDrawing">手动划取范围</Button>
              <Button type="button" variant="outline" :disabled="saving" @click="startEditVertices">
                {{ mapMode === 'edit' ? '结束顶点修改' : '修改顶点' }}
              </Button>
            </template>
            <template v-else>
              <Button type="button" :disabled="drawCount < 3" @click="finishDrawing">完成划区（{{ drawCount }} 点）</Button>
              <Button type="button" variant="outline" :disabled="!drawCount" @click="canvas?.undoVertex(); drawCount = Math.max(0, drawCount - 1)">撤销一点</Button>
              <Button type="button" variant="ghost" @click="cancelDrawing">取消划区</Button>
            </template>
            <Button type="button" variant="outline" :disabled="saving || copying || form.siteAreaId === '0'" @click="copyAreaBoundary">
              {{ copying ? '复制中…' : '复制片区边界' }}
            </Button>
            <Button type="button" variant="ghost" :disabled="saving" @click="clearRange">清空范围</Button>
            <Button type="button" variant="outline" :disabled="saving" @click="startPickSimulated">
              {{ mapMode === 'pick-simulated' ? '取消选择位置' : '选择模拟用户位置' }}
            </Button>
            <Button type="button" variant="outline" :disabled="saving || evaluating || !simulatedPoint" @click="evaluate">
              {{ evaluating ? '判定中…' : '校验判定结果' }}
            </Button>
          </div>
        </div>

        <aside class="space-y-3">
          <label class="grid gap-1.5 text-sm">
            <span class="font-medium">范围类型</span>
            <Select :model-value="String(form.rangeType)" :disabled="saving" @update:model-value="setRangeType($event)">
              <option :value="String(PLACE_RANGE_TYPE.POINT)">点（沿用景点坐标）</option>
              <option :value="String(PLACE_RANGE_TYPE.CIRCLE)">圆（圆心 = 景点坐标）</option>
              <option :value="String(PLACE_RANGE_TYPE.POLYGON)">多边形（划取或复制片区）</option>
            </Select>
            <span class="text-xs text-muted-foreground">{{ rangeMeta }}</span>
          </label>

          <label v-if="form.rangeType === PLACE_RANGE_TYPE.CIRCLE" class="grid gap-1.5 text-sm">
            <span class="font-medium">半径（米）</span>
            <Input v-model="form.rangeRadiusMeters" type="number" min="1" step="1" :disabled="saving" placeholder="例如 120" />
          </label>

          <label class="grid gap-1.5 text-sm">
            <span class="font-medium">归属片区</span>
            <Select v-model="form.siteAreaId" :disabled="saving" placeholder="选择归属片区">
              <option value="0">不关联片区</option>
              <option v-for="area in siteAreas" :key="String(area.id)" :value="String(area.id)">
                {{ area.name || area.areaCode || area.id }}
              </option>
            </Select>
            <span class="text-xs text-muted-foreground">片区仅用于分组与「复制片区边界」，不参与运行时判定。</span>
          </label>

          <div class="space-y-2 rounded-lg border border-border/70 p-3">
            <p class="text-sm font-medium">接近阈值</p>
            <label class="grid gap-1.5 text-xs">
              <span class="text-muted-foreground">
                接近阈值（米）· 留空跟随默认
                <template v-if="defaultProximity != null">（默认 {{ defaultProximity }} 米）</template>
              </span>
              <Input v-model="form.proximity" type="number" min="0" step="1" :disabled="saving" placeholder="跟随默认值" />
            </label>
            <label class="grid gap-1.5 text-xs">
              <span class="text-muted-foreground">
                解除阈值（米）· 留空跟随默认
                <template v-if="defaultRelease != null">（默认 {{ defaultRelease }} 米）</template>
              </span>
              <Input v-model="form.release" type="number" min="0" step="1" :disabled="saving" placeholder="跟随默认值" />
            </label>
            <p v-if="thresholdError" class="text-xs text-destructive">{{ thresholdError }}</p>
            <p v-else class="text-xs text-muted-foreground">
              生效值：接近 {{ effectiveProximity ?? '—' }} 米 · 解除 {{ effectiveRelease ?? '—' }} 米。距离 ≤ 接近阈值判定为接近，距离 &gt; 解除阈值才解除。
            </p>
          </div>

          <div class="space-y-2 rounded-lg border border-border/70 p-3">
            <p class="text-sm font-medium">模拟判定结果</p>
            <p v-if="!simulatedPoint" class="text-xs text-muted-foreground">先在地图上选择模拟用户位置。</p>
            <template v-else-if="evaluation">
              <p class="text-xs">
                判定：<strong :class="evaluation.isWithinRange ? 'text-emerald-300' : evaluation.isApproaching ? 'text-amber-300' : 'text-muted-foreground'">
                  {{ evaluation.isWithinRange ? '范围内' : evaluation.isApproaching ? '接近（未进入）' : '范围外' }}
                </strong>
              </p>
              <p class="text-xs text-muted-foreground">
                距离：{{ evaluation.distanceMeters == null ? '几何缺失无法计算' : `${evaluation.distanceMeters} 米` }} ·
                接近阈值 {{ evaluation.proximityDistanceMeters }} 米 · 解除阈值 {{ evaluation.releaseDistanceMeters }} 米
              </p>
            </template>
            <p v-else class="text-xs text-muted-foreground">已选择位置，点击「校验判定结果」调用后端判定。</p>
            <p class="text-xs text-muted-foreground">判定基于数据库中已保存的范围，未保存的草稿不参与判定。</p>
          </div>

          <label class="grid gap-1.5 text-sm">
            <span class="font-medium">范围 GeoJSON（按景点坐标系）</span>
            <Textarea v-model="form.boundaryGeoJson" rows="4" :disabled="saving || form.rangeType !== PLACE_RANGE_TYPE.POLYGON" placeholder="可划取、复制片区边界或手工粘贴 Polygon / MultiPolygon" />
          </label>
        </aside>
      </div>

      <DialogFooter class="items-center gap-2 border-t border-border/70 pt-3">
        <p class="mr-auto text-xs text-muted-foreground">保存会递增范围版本，C 端据此失效缓存。</p>
        <Button type="button" variant="outline" :disabled="saving" @click="close">取消</Button>
        <Button type="button" :disabled="!canSave" @click="save">{{ saving ? '保存中…' : '保存范围' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
