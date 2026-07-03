<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { gsap } from 'gsap'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useMuseumMapViewport } from '@/composables/useMuseumMapViewport'
import { useChromeMetrics } from '@/composables/useChromeMetrics'
import type { MuseumFloorId, MuseumFloorLayout, MuseumHallBlock } from '@/types/museumMap'

interface Props {
  floors: MuseumFloorLayout[]
  activeFloorId?: MuseumFloorId
  selectedHallId?: string
  routeCount?: number
  completedCount?: number
  pending?: boolean
  errorMessage?: string
}

interface PanBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

const DEFAULT_WORLD_WIDTH = 320
const DEFAULT_WORLD_HEIGHT = 640
const EDGE_REVEAL_X = 112
const EDGE_REVEAL_TOP = 132
const EDGE_REVEAL_BOTTOM = 156
const VIRTUAL_VIEWPORT_MULTIPLIER = 2

const props = withDefaults(defineProps<Props>(), {
  activeFloorId: '',
  selectedHallId: '',
  routeCount: 0,
  completedCount: 0,
  pending: false,
  errorMessage: '',
})

const emit = defineEmits<{
  'update:activeFloorId': [floorId: MuseumFloorId]
  selectHall: [hallId: string]
}>()

const { metrics } = useChromeMetrics()
const panLayerRef = ref<unknown>(null)
const worldMetrics = reactive({
  worldWidth: DEFAULT_WORLD_WIDTH,
  worldHeight: DEFAULT_WORLD_HEIGHT,
  initialScaleMode: 'contain' as const,
  minScaleMode: 'contain' as const,
  scaleBoost: 1,
})
let selectedMarkerTween: gsap.core.Tween | null = null

const scaledWorldWidth = computed(() => worldMetrics.worldWidth * scale.value)
const scaledWorldHeight = computed(() => worldMetrics.worldHeight * scale.value)

function getPanBounds(): PanBounds {
  const scaledWidth = scaledWorldWidth.value
  const scaledHeight = scaledWorldHeight.value
  const freeX = viewportWidth.value - scaledWidth
  const freeY = viewportHeight.value - scaledHeight
  const extraViewportX = (viewportWidth.value * (VIRTUAL_VIEWPORT_MULTIPLIER - 1)) / 2
  const extraViewportY = (viewportHeight.value * (VIRTUAL_VIEWPORT_MULTIPLIER - 1)) / 2

  if (freeX >= 0 && freeY >= 0) {
    const centeredX = freeX / 2
    const centeredY = freeY / 2

    return {
      minX: centeredX - extraViewportX,
      maxX: centeredX + extraViewportX,
      minY: centeredY - extraViewportY,
      maxY: centeredY + extraViewportY,
    }
  }

  return {
    minX: freeX >= 0 ? (freeX / 2) - extraViewportX : freeX - EDGE_REVEAL_X - extraViewportX,
    maxX: freeX >= 0 ? (freeX / 2) + extraViewportX : EDGE_REVEAL_X + extraViewportX,
    minY: freeY >= 0 ? (freeY / 2) - extraViewportY : freeY - EDGE_REVEAL_BOTTOM - extraViewportY,
    maxY: freeY >= 0 ? (freeY / 2) + extraViewportY : EDGE_REVEAL_TOP + extraViewportY,
  }
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
  clampOffset,
  canTriggerTap,
} = useMuseumMapViewport({
  get worldWidth() {
    return worldMetrics.worldWidth
  },
  get worldHeight() {
    return worldMetrics.worldHeight
  },
  get initialScaleMode() {
    return worldMetrics.initialScaleMode
  },
  get minScaleMode() {
    return worldMetrics.minScaleMode
  },
  get scaleBoost() {
    return worldMetrics.scaleBoost
  },
  resolveBounds: getPanBounds,
})

const activeFloor = computed(
  () => props.floors.find((item) => item.id === props.activeFloorId) ?? props.floors[0] ?? null,
)

const selectedHall = computed<MuseumHallBlock | null>(() => {
  const floor = activeFloor.value
  if (!floor) {
    return null
  }

  const hall = floor.halls.find((item) => item.id === props.selectedHallId)
  return hall ?? floor.halls[0] ?? null
})

const floorImageSrc = computed(() => activeFloor.value?.mapImageUrl || '')
const floorSummary = computed(() => {
  if (props.pending) {
    return '正在同步地图数据...'
  }

  if (props.errorMessage) {
    return props.errorMessage
  }

  if (!activeFloor.value) {
    return '当前还没有可展示的楼层地图。'
  }

  return activeFloor.value.summary
})

const topRightStyle = computed(() => ({
  top: `${metrics.value.navHeight + 16}px`,
  right: 'calc(44rpx + env(safe-area-inset-right))',
}))

const panStyle = computed(() => ({
  width: `${scaledWorldWidth.value}px`,
  height: `${scaledWorldHeight.value}px`,
  transform: `translate3d(${offsetX.value}px, ${offsetY.value}px, 0)`,
}))

const worldStyle = computed(() => ({
  width: `${worldMetrics.worldWidth}px`,
  height: `${worldMetrics.worldHeight}px`,
  transform: `scale(${scale.value})`,
}))

function resolveElement(target: unknown): HTMLElement | null {
  if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement) {
    return target
  }

  const maybeRef = target as { $el?: unknown } | null
  if (typeof HTMLElement !== 'undefined' && maybeRef?.$el instanceof HTMLElement) {
    return maybeRef.$el
  }

  return null
}

function syncWorldMetrics() {
  const floor = activeFloor.value
  worldMetrics.worldWidth = floor?.worldWidth || DEFAULT_WORLD_WIDTH
  worldMetrics.worldHeight = floor?.worldHeight || DEFAULT_WORLD_HEIGHT
}

function getMarkerStyle(hall: MuseumHallBlock) {
  const isSelected = hall.id === selectedHall.value?.id

  return {
    left: `${hall.x}px`,
    top: `${hall.y}px`,
    '--marker-accent': isSelected ? '#f3d99d' : (hall.accent || '#d1b26f'),
    zIndex: isSelected ? 3 : 2,
  }
}

function playSelectedMarkerGlow() {
  selectedMarkerTween?.kill()

  const panEl = resolveElement(panLayerRef.value)
  if (!panEl || typeof window === 'undefined') {
    return
  }

  const markerEl = panEl.querySelector<HTMLElement>('.hall-marker.is-selected .marker-pin')
  if (!markerEl) {
    return
  }

  selectedMarkerTween = gsap.to(markerEl, {
    scale: 1.06,
    y: -3,
    duration: 0.9,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true,
    transformOrigin: '50% 100%',
  })
}

function handleViewportTouchStart(event: TouchEvent) {
  handleTouchStart(event)
}

function handleViewportTouchMove(event: TouchEvent) {
  handleTouchMove(event)
}

function handleViewportTouchEnd(event: TouchEvent) {
  handleTouchEnd(event)
}

function selectHall(hallId: string) {
  if (!canTriggerTap()) {
    return
  }

  emit('selectHall', hallId)
}

async function switchFloor(floorId: MuseumFloorId) {
  if (floorId === props.activeFloorId) {
    return
  }

  emit('update:activeFloorId', floorId)
  await nextTick()
  syncWorldMetrics()
  await syncViewport()
  resetView()
  clampOffset()
}

watch(
  activeFloor,
  async () => {
    syncWorldMetrics()
    await nextTick()
    await syncViewport()
    resetView()
    clampOffset()
    playSelectedMarkerGlow()
  },
  { immediate: true },
)

watch(
  () => props.selectedHallId,
  async () => {
    await nextTick()
    playSelectedMarkerGlow()
  },
)

watch(scale, () => {
  clampOffset()
})

onMounted(async () => {
  syncWorldMetrics()
  await nextTick()
  await syncViewport()
  playSelectedMarkerGlow()
})

onUnmounted(() => {
  selectedMarkerTween?.kill()
})
</script>

<template>
  <view class="museum-map-shell">
    <view
      class="museum-map-viewport"
      @touchstart.stop="handleViewportTouchStart($event)"
      @touchmove.stop.prevent="handleViewportTouchMove($event)"
      @touchend.stop="handleViewportTouchEnd($event)"
      @touchcancel.stop="handleViewportTouchEnd($event)">
      <view class="museum-map-grid-layer"></view>
      <view ref="panLayerRef" class="museum-map-pan" :style="panStyle">
        <view class="museum-map-world" :style="worldStyle">
          <view class="museum-map-stage">
            <image
              v-if="floorImageSrc"
              class="floor-map-image"
              :src="floorImageSrc"
              mode="aspectFill" />

            <view v-else class="floor-map-fallback">
              <view class="fallback-glow"></view>
              <view class="fallback-grid"></view>
            </view>
          </view>

          <view class="museum-map-marker-layer">
            <button
              v-for="hall in activeFloor?.halls || []"
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

      <view v-if="props.pending || props.errorMessage || !activeFloor" class="map-state-card">
        <text class="map-state-eyebrow">
          {{ props.pending ? '地图同步中' : props.errorMessage ? '地图加载失败' : '暂无地图' }}
        </text>
        <text class="map-state-copy">{{ floorSummary }}</text>
      </view>
    </view>

    <view class="map-floating-layer" :style="topRightStyle">
      <button
        v-for="floor in props.floors"
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

.museum-map-grid-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.42;
  background-image:
    linear-gradient(rgba(243, 217, 157, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(243, 217, 157, 0.06) 1px, transparent 1px),
    linear-gradient(rgba(243, 217, 157, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(243, 217, 157, 0.1) 1px, transparent 1px);
  background-size:
    40rpx 40rpx,
    40rpx 40rpx,
    160rpx 160rpx,
    160rpx 160rpx;
}

.museum-map-pan {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  transform-origin: left top;
  will-change: transform;
}

.museum-map-world {
  position: relative;
  transform-origin: left top;
  will-change: transform;
}

.museum-map-stage {
  position: absolute;
  inset: 0;
}

.museum-map-marker-layer {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
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
  width: auto;
  min-width: 0;
  max-width: none;
  padding: 0;
  background: transparent !important;
  border: 0;
  color: #fff8ea;
  transform: translate3d(-50%, -100%, 0);
  text-align: center;
  pointer-events: auto;
  backface-visibility: hidden;
}

.hall-marker::after {
  border: 0;
}

.marker-pin {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 168rpx;
  height: 168rpx;
  color: #f3d99d;
  filter:
    drop-shadow(0 0 16px rgba(209, 178, 111, 0.92))
    drop-shadow(0 0 30px rgba(209, 178, 111, 0.7))
    drop-shadow(0 14px 24px rgba(0, 0, 0, 0.26));
  will-change: transform;
}

.marker-pin::before {
  content: '';
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
  display: inline-flex;
  width: auto;
  max-width: none;
  align-items: center;
  justify-content: center;
  min-height: 76rpx;
  padding: 14rpx 28rpx;
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
  font-size: 28rpx;
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
  gap: 10rpx;
  align-items: flex-end;
  max-width: calc(100vw - 120rpx);
}

.map-state-card {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  z-index: 8;
  border-radius: 28rpx;
  backdrop-filter: blur(16rpx);
  -webkit-backdrop-filter: blur(16rpx);
}

.map-state-card {
  bottom: calc(132rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 24rpx;
  background: rgba(8, 10, 14, 0.74);
  box-shadow: 0 14rpx 40rpx rgba(0, 0, 0, 0.28);
}

.map-state-eyebrow {
  color: #f3d99d;
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.map-state-copy {
  color: rgba(247, 239, 221, 0.74);
  font-size: 22rpx;
  line-height: 1.6;
}

.floor-pill {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: auto;
  max-width: 100%;
  min-height: 58rpx;
  margin: 0;
  box-sizing: border-box;
  padding: 0 24rpx;
  border-radius: 999rpx;
  backdrop-filter: blur(18rpx);
  -webkit-backdrop-filter: blur(18rpx);
  font-size: 20rpx;
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: visible;
  border: 0;
  background: rgba(7, 8, 10, 0.56) !important;
  color: rgba(247, 239, 221, 0.68);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.3);
  transition:
    background 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
}

.floor-pill.is-active {
  background:
    linear-gradient(135deg, rgba(209, 178, 111, 0.38), rgba(39, 32, 18, 0.92)) !important;
  color: #fff8ea;
  transform: translateX(-4rpx);
}

@media (max-width: 420px) {
  .marker-name {
    font-size: 24rpx;
  }
}
</style>
