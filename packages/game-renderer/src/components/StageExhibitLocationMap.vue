<script setup lang="ts">
/**
 * 关卡定位：标题即入口（标题右侧定位 icon），点击打开手机尺寸全屏地图。
 * 打开时默认 1.5x，并居中到点位；弹层 Teleport 到 [data-stage-frame] 或 body。
 * 地图支持滚轮缩放、拖拽平移、双指 pinch。
 */
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue"
import type { StageExhibitLocationMap } from "../contracts"

const MIN_SCALE = 1
const MAX_SCALE = 4
/** 手机端默认放大，便于看清点位 */
const DEFAULT_SCALE = 1.5
const WHEEL_SENSITIVITY = 0.0015
const WHEEL_DELTA_CAP = 40

const props = withDefaults(
  defineProps<{
    location: StageExhibitLocationMap
    /** 展示为可点击标题 */
    title?: string | null
    /** 字号档：与各题面 .nr-title / .play-title 对齐 */
    size?: "narration" | "md" | "lg"
  }>(),
  {
    title: "",
    size: "md",
  },
)

const open = shallowRef(false)
const portalReady = shallowRef(false)
const framed = shallowRef(false)
const teleportTo = shallowRef<HTMLElement | string>("body")
const imageFailed = shallowRef(false)
const scale = shallowRef(DEFAULT_SCALE)
const offsetX = shallowRef(0)
const offsetY = shallowRef(0)
const panning = shallowRef(false)

const triggerRef = useTemplateRef<HTMLButtonElement>("trigger")
const viewportRef = useTemplateRef<HTMLElement>("viewport")
const stageRef = useTemplateRef<HTMLElement>("stage")

const displayTitle = computed(
  () =>
    String(props.title || props.location.exhibitName || props.location.pointTitle || "").trim()
    || "查看位置",
)
const galleryLabel = computed(
  () => String(props.location.galleryName || "").trim() || "展厅地图",
)
const pointLabel = computed(
  () =>
    String(props.location.pointTitle || props.location.exhibitName || "").trim()
    || "当前位置",
)
const pinStyle = computed(() => ({
  left: `${Number(props.location.xPercent) || 0}%`,
  top: `${Number(props.location.yPercent) || 0}%`,
}))
const stageStyle = computed(() => ({
  transform: `translate3d(${offsetX.value}px, ${offsetY.value}px, 0) scale(${scale.value})`,
}))
const zoomLabel = computed(() => `${Math.round(scale.value * 100)}%`)
const canZoomIn = computed(() => scale.value < MAX_SCALE - 1e-6)
const canZoomOut = computed(() => scale.value > MIN_SCALE + 1e-6)

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

/** 以点位为中心，落在视口中央（无有效尺寸时退化为地图几何中心） */
const centerView = () => {
  const viewport = viewportRef.value
  const stage = stageRef.value
  if (!viewport || !stage) return

  const vw = viewport.clientWidth
  const vh = viewport.clientHeight
  const sw = stage.offsetWidth
  const sh = stage.offsetHeight
  if (vw <= 0 || vh <= 0 || sw <= 0 || sh <= 0) return

  const xPct = Number(props.location.xPercent)
  const yPct = Number(props.location.yPercent)
  const hasPin = Number.isFinite(xPct) && Number.isFinite(yPct)
  const focusX = hasPin ? (xPct / 100) * sw : sw / 2
  const focusY = hasPin ? (yPct / 100) * sh : sh / 2
  const s = scale.value

  offsetX.value = vw / 2 - focusX * s
  offsetY.value = vh / 2 - focusY * s
}

/** 默认 1.5x + 点位居中 */
const applyDefaultView = async () => {
  clearGestures()
  scale.value = DEFAULT_SCALE
  offsetX.value = 0
  offsetY.value = 0
  await nextTick()
  centerView()
  // 布局偶发未稳定时再补一次
  requestAnimationFrame(() => centerView())
}

const resetView = () => {
  clearGestures()
  scale.value = DEFAULT_SCALE
  offsetX.value = 0
  offsetY.value = 0
}

const normalizeWheelDelta = (event: WheelEvent) => {
  let delta = event.deltaY
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16
  else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    delta *= viewportRef.value?.clientHeight || 400
  }
  return Math.max(-WHEEL_DELTA_CAP, Math.min(WHEEL_DELTA_CAP, delta))
}

/** 以视口坐标为焦点缩放，并保持焦点下地图点不跳 */
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
  if (imageFailed.value || !props.location.imageUrl) return
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
  if (imageFailed.value || !props.location.imageUrl) return
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

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && open.value) {
    event.stopPropagation()
    closeMap()
  }
}

const resolveTeleportTarget = () => {
  const trigger = triggerRef.value
  const frame = trigger?.closest?.("[data-stage-frame]")
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
  open.value = false
  portalReady.value = false
  resetView()
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", onKeydown, true)
  }
}

const openMap = async (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  resetView()
  open.value = true
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
  if (open.value) void applyDefaultView()
}

watch(
  () => props.location.imageUrl,
  () => {
    imageFailed.value = false
    closeMap()
  },
)

onBeforeUnmount(() => {
  if (typeof window === "undefined") return
  window.removeEventListener("keydown", onKeydown, true)
})
</script>

<template>
  <!-- 多根：可点标题 + 弹层 Teleport 到机框 / body -->
  <button
    ref="trigger"
    type="button"
    class="loc-title-trigger"
    :class="`is-${size}`"
    :title="`查看「${displayTitle}」展厅位置`"
    :aria-label="`查看「${displayTitle}」展厅位置`"
    @click="openMap"
  >
    <span class="loc-title-trigger__text">{{ displayTitle }}</span>
    <svg class="loc-title-trigger__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  </button>

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
        <p class="loc-sub">{{ pointLabel }}</p>
      </div>
      <button type="button" class="loc-close" aria-label="关闭" @click="closeMap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </header>

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
      <div v-if="imageFailed || !location.imageUrl" class="loc-empty">
        地图暂不可用
      </div>
      <div v-else ref="stage" class="loc-stage" :style="stageStyle">
        <img
          class="loc-image"
          :src="location.imageUrl"
          :alt="galleryLabel"
          draggable="false"
          @load="onImageLoad"
          @error="imageFailed = true"
          @dragstart.prevent
        />
        <div class="loc-pin" :style="pinStyle" aria-hidden="true">
          <span class="loc-pin__dot" />
          <span class="loc-pin__pulse" />
          <span class="loc-pin__label">{{ pointLabel }}</span>
        </div>
      </div>
    </div>

    <p class="loc-hint">双指缩放 · 拖动平移 · 滚轮缩放</p>
  </div>
  </Teleport>
</template>

<style scoped>
/* 标题即入口：标题左、定位 icon 右对齐 */
.loc-title-trigger {
  display: flex;
  width: 100%;
  max-width: 100%;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.loc-title-trigger__icon {
  flex-shrink: 0;
  width: 1em;
  height: 1em;
  margin-left: auto;
  color: #d1b26f;
  opacity: 0.95;
}

.loc-title-trigger__text {
  min-width: 0;
  flex: 1 1 auto;
  color: #f7efdd;
  line-height: 1.25;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
}

/* 对齐 .nr-title */
.loc-title-trigger.is-narration {
  font-size: 1.28rem;
  font-weight: 650;
}

/* 对齐 .play-title */
.loc-title-trigger.is-md {
  font-size: 1.5rem;
  font-weight: 600;
}

/* 对齐 .play-title.is-lg */
.loc-title-trigger.is-lg {
  font-size: 1.85rem;
  font-weight: 600;
  line-height: 1.15;
}

.loc-title-trigger:hover .loc-title-trigger__text {
  color: #efd391;
}

.loc-title-trigger:hover .loc-title-trigger__icon {
  color: #e8c98a;
}

.loc-title-trigger:active {
  opacity: 0.9;
}

/* 全屏弹层：机框内 absolute，H5 body 上 fixed */
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
  /* 压过 H5 壳层 FAB / 底栏，仍低于系统级 toast */
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
