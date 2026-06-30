<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { gsap } from "gsap"
import { Draggable } from "gsap/Draggable"
import AppIcon from "@/components/ui/AppIcon.vue"
import { MUSEUM_FLOOR_LAYOUTS, MUSEUM_WORLD_HEIGHT, MUSEUM_WORLD_WIDTH } from "@/mock/museumMap"
import { useMuseumMapViewport } from "@/composables/useMuseumMapViewport"
import { useChromeMetrics } from "@/composables/useChromeMetrics"
import type { MuseumFloorId, MuseumHallBlock } from "@/types/museumMap"

interface Props {
  activeFloorId?: MuseumFloorId
  selectedHallId?: string
  routeCount?: number
  completedCount?: number
}

interface PanBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface MutableDraggable {
  x: number
  y: number
  target: EventTarget
  update: (applyBounds?: boolean) => void
  applyBounds: (bounds: PanBounds) => void
  kill: () => void
}

const BASE_LAYOUT_WIDTH = 1600
const BASE_LAYOUT_HEIGHT = 920

const FLOOR_IMAGE_MAP: Partial<Record<MuseumFloorId, string>> = {
  "1F": "/static/map/1f.png",
  "2F": "/static/map/2f.png",
}

const props = withDefaults(defineProps<Props>(), {
  activeFloorId: "1F",
  selectedHallId: "",
  routeCount: 0,
  completedCount: 0,
})

const emit = defineEmits<{
  "update:activeFloorId": [floorId: MuseumFloorId]
  selectHall: [hallId: string]
}>()

const { metrics } = useChromeMetrics()
const panLayerRef = ref<unknown>(null)
const stageRef = ref<unknown>(null)
let draggableInstance: Draggable | null = null
let selectedMarkerTween: gsap.core.Tween | null = null
const draggableEnabled = ref(false)
const gsapRuntime = gsap as typeof gsap & {
  registerPlugin?: (...plugins: unknown[]) => void
}

const {
  offsetX,
  offsetY,
  scale,
  viewportWidth,
  viewportHeight,
  syncViewport,
  resetView,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  canTriggerTap,
} = useMuseumMapViewport({
  worldWidth: MUSEUM_WORLD_WIDTH,
  worldHeight: MUSEUM_WORLD_HEIGHT,
  minCoverRatio: 1.08,
  scaleBoost: 1.02,
})

gsapRuntime.registerPlugin?.(Draggable)

const activeFloor = computed(
  () => MUSEUM_FLOOR_LAYOUTS.find((item) => item.id === props.activeFloorId) || MUSEUM_FLOOR_LAYOUTS[0],
)

const selectedHall = computed<MuseumHallBlock | null>(() => {
  const hall = activeFloor.value.halls.find((item) => item.id === props.selectedHallId)
  return hall || activeFloor.value.halls[0] || null
})

const floorImageSrc = computed(() => FLOOR_IMAGE_MAP[activeFloor.value.id] || "")

const topRightStyle = computed(() => ({
  top: `${metrics.value.navHeight + 16}px`,
  right: "12rpx",
}))

const panStyle = computed(() => ({
  width: `${MUSEUM_WORLD_WIDTH}px`,
  height: `${MUSEUM_WORLD_HEIGHT}px`,
  transform: `translate3d(${offsetX.value}px, ${offsetY.value}px, 0)`,
}))

const stageStyle = computed(() => ({
  width: `${MUSEUM_WORLD_WIDTH}px`,
  height: `${MUSEUM_WORLD_HEIGHT}px`,
  transform: `scale(${scale.value})`,
}))

function resolveElement(target: unknown): HTMLElement | null {
  if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) {
    return target
  }

  const maybeRef = target as { $el?: unknown } | null
  if (typeof HTMLElement !== "undefined" && maybeRef?.$el instanceof HTMLElement) {
    return maybeRef.$el
  }

  return null
}

function getMarkerStyle(hall: MuseumHallBlock) {
  const isSelected = hall.id === selectedHall.value?.id
  const xScale = MUSEUM_WORLD_WIDTH / BASE_LAYOUT_WIDTH
  const yScale = MUSEUM_WORLD_HEIGHT / BASE_LAYOUT_HEIGHT
  const centerX = (hall.x + hall.width / 2) * xScale
  const centerY = (hall.y + hall.height / 2) * yScale

  return {
    left: `${centerX}px`,
    top: `${centerY}px`,
    "--marker-accent": isSelected ? "#f3d99d" : "#d1b26f",
    zIndex: isSelected ? 3 : 2,
  }
}

function getPanBounds(): PanBounds {
  const scaledWidth = MUSEUM_WORLD_WIDTH * scale.value
  const scaledHeight = MUSEUM_WORLD_HEIGHT * scale.value
  const freeX = viewportWidth.value - scaledWidth
  const freeY = viewportHeight.value - scaledHeight

  if (freeX >= 0 && freeY >= 0) {
    return {
      minX: freeX / 2,
      maxX: freeX / 2,
      minY: freeY / 2,
      maxY: freeY / 2,
    }
  }

  return {
    minX: Math.min(freeX, 0),
    maxX: Math.max(freeX, 0),
    minY: Math.min(freeY, 0),
    maxY: Math.max(freeY, 0),
  }
}

function syncDraggablePosition() {
  if (!draggableInstance) {
    return
  }

  const draggable = draggableInstance as unknown as MutableDraggable
  draggable.x = offsetX.value
  draggable.y = offsetY.value
  draggable.update()
}

function applyDraggableBounds() {
  if (!draggableInstance) {
    return
  }

  const draggable = draggableInstance as unknown as MutableDraggable
  draggable.applyBounds(getPanBounds())
  draggable.update(true)
}

function teardownDraggable() {
  draggableInstance?.kill()
  draggableInstance = null
  draggableEnabled.value = false
}

async function setupDraggable() {
  teardownDraggable()

  const panEl = resolveElement(panLayerRef.value)
  if (!panEl || typeof window === "undefined") {
    return
  }

  draggableInstance = Draggable.create(panEl, {
    type: "x,y",
    edgeResistance: 0.9,
    dragResistance: 0.08,
    minimumMovement: 3,
    allowNativeTouchScrolling: false,
    onDrag() {
      offsetX.value = this.x
      offsetY.value = this.y
    },
    onThrowUpdate() {
      offsetX.value = this.x
      offsetY.value = this.y
    },
    onDragEnd() {
      playSelectedMarkerGlow()
    },
  })[0] || null

  if (!draggableInstance) {
    return
  }

  draggableEnabled.value = true
  syncDraggablePosition()
  applyDraggableBounds()
}

function playSelectedMarkerGlow() {
  selectedMarkerTween?.kill()

  const stageEl = resolveElement(stageRef.value)
  if (!stageEl || typeof window === "undefined") {
    return
  }

  const markerEl = stageEl.querySelector<HTMLElement>(".hall-marker.is-selected .marker-pin")
  if (!markerEl) {
    return
  }

  selectedMarkerTween = gsap.to(markerEl, {
    scale: 1.08,
    y: -3,
    duration: 0.9,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
    transformOrigin: "50% 100%",
  })
}

function handleViewportTouchStart(event: TouchEvent) {
  if (draggableEnabled.value && event.touches.length < 2) {
    return
  }

  handleTouchStart(event)
}

function handleViewportTouchMove(event: TouchEvent) {
  if (draggableEnabled.value && event.touches.length < 2) {
    return
  }

  handleTouchMove(event)
}

function handleViewportTouchEnd() {
  if (draggableEnabled.value) {
    return
  }

  handleTouchEnd()
}

function selectHall(hallId: string) {
  if (draggableEnabled.value && Draggable.timeSinceDrag() < 0.12) {
    return
  }

  if (!draggableEnabled.value && !canTriggerTap()) {
    return
  }

  emit("selectHall", hallId)
}

async function switchFloor(floorId: MuseumFloorId) {
  if (floorId === props.activeFloorId) {
    return
  }

  emit("update:activeFloorId", floorId)
  await nextTick()
  await syncViewport()
  resetView()
  syncDraggablePosition()
  applyDraggableBounds()
}

watch(
  () => props.activeFloorId,
  async () => {
    await nextTick()
    await syncViewport()
    resetView()
    syncDraggablePosition()
    applyDraggableBounds()
    playSelectedMarkerGlow()
  },
)

watch(
  () => props.selectedHallId,
  async () => {
    await nextTick()
    playSelectedMarkerGlow()
  },
)

watch(scale, () => {
  applyDraggableBounds()
  syncDraggablePosition()
})

onMounted(async () => {
  await nextTick()
  await syncViewport()
  await nextTick()
  await setupDraggable()
  playSelectedMarkerGlow()
})

onUnmounted(() => {
  teardownDraggable()
  selectedMarkerTween?.kill()
})
</script>

<template>
  <view class="museum-map-shell">
    <view
      class="museum-map-viewport"
      @touchstart.stop="handleViewportTouchStart($event)"
      @touchmove.stop.prevent="handleViewportTouchMove($event)"
      @touchend.stop="handleViewportTouchEnd"
      @touchcancel.stop="handleViewportTouchEnd">
      <view ref="panLayerRef" class="museum-map-pan" :style="panStyle">
        <view ref="stageRef" class="museum-map-stage" :style="stageStyle">
          <image
            v-if="floorImageSrc"
            class="floor-map-image"
            :src="floorImageSrc"
            mode="aspectFill" />

          <view v-else class="floor-map-fallback">
            <view class="fallback-glow"></view>
            <view class="fallback-grid"></view>
          </view>

          <button
            v-for="hall in activeFloor.halls"
            :key="hall.id"
            class="hall-marker"
            :class="{ 'is-selected': selectedHall?.id === hall.id }"
            :style="getMarkerStyle(hall)"
            @click="selectHall(hall.id)">
            <view class="marker-pin">
              <AppIcon name="marker" :size="72" class-name="marker-icon" />
            </view>
            <view class="marker-copy">
              <text class="marker-name">{{ hall.label }}</text>
            </view>
          </button>
        </view>
      </view>
    </view>

    <view class="map-floating-layer" :style="topRightStyle">
      <button
        v-for="floor in MUSEUM_FLOOR_LAYOUTS"
        :key="floor.id"
        class="floor-pill"
        :class="{ 'is-active': floor.id === props.activeFloorId }"
        @click="switchFloor(floor.id)">
        {{ floor.label }}
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.museum-map-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
  margin-left: -20rpx;
  margin-right: -20rpx;
  overflow: hidden;
}

.museum-map-viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 14%, rgba(255, 241, 203, 0.16), transparent 28%),
    radial-gradient(circle at 18% 88%, rgba(112, 136, 138, 0.18), transparent 28%),
    linear-gradient(180deg, rgba(14, 15, 18, 0.98), rgba(6, 7, 10, 1));
}

.museum-map-pan {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: left top;
  will-change: transform;
}

.museum-map-stage {
  position: relative;
  transform-origin: left top;
  will-change: transform;
}

.floor-map-image,
.floor-map-fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.floor-map-image {
  opacity: 0.95;
  filter:
    saturate(1.03)
    contrast(1.02)
    drop-shadow(0 18px 48px rgba(0, 0, 0, 0.22));
}

.floor-map-fallback {
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 38%, rgba(209, 178, 111, 0.12), transparent 300px),
    linear-gradient(180deg, rgba(24, 26, 30, 0.92), rgba(8, 9, 12, 0.98));
}

.fallback-glow,
.fallback-grid {
  position: absolute;
  inset: 0;
}

.fallback-glow {
  background:
    radial-gradient(circle at 32% 24%, rgba(112, 136, 138, 0.16), transparent 24%),
    radial-gradient(circle at 72% 72%, rgba(209, 178, 111, 0.12), transparent 26%);
}

.fallback-grid {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 68px 68px;
  mask-image: radial-gradient(circle at center, #000 0, rgba(0, 0, 0, 0.72) 54%, transparent 80%);
}

.hall-marker {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  min-width: 220rpx;
  padding: 0;
  background: transparent !important;
  border: 0;
  color: #fff8ea;
  transform: translate(-50%, -100%);
  text-align: center;
}

.hall-marker::after {
  border: 0;
}

.marker-pin {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 132rpx;
  height: 132rpx;
  color: #f3d99d;
  filter:
    drop-shadow(0 0 16px rgba(209, 178, 111, 0.92))
    drop-shadow(0 0 30px rgba(209, 178, 111, 0.7))
    drop-shadow(0 14px 24px rgba(0, 0, 0, 0.26));
}

.marker-pin::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 4rpx;
  width: 58rpx;
  height: 26rpx;
  border-radius: 999px;
  background: var(--marker-accent);
  transform: translateX(-50%);
  filter: blur(16px);
  opacity: 0.82;
}

.marker-icon {
  position: relative;
  z-index: 1;
  filter: brightness(1.04);
}

.marker-copy {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 64rpx;
  padding: 12rpx 24rpx;
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgba(209, 178, 111, 0.24), rgba(8, 9, 12, 0.88)),
    rgba(8, 9, 12, 0.8);
  box-shadow:
    0 10px 28px rgba(0, 0, 0, 0.22),
    0 0 18px rgba(209, 178, 111, 0.16),
    inset 0 0 0 1px rgba(243, 217, 157, 0.18);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.marker-name {
  color: #fff5dc;
  font-size: 24rpx;
  line-height: 1.1;
  font-weight: 900;
  white-space: nowrap;
  letter-spacing: 0.02em;
}

.hall-marker.is-selected .marker-copy {
  background:
    linear-gradient(135deg, rgba(243, 217, 157, 0.32), rgba(8, 9, 12, 0.84)),
    rgba(8, 9, 12, 0.8);
  box-shadow:
    0 14px 34px rgba(0, 0, 0, 0.24),
    0 0 28px rgba(243, 217, 157, 0.24),
    inset 0 0 0 1px rgba(255, 248, 234, 0.24);
}

.hall-marker.is-selected .marker-name {
  color: #fffdf6;
}

.map-floating-layer {
  position: absolute;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  align-items: center;
}

.floor-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100rpx;
  min-height: 54rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  backdrop-filter: blur(18rpx);
  -webkit-backdrop-filter: blur(18rpx);
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 0.04em;
  border: 0;
  background: rgba(7, 8, 10, 0.48) !important;
  color: rgba(247, 239, 221, 0.62);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.3);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.floor-pill.is-active {
  background: rgba(209, 178, 111, 0.22) !important;
  color: #fff8ea;
  transform: scale(1.04);
}

@media (max-width: 420px) {
  .hall-marker {
    min-width: 192rpx;
  }

  .marker-name {
    font-size: 22rpx;
  }
}
</style>
