<script setup lang="ts">
/**
 * 通用展厅地图全屏弹层：
 * - 单图 / 多图 Tab
 * - 多点列表联动 focus + 居中
 * - 1.5× 默认、滚轮/pinch/拖拽
 * Teleport 到 [data-stage-frame] 或 body。
 */
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue"
import type { ExhibitMapOverlayPoint, ExhibitMapOverlaySheet } from "../contracts"

const MIN_SCALE = 1
const MAX_SCALE = 4
const DEFAULT_SCALE = 1.5
const WHEEL_SENSITIVITY = 0.0015
const WHEEL_DELTA_CAP = 40

const props = withDefaults(
  defineProps<{
    open: boolean
    galleryName?: string | null
    subtitle?: string | null
    /** 单底图（关卡）；与 maps 二选一，maps 优先 */
    imageUrl?: string | null
    points?: ExhibitMapOverlayPoint[]
    /** 多底图（问答） */
    maps?: ExhibitMapOverlaySheet[] | null
    initialMapId?: string | null
    focusPointId?: string | null
    /** 点位 ≥2 时默认展示底部列表 */
    showPointList?: boolean
    anchorEl?: HTMLElement | null
  }>(),
  {
    galleryName: "",
    subtitle: "",
    imageUrl: "",
    points: () => [],
    maps: null,
    initialMapId: "",
    focusPointId: "",
    showPointList: true,
    anchorEl: null,
  },
)

const emit = defineEmits<{
  close: []
  "update:open": [value: boolean]
  "update:focus-point-id": [value: string]
}>()

const portalReady = shallowRef(false)
const framed = shallowRef(false)
const teleportTo = shallowRef<HTMLElement | string>("body")
const imageFailed = shallowRef(false)
const scale = shallowRef(DEFAULT_SCALE)
const offsetX = shallowRef(0)
const offsetY = shallowRef(0)
const panning = shallowRef(false)
const activeMapId = shallowRef("")
const activeFocusId = shallowRef("")

const viewportRef = useTemplateRef<HTMLElement>("viewport")
const stageRef = useTemplateRef<HTMLElement>("stage")

const mapSheets = computed<ExhibitMapOverlaySheet[]>(() => {
  const fromMaps = (props.maps || []).filter((sheet) => String(sheet.imageUrl || "").trim())
  if (fromMaps.length) {
    return fromMaps.map((sheet, index) => ({
      id: String(sheet.id || "").trim() || `map-${index}`,
      label: String(sheet.label || "").trim() || `地图 ${index + 1}`,
      imageUrl: String(sheet.imageUrl || "").trim(),
      points: Array.isArray(sheet.points) ? sheet.points : [],
    }))
  }
  const imageUrl = String(props.imageUrl || "").trim()
  if (!imageUrl) return []
  return [
    {
      id: "single",
      label: String(props.galleryName || "").trim() || "展厅地图",
      imageUrl,
      points: Array.isArray(props.points) ? props.points : [],
    },
  ]
})

const activeSheet = computed(() => {
  const id = String(activeMapId.value || "").trim()
  if (id) {
    const matched = mapSheets.value.find((sheet) => sheet.id === id)
    if (matched) return matched
  }
  return mapSheets.value[0] || null
})

const activeImageUrl = computed(() => String(activeSheet.value?.imageUrl || "").trim())

const drawablePoints = computed(() =>
  (activeSheet.value?.points || []).filter((point) => {
    const x = Number(point.xPercent)
    const y = Number(point.yPercent)
    return Number.isFinite(x) && Number.isFinite(y)
  }),
)

const focusPoint = computed(() => {
  const focusId = String(activeFocusId.value || "").trim()
  if (focusId) {
    const matched = drawablePoints.value.find(
      (point) => String(point.id || "").trim() === focusId,
    )
    if (matched) return matched
  }
  return drawablePoints.value[0] || null
})

const galleryLabel = computed(
  () => String(props.galleryName || "").trim() || "展厅地图",
)
const subLabel = computed(() => {
  const focusTitle = String(focusPoint.value?.title || "").trim()
  if (focusTitle && drawablePoints.value.length > 1) {
    return focusTitle
  }
  return String(props.subtitle || "").trim()
})
const showMapTabs = computed(() => mapSheets.value.length > 1)
const showPoints = computed(
  () => props.showPointList && drawablePoints.value.length > 1,
)
const stageStyle = computed(() => ({
  transform: `translate3d(${offsetX.value}px, ${offsetY.value}px, 0) scale(${scale.value})`,
}))
const zoomLabel = computed(() => `${Math.round(scale.value * 100)}%`)
const canZoomIn = computed(() => scale.value < MAX_SCALE - 1e-6)
const canZoomOut = computed(() => scale.value > MIN_SCALE + 1e-6)
const hasImage = computed(() => Boolean(activeImageUrl.value) && !imageFailed.value)

type PanState = {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

type PinchTrack = {
  distance: number
  midX: number
  midY: number
}

let pan: PanState | null = null
let pinchTrack: PinchTrack | null = null
const activePointers = new Map<number, { x: number; y: number }>()

const clampScale = (value: number) => {
  const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
  return Math.round(next * 1000) / 1000
}

const clearGestures = () => {
  panning.value = false
  pinchTrack = null
  pan = null
  activePointers.clear()
}

const syncSelectionFromProps = () => {
  const sheets = mapSheets.value
  if (!sheets.length) {
    activeMapId.value = ""
    activeFocusId.value = ""
    return
  }
  const preferredMap = String(props.initialMapId || "").trim()
  const mapMatch = preferredMap
    ? sheets.find((sheet) => sheet.id === preferredMap)
    : null
  const sheet = mapMatch || sheets[0]!
  activeMapId.value = sheet.id

  const preferredFocus = String(props.focusPointId || "").trim()
  const points = (sheet.points || []).filter((point) => {
    const x = Number(point.xPercent)
    const y = Number(point.yPercent)
    return Number.isFinite(x) && Number.isFinite(y)
  })
  if (preferredFocus && points.some((point) => String(point.id || "").trim() === preferredFocus)) {
    activeFocusId.value = preferredFocus
  } else {
    activeFocusId.value = String(points[0]?.id || "").trim()
  }
}

const centerView = () => {
  const viewport = viewportRef.value
  const stage = stageRef.value
  if (!viewport || !stage) return

  const vw = viewport.clientWidth
  const vh = viewport.clientHeight
  const sw = stage.offsetWidth
  const sh = stage.offsetHeight
  if (vw <= 0 || vh <= 0 || sw <= 0 || sh <= 0) return

  const focus = focusPoint.value
  const xPct = focus ? Number(focus.xPercent) : NaN
  const yPct = focus ? Number(focus.yPercent) : NaN
  const hasPin = Number.isFinite(xPct) && Number.isFinite(yPct)
  const focusX = hasPin ? (xPct / 100) * sw : sw / 2
  const focusY = hasPin ? (yPct / 100) * sh : sh / 2
  const s = scale.value

  offsetX.value = vw / 2 - focusX * s
  offsetY.value = vh / 2 - focusY * s
}

const applyDefaultView = async () => {
  clearGestures()
  scale.value = DEFAULT_SCALE
  offsetX.value = 0
  offsetY.value = 0
  await nextTick()
  centerView()
  requestAnimationFrame(() => centerView())
}

const resetView = () => {
  clearGestures()
  scale.value = DEFAULT_SCALE
  offsetX.value = 0
  offsetY.value = 0
}

const selectMap = (mapId: string) => {
  const next = String(mapId || "").trim()
  if (!next || next === activeMapId.value) return
  const sheet = mapSheets.value.find((item) => item.id === next)
  if (!sheet) return
  activeMapId.value = next
  imageFailed.value = false
  const points = (sheet.points || []).filter((point) => {
    const x = Number(point.xPercent)
    const y = Number(point.yPercent)
    return Number.isFinite(x) && Number.isFinite(y)
  })
  activeFocusId.value = String(points[0]?.id || "").trim()
  void applyDefaultView()
}

const selectPoint = (pointId: string) => {
  const next = String(pointId || "").trim()
  if (!next) return
  const matched = drawablePoints.value.find(
    (point) => String(point.id || "").trim() === next,
  )
  if (!matched) return
  activeFocusId.value = next
  emit("update:focus-point-id", next)
  void applyDefaultView()
}

const normalizeWheelDelta = (event: WheelEvent) => {
  let delta = event.deltaY
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16
  else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    delta *= viewportRef.value?.clientHeight || 400
  }
  return Math.max(-WHEEL_DELTA_CAP, Math.min(WHEEL_DELTA_CAP, delta))
}

const zoomAt = (nextScale: number, clientX: number, clientY: number) => {
  const viewport = viewportRef.value
  const prev = scale.value
  const clamped = clampScale(nextScale)
  if (!viewport || Math.abs(clamped - prev) < 1e-6) {
    scale.value = clamped
    return
  }

  const rect = viewport.getBoundingClientRect()
  const localX = clientX - rect.left
  const localY = clientY - rect.top
  const contentX = (localX - offsetX.value) / prev
  const contentY = (localY - offsetY.value) / prev

  scale.value = clamped
  offsetX.value = localX - contentX * clamped
  offsetY.value = localY - contentY * clamped
}

const zoomByButton = (delta: number) => {
  const viewport = viewportRef.value
  if (!viewport) {
    scale.value = clampScale(scale.value + delta)
    return
  }
  const rect = viewport.getBoundingClientRect()
  zoomAt(scale.value + delta, rect.left + rect.width / 2, rect.top + rect.height / 2)
}

const handleWheel = (event: WheelEvent) => {
  if (!hasImage.value) return
  event.preventDefault()
  event.stopPropagation()
  const delta = normalizeWheelDelta(event)
  if (delta === 0) return
  const factor = Math.exp(-delta * WHEEL_SENSITIVITY)
  zoomAt(scale.value * factor, event.clientX, event.clientY)
}

const pointerDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

const pointerMid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

const onPointerDown = (event: PointerEvent) => {
  if (!hasImage.value) return
  if (event.pointerType === "mouse" && event.button !== 0) return

  const target = event.currentTarget as HTMLElement
  target.setPointerCapture?.(event.pointerId)
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (activePointers.size >= 2) {
    const pts = [...activePointers.values()]
    const mid = pointerMid(pts[0]!, pts[1]!)
    pinchTrack = {
      distance: Math.max(1, pointerDistance(pts[0]!, pts[1]!)),
      midX: mid.x,
      midY: mid.y,
    }
    pan = null
    panning.value = false
    return
  }

  pan = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: offsetX.value,
    originY: offsetY.value,
  }
  panning.value = true
}

const onPointerMove = (event: PointerEvent) => {
  if (!activePointers.has(event.pointerId)) return
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (activePointers.size >= 2) {
    event.preventDefault()
    const pts = [...activePointers.values()]
    const dist = Math.max(1, pointerDistance(pts[0]!, pts[1]!))
    const mid = pointerMid(pts[0]!, pts[1]!)
    if (!pinchTrack) {
      pinchTrack = { distance: dist, midX: mid.x, midY: mid.y }
      return
    }
    const factor = dist / pinchTrack.distance
    if (Math.abs(factor - 1) > 1e-4) {
      zoomAt(scale.value * factor, mid.x, mid.y)
    }
    offsetX.value += mid.x - pinchTrack.midX
    offsetY.value += mid.y - pinchTrack.midY
    pinchTrack = { distance: dist, midX: mid.x, midY: mid.y }
    return
  }

  if (pan && pan.pointerId === event.pointerId) {
    event.preventDefault()
    offsetX.value = pan.originX + (event.clientX - pan.startX)
    offsetY.value = pan.originY + (event.clientY - pan.startY)
  }
}

const endPointer = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture?.(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
  activePointers.delete(event.pointerId)

  if (activePointers.size < 2) pinchTrack = null
  if (pan?.pointerId === event.pointerId) {
    pan = null
    panning.value = false
  }
  if (activePointers.size === 1) {
    const [pointerId, point] = [...activePointers.entries()][0]!
    pan = {
      pointerId,
      startX: point.x,
      startY: point.y,
      originX: offsetX.value,
      originY: offsetY.value,
    }
    panning.value = true
  }
}

const resolveTeleportTarget = () => {
  const anchor = props.anchorEl
  const frame = anchor?.closest?.("[data-stage-frame]")
  if (frame instanceof HTMLElement) {
    framed.value = true
    teleportTo.value = frame
    return
  }
  framed.value = false
  teleportTo.value = "body"
}

const closeMap = (event?: Event) => {
  event?.preventDefault()
  event?.stopPropagation()
  resetView()
  portalReady.value = false
  emit("update:open", false)
  emit("close")
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", onKeydown, true)
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && props.open) {
    event.stopPropagation()
    closeMap()
  }
}

const activatePortal = async () => {
  syncSelectionFromProps()
  resetView()
  await nextTick()
  resolveTeleportTarget()
  portalReady.value = true
  await nextTick()
  await applyDefaultView()
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", onKeydown, true)
  }
}

const onImageLoad = () => {
  imageFailed.value = false
  if (props.open) void applyDefaultView()
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void activatePortal()
      return
    }
    portalReady.value = false
    resetView()
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", onKeydown, true)
    }
  },
  { immediate: true },
)

watch(
  () => [props.imageUrl, props.maps, props.initialMapId, props.focusPointId] as const,
  () => {
    imageFailed.value = false
    if (!props.open) return
    syncSelectionFromProps()
    void applyDefaultView()
  },
)

watch(activeImageUrl, () => {
  imageFailed.value = false
})

onBeforeUnmount(() => {
  if (typeof window === "undefined") return
  window.removeEventListener("keydown", onKeydown, true)
})
</script>

<template>
  <Teleport v-if="open && portalReady" :to="teleportTo">
    <div
      class="loc-overlay"
      :class="framed ? 'is-framed' : 'is-viewport'"
      role="dialog"
      aria-modal="true"
      :aria-label="galleryLabel"
    >
      <header class="loc-head">
        <div class="loc-head__text">
          <p class="loc-kicker">展厅位置</p>
          <h3 class="loc-title">{{ galleryLabel }}</h3>
          <p v-if="subLabel" class="loc-sub">{{ subLabel }}</p>
        </div>
        <button type="button" class="loc-close" aria-label="关闭" @click="closeMap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div v-if="showMapTabs" class="loc-map-tabs" role="tablist" aria-label="地图切换">
        <button
          v-for="sheet in mapSheets"
          :key="sheet.id"
          type="button"
          role="tab"
          class="loc-map-tab"
          :class="{ 'is-active': activeSheet?.id === sheet.id }"
          :aria-selected="activeSheet?.id === sheet.id"
          @click="selectMap(sheet.id)"
        >
          {{ sheet.label || sheet.id }}
          <span v-if="sheet.points?.length" class="loc-map-tab__count">
            {{ sheet.points.length }}
          </span>
        </button>
      </div>

      <div class="loc-toolbar">
        <button type="button" class="loc-tool" :disabled="!canZoomOut" aria-label="缩小" @click="zoomByButton(-0.2)">−</button>
        <span class="loc-zoom">{{ zoomLabel }}</span>
        <button type="button" class="loc-tool" :disabled="!canZoomIn" aria-label="放大" @click="zoomByButton(0.2)">+</button>
        <button type="button" class="loc-tool loc-tool--text" @click="applyDefaultView">复位</button>
      </div>

      <div
        ref="viewport"
        class="loc-viewport"
        :class="{ 'is-panning': panning }"
        @wheel="handleWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="endPointer"
        @pointercancel="endPointer"
      >
        <div v-if="!hasImage" class="loc-empty">
          地图暂不可用
        </div>
        <div v-else ref="stage" class="loc-stage" :style="stageStyle">
          <img
            class="loc-image"
            :src="activeImageUrl"
            :alt="galleryLabel"
            draggable="false"
            @load="onImageLoad"
            @error="imageFailed = true"
            @dragstart.prevent
          />
          <div
            v-for="(point, index) in drawablePoints"
            :key="String(point.id || `${point.xPercent}-${point.yPercent}-${index}`)"
            class="loc-pin"
            :class="{ 'is-focus': focusPoint === point }"
            :style="{
              left: `${Number(point.xPercent) || 0}%`,
              top: `${Number(point.yPercent) || 0}%`,
            }"
            aria-hidden="true"
          >
            <span class="loc-pin__dot" />
            <span class="loc-pin__pulse" />
            <span v-if="String(point.title || '').trim()" class="loc-pin__label">
              {{ String(point.title || '').trim() }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="showPoints" class="loc-point-list" role="listbox" aria-label="点位列表">
        <button
          v-for="(point, index) in drawablePoints"
          :key="String(point.id || index)"
          type="button"
          role="option"
          class="loc-point-chip"
          :class="{ 'is-active': focusPoint === point }"
          :aria-selected="focusPoint === point"
          @click="selectPoint(String(point.id || ''))"
        >
          <span class="loc-point-chip__idx">{{ index + 1 }}</span>
          <span class="loc-point-chip__text">
            {{ String(point.title || '').trim() || `点位 ${index + 1}` }}
          </span>
        </button>
      </div>

      <p class="loc-hint">
        <template v-if="showPoints">点选点位居中 · </template>
        双指缩放 · 拖动平移 · 滚轮缩放
      </p>
    </div>
  </Teleport>
</template>

<style scoped>
.loc-overlay {
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  background: #0a0908;
  color: #f2ebe0;
  overscroll-behavior: none;
}

.loc-overlay.is-framed {
  position: absolute;
}

.loc-overlay.is-viewport {
  position: fixed;
  z-index: 1200;
}

.loc-head {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: max(0.85rem, env(safe-area-inset-top, 0px)) 0.95rem 0.7rem;
  border-bottom: 1px solid rgba(255, 248, 230, 0.08);
}

.loc-head__text {
  min-width: 0;
}

.loc-kicker {
  margin: 0;
  color: #d1b26f;
  font-size: 0.72rem;
  font-weight: 650;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.loc-title {
  margin: 0.22rem 0 0;
  font-size: 1.2rem;
  font-weight: 650;
  line-height: 1.3;
}

.loc-sub {
  margin: 0.28rem 0 0;
  color: rgba(242, 235, 224, 0.7);
  font-size: 0.92rem;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loc-close {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border: 1px solid rgba(255, 248, 230, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(242, 235, 224, 0.78);
  cursor: pointer;
}

.loc-close svg {
  width: 0.9rem;
  height: 0.9rem;
}

.loc-map-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 0.35rem;
  overflow-x: auto;
  padding: 0.45rem 0.75rem 0.2rem;
  border-bottom: 1px solid rgba(255, 248, 230, 0.06);
  scrollbar-width: none;
}

.loc-map-tabs::-webkit-scrollbar {
  display: none;
}

.loc-map-tab {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.3rem;
  margin: 0;
  border: 1px solid rgba(255, 248, 230, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  padding: 0.28rem 0.65rem;
  color: rgba(242, 235, 224, 0.7);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
}

.loc-map-tab.is-active {
  border-color: rgba(209, 178, 111, 0.45);
  background: rgba(209, 178, 111, 0.14);
  color: #f0e2bc;
}

.loc-map-tab__count {
  min-width: 1.1rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.28);
  padding: 0.05rem 0.28rem;
  color: rgba(242, 235, 224, 0.72);
  font-size: 0.6rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.loc-toolbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid rgba(255, 248, 230, 0.06);
}

.loc-tool {
  display: grid;
  place-items: center;
  width: 1.85rem;
  height: 1.85rem;
  border: 1px solid rgba(255, 248, 230, 0.12);
  border-radius: 0.45rem;
  background: rgba(255, 255, 255, 0.04);
  color: #f2ebe0;
  font: inherit;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}

.loc-tool:disabled {
  opacity: 0.35;
  cursor: default;
}

.loc-tool--text {
  width: auto;
  padding: 0 0.55rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.loc-zoom {
  min-width: 2.6rem;
  color: rgba(242, 235, 224, 0.7);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.loc-viewport {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  background: #050403;
  user-select: none;
  -webkit-user-select: none;
}

.loc-viewport.is-panning {
  cursor: grabbing;
}

.loc-empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: rgba(242, 235, 224, 0.55);
  font-size: 0.85rem;
}

.loc-stage {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  transform-origin: 0 0;
  will-change: transform;
}

.loc-image {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.loc-pin {
  position: absolute;
  z-index: 2;
  width: 0;
  height: 0;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.loc-pin.is-focus {
  z-index: 3;
}

.loc-pin__dot {
  position: absolute;
  top: 0;
  left: 0;
  width: 0.85rem;
  height: 0.85rem;
  border: 2px solid #fff4d2;
  border-radius: 999px;
  background: #c8923a;
  box-shadow:
    0 0 0 3px rgba(209, 178, 111, 0.28),
    0 6px 16px rgba(0, 0, 0, 0.45);
  transform: translate(-50%, -50%);
}

.loc-pin.is-focus .loc-pin__dot {
  background: #e0a84a;
  box-shadow:
    0 0 0 4px rgba(209, 178, 111, 0.38),
    0 6px 16px rgba(0, 0, 0, 0.45);
}

.loc-pin__pulse {
  position: absolute;
  top: 0;
  left: 0;
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 999px;
  border: 1.5px solid rgba(232, 201, 138, 0.65);
  transform: translate(-50%, -50%);
  animation: loc-pulse 1.6s ease-out infinite;
}

.loc-pin:not(.is-focus) .loc-pin__pulse {
  animation: none;
  opacity: 0.25;
}

.loc-pin__label {
  position: absolute;
  top: 0.85rem;
  left: 0;
  max-width: 9rem;
  padding: 0.22rem 0.45rem;
  border: 1px solid rgba(209, 178, 111, 0.35);
  border-radius: 0.45rem;
  background: rgba(12, 10, 8, 0.88);
  color: #f3d99d;
  font-size: 0.65rem;
  font-weight: 600;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: translateX(-50%);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
}

.loc-point-list {
  display: flex;
  flex-shrink: 0;
  gap: 0.35rem;
  overflow-x: auto;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid rgba(255, 248, 230, 0.06);
  background: rgba(0, 0, 0, 0.25);
  scrollbar-width: none;
}

.loc-point-list::-webkit-scrollbar {
  display: none;
}

.loc-point-chip {
  display: inline-flex;
  flex-shrink: 0;
  max-width: 10rem;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  border: 1px solid rgba(255, 248, 230, 0.1);
  border-radius: 0.65rem;
  background: rgba(255, 255, 255, 0.04);
  padding: 0.32rem 0.55rem 0.32rem 0.35rem;
  color: rgba(242, 235, 224, 0.78);
  font: inherit;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
}

.loc-point-chip.is-active {
  border-color: rgba(209, 178, 111, 0.48);
  background: rgba(209, 178, 111, 0.16);
  color: #f3e6c4;
}

.loc-point-chip__idx {
  display: grid;
  place-items: center;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 999px;
  background: rgba(209, 178, 111, 0.2);
  color: #efd391;
  font-size: 0.6rem;
  font-variant-numeric: tabular-nums;
}

.loc-point-chip__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loc-hint {
  flex-shrink: 0;
  margin: 0;
  padding: 0.45rem 0.75rem max(0.55rem, env(safe-area-inset-bottom, 0px));
  color: rgba(242, 235, 224, 0.42);
  font-size: 0.65rem;
  letter-spacing: 0.04em;
  text-align: center;
  border-top: 1px solid rgba(255, 248, 230, 0.06);
}

@keyframes loc-pulse {
  0% {
    opacity: 0.75;
    transform: translate(-50%, -50%) scale(0.55);
  }
  70% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.35);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.35);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loc-pin__pulse {
    animation: none;
    opacity: 0.35;
  }
}
</style>
