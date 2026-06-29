<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, shallowRef } from "vue"
import type { MissionRouteCard } from "@/types/mission"

interface Props {
  routes: MissionRouteCard[]
  activeRouteId?: string | null
  completedRouteIds?: string[]
}

interface DragBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface StageSpot {
  x: number
  y: number
  zone: string
  landmark: string
  shortLabel: string
}

const props = withDefaults(defineProps<Props>(), {
  activeRouteId: "",
  completedRouteIds: () => [],
})

const emit = defineEmits<{
  open: [routeId: string]
}>()

const offsetX = shallowRef(0)
const offsetY = shallowRef(0)
const dragBounds = shallowRef<DragBounds>({
  minX: 0,
  maxX: 0,
  minY: 0,
  maxY: 0,
})

const dragState = {
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
}

const dragMoved = shallowRef(false)
const lastDragAt = shallowRef(0)
const instance = getCurrentInstance()

const ROUTE_SPOTS: Record<string, StageSpot> = {
  "route-dragon": {
    x: 246,
    y: 244,
    zone: "A馆 · 龙纹厅",
    landmark: "东馆主展厅",
    shortLabel: "A1",
  },
  "route-scroll": {
    x: 652,
    y: 190,
    zone: "B馆 · 长卷厅",
    landmark: "西馆画卷展区",
    shortLabel: "B2",
  },
  "route-timeline": {
    x: 520,
    y: 516,
    zone: "C馆 · 编年展厅",
    landmark: "北馆时间轴廊",
    shortLabel: "C3",
  },
}

function clamp(value: number, min: number, max: number) {
  if (min > max) {
    return value
  }

  return Math.min(Math.max(value, min), max)
}

function readRect(selector: string) {
  return new Promise<UniApp.NodeInfo>((resolve) => {
    uni
      .createSelectorQuery()
      .in(instance?.proxy)
      .select(selector)
      .boundingClientRect((rect) => {
        resolve((rect || {}) as UniApp.NodeInfo)
      })
      .exec()
  })
}

async function syncBounds(preserve = false) {
  const [viewport, stage] = await Promise.all([readRect(".museum-viewport"), readRect(".museum-stage")])

  if (!viewport.width || !viewport.height || !stage.width || !stage.height) {
    return
  }

  const viewportWidth = viewport.width
  const viewportHeight = viewport.height
  const stageWidth = stage.width
  const stageHeight = stage.height

  const nextBounds = {
    minX: Math.min(0, viewportWidth - stageWidth),
    maxX: 0,
    minY: Math.min(0, viewportHeight - stageHeight),
    maxY: 0,
  }

  dragBounds.value = nextBounds

  if (preserve) {
    offsetX.value = clamp(offsetX.value, nextBounds.minX, nextBounds.maxX)
    offsetY.value = clamp(offsetY.value, nextBounds.minY, nextBounds.maxY)
    return
  }

  offsetX.value = clamp((viewportWidth - stageWidth) / 2, nextBounds.minX, nextBounds.maxX)
  offsetY.value = clamp((viewportHeight - stageHeight) / 2, nextBounds.minY, nextBounds.maxY)
}

function readTouchPoint(event: TouchEvent) {
  const point = event.touches[0] || event.changedTouches[0]

  return {
    x: point?.clientX || 0,
    y: point?.clientY || 0,
  }
}

function handleTouchStart(event: TouchEvent) {
  const point = readTouchPoint(event)
  dragState.startX = point.x
  dragState.startY = point.y
  dragState.originX = offsetX.value
  dragState.originY = offsetY.value
  dragMoved.value = false
}

function handleTouchMove(event: TouchEvent) {
  const point = readTouchPoint(event)
  const deltaX = point.x - dragState.startX
  const deltaY = point.y - dragState.startY

  if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
    dragMoved.value = true
  }

  offsetX.value = clamp(dragState.originX + deltaX, dragBounds.value.minX, dragBounds.value.maxX)
  offsetY.value = clamp(dragState.originY + deltaY, dragBounds.value.minY, dragBounds.value.maxY)
}

function handleTouchEnd() {
  if (dragMoved.value) {
    lastDragAt.value = Date.now()
  }
}

function handleHotspotClick(routeId: string) {
  if (Date.now() - lastDragAt.value < 180) {
    return
  }

  emit("open", routeId)
}

const hotspots = computed(() =>
  props.routes.map((route) => {
    const spot = ROUTE_SPOTS[route.id] || {
      x: 480,
      y: 360,
      zone: "探索区",
      landmark: route.startLocation,
      shortLabel: "·",
    }

    return {
      ...route,
      ...spot,
      isActive: props.activeRouteId === route.id,
      isCompleted: props.completedRouteIds.includes(route.id),
    }
  }),
)

onMounted(async () => {
  await nextTick()
  await syncBounds(false)
})

onUnmounted(() => {
  dragMoved.value = false
})
</script>

<template>
  <view class="museum-map">
    <view class="museum-head">
      <text class="museum-title">总馆地图</text>
      <text class="museum-drag">拖动查看</text>
    </view>

    <view
      class="museum-viewport"
      @touchstart.stop="handleTouchStart($event)"
      @touchmove.stop.prevent="handleTouchMove($event)"
      @touchend.stop="handleTouchEnd"
      @touchcancel.stop="handleTouchEnd"
    >
      <view class="museum-stage" :style="{ transform: `translate(${offsetX}px, ${offsetY}px)` }">
        <view class="museum-zone zone-a">
          <text class="zone-mark">A</text>
          <text class="zone-name">东馆龙纹厅</text>
        </view>

        <view class="museum-zone zone-b">
          <text class="zone-mark">B</text>
          <text class="zone-name">西馆长卷厅</text>
        </view>

        <view class="museum-zone zone-c">
          <text class="zone-mark">C</text>
          <text class="zone-name">北馆编年厅</text>
        </view>

        <view class="museum-axis horizontal"></view>
        <view class="museum-axis vertical"></view>

        <button
          v-for="route in hotspots"
          :key="route.id"
          class="mission-hotspot"
          :class="{ 'is-active': route.isActive, 'is-completed': route.isCompleted }"
          :style="{ left: `${route.x}rpx`, top: `${route.y}rpx` }"
          @click="handleHotspotClick(route.id)"
        >
          <view class="hotspot-pin">{{ route.shortLabel }}</view>
          <view class="hotspot-copy">
            <text class="hotspot-zone">{{ route.zone }}</text>
            <text class="hotspot-title">{{ route.title }}</text>
            <text class="hotspot-meta">{{ route.landmark }}</text>
          </view>
        </button>
      </view>
    </view>

    <view class="legend-row">
      <view class="legend-item">
        <view class="legend-dot"></view>
        <text>可进</text>
      </view>
      <view class="legend-item">
        <view class="legend-dot active"></view>
        <text>进行中</text>
      </view>
      <view class="legend-item">
        <view class="legend-dot done"></view>
        <text>已完成</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.museum-map {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.museum-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.museum-title {
  color: #fff8ea;
  font-size: 30rpx;
  font-weight: 900;
}

.museum-drag {
  display: inline-flex;
  align-items: center;
  min-height: 42rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(247, 239, 221, 0.58);
  font-size: 20rpx;
  font-weight: 800;
}

.museum-viewport {
  position: relative;
  min-height: 720rpx;
  overflow: hidden;
  border: 1px solid rgba(209, 178, 111, 0.24);
  border-radius: 40rpx;
  background:
    radial-gradient(circle at 18% 14%, rgba(209, 178, 111, 0.16), transparent 24%),
    radial-gradient(circle at 84% 78%, rgba(243, 217, 157, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(35, 33, 29, 0.98), rgba(13, 15, 19, 0.98));
}

.museum-stage {
  position: absolute;
  left: 0;
  top: 0;
  width: 980rpx;
  height: 820rpx;
  transform-origin: top left;
}

.museum-zone {
  position: absolute;
  padding: 24rpx;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.035);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

.zone-a {
  left: 52rpx;
  top: 62rpx;
  width: 348rpx;
  min-height: 248rpx;
}

.zone-b {
  left: 598rpx;
  top: 106rpx;
  width: 316rpx;
  min-height: 240rpx;
}

.zone-c {
  left: 282rpx;
  top: 452rpx;
  width: 420rpx;
  min-height: 246rpx;
}

.zone-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 48rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.16);
  color: #f3d99d;
  font-size: 24rpx;
  font-weight: 900;
}

.zone-name {
  display: block;
  margin-top: 16rpx;
  color: rgba(247, 239, 221, 0.88);
  font-size: 28rpx;
  font-weight: 900;
}

.museum-axis {
  position: absolute;
  border-radius: 999rpx;
  background: linear-gradient(90deg, rgba(209, 178, 111, 0.08), rgba(209, 178, 111, 0.28), rgba(209, 178, 111, 0.08));
}

.museum-axis.horizontal {
  left: 174rpx;
  right: 148rpx;
  top: 398rpx;
  height: 6rpx;
}

.museum-axis.vertical {
  top: 292rpx;
  bottom: 176rpx;
  left: 520rpx;
  width: 6rpx;
  background: linear-gradient(180deg, rgba(209, 178, 111, 0.08), rgba(209, 178, 111, 0.28), rgba(209, 178, 111, 0.08));
}

.mission-hotspot {
  position: absolute;
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  width: 318rpx;
  padding: 0 !important;
  border: 0;
  background: transparent !important;
  background-color: transparent !important;
  text-align: left;
  transform: translate(-8%, -50%);
}

.mission-hotspot::after {
  border: 0;
}

.hotspot-pin {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #d1b26f, #f3d99d);
  color: #171310;
  font-size: 22rpx;
  font-weight: 900;
  box-shadow: 0 0 0 12rpx rgba(209, 178, 111, 0.12);
}

.hotspot-copy {
  min-width: 0;
  padding: 16rpx 18rpx;
  border-radius: 26rpx;
  background: rgba(15, 17, 21, 0.92);
  box-shadow: 0 12rpx 30rpx rgba(0, 0, 0, 0.24);
}

.hotspot-zone {
  display: block;
  color: #d1b26f;
  font-size: 20rpx;
  font-weight: 900;
}

.hotspot-title {
  display: block;
  margin-top: 8rpx;
  color: #fff8ea;
  font-size: 26rpx;
  line-height: 1.24;
  font-weight: 900;
}

.hotspot-meta {
  display: block;
  margin-top: 8rpx;
  color: rgba(247, 239, 221, 0.5);
  font-size: 20rpx;
  line-height: 1.34;
}

.mission-hotspot.is-active .hotspot-copy {
  border: 1px solid rgba(243, 217, 157, 0.36);
  background: rgba(54, 43, 24, 0.94);
}

.mission-hotspot.is-completed .hotspot-pin {
  background: linear-gradient(135deg, #f3d99d, #fff8ea);
}

.legend-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  min-height: 48rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.035);
  color: rgba(247, 239, 221, 0.68);
  font-size: 20rpx;
  font-weight: 800;
}

.legend-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 999rpx;
  background: #d1b26f;
}

.legend-dot.active {
  background: #fff8ea;
}

.legend-dot.done {
  background: #9fd8af;
}
</style>
