<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { MUSEUM_FLOOR_LAYOUTS, MUSEUM_WORLD_HEIGHT, MUSEUM_WORLD_WIDTH } from "@/mock/museumMap"
import { useMuseumMapViewport } from "@/composables/useMuseumMapViewport"
import type { MuseumFloorId, MuseumHallBlock } from "@/types/museumMap"

interface Props {
  routeCount?: number
  completedCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  routeCount: 0,
  completedCount: 0,
})

const activeFloorId = shallowRef<MuseumFloorId>("1F")
const selectedHallId = shallowRef(MUSEUM_FLOOR_LAYOUTS[0]?.halls[0]?.id || "")

const { offsetX, offsetY, scale, syncViewport, resetView, handleTouchStart, handleTouchMove, handleTouchEnd, canTriggerTap } =
  useMuseumMapViewport({
    worldWidth: MUSEUM_WORLD_WIDTH,
    worldHeight: MUSEUM_WORLD_HEIGHT,
    scaleBoost: 1.06,
  })

const activeFloor = computed(
  () => MUSEUM_FLOOR_LAYOUTS.find((item) => item.id === activeFloorId.value) || MUSEUM_FLOOR_LAYOUTS[0],
)

const selectedHall = computed<MuseumHallBlock | null>(() => {
  const hall = activeFloor.value.halls.find((item) => item.id === selectedHallId.value)
  return hall || activeFloor.value.halls[0] || null
})

const stageStyle = computed(() => ({
  width: `${MUSEUM_WORLD_WIDTH}px`,
  height: `${MUSEUM_WORLD_HEIGHT}px`,
  transform: `translate3d(${offsetX.value}px, ${offsetY.value}px, 0) scale(${scale.value})`,
}))

const routeSummary = computed(() => `${props.routeCount} 条路线 / ${props.completedCount} 条已完成`)

function getHallStyle(hall: MuseumHallBlock) {
  const isSelected = selectedHall.value?.id === hall.id

  return {
    left: `${hall.x}px`,
    top: `${hall.y}px`,
    width: `${hall.width}px`,
    height: `${hall.height}px`,
    borderRadius: `${hall.radius || 28}px`,
    background: `linear-gradient(135deg, ${hall.accent}, rgba(255, 248, 234, 0.12))`,
    boxShadow: isSelected ? `0 0 0 2px rgba(255, 248, 234, 0.36), 0 18px 48px ${hall.accent}55` : `0 10px 34px ${hall.accent}33`,
  }
}

function selectHall(hallId: string) {
  if (!canTriggerTap()) {
    return
  }

  selectedHallId.value = hallId
}

async function switchFloor(floorId: MuseumFloorId) {
  if (floorId === activeFloorId.value) {
    return
  }

  activeFloorId.value = floorId
  await syncViewport(true)
  resetView()
}

async function recenterMap() {
  await syncViewport(true)
  resetView()
}

watch(
  activeFloorId,
  () => {
    selectedHallId.value = activeFloor.value.halls[0]?.id || ""
  },
  { immediate: true },
)
</script>

<template>
  <view class="museum-map-shell">
    <view class="map-floating top-left panel-soft">
      <text class="floating-kicker">{{ activeFloor.label }}结构</text>
      <text class="floating-title">{{ activeFloor.axisLabel }}</text>
      <text class="floating-copy">{{ activeFloor.summary }}</text>
      <text class="floating-meta">{{ routeSummary }}</text>
    </view>

    <view class="map-floating top-right panel-soft controls-card">
      <view class="floor-switch">
        <button
          v-for="floor in MUSEUM_FLOOR_LAYOUTS"
          :key="floor.id"
          class="floor-pill"
          :class="{ 'is-active': floor.id === activeFloorId }"
          @click="switchFloor(floor.id)"
        >
          {{ floor.id }}
        </button>
      </view>

      <button class="reset-pill" @click="recenterMap">复位视角</button>
    </view>

    <view
      class="museum-map-viewport"
      @touchstart.stop="handleTouchStart($event)"
      @touchmove.stop.prevent="handleTouchMove($event)"
      @touchend.stop="handleTouchEnd"
      @touchcancel.stop="handleTouchEnd"
    >
      <view class="museum-map-stage" :style="stageStyle">
        <view class="stage-grid"></view>
        <view class="stage-frame"></view>
        <view class="stage-atrium"></view>
        <view class="stage-spine north"></view>
        <view class="stage-spine west"></view>
        <view class="stage-spine south"></view>
        <view class="stage-spine east"></view>
        <view class="stage-orbit"></view>
        <view class="stage-orbit is-inner"></view>

        <view class="axis-label axis-north">北向入口轴</view>
        <view class="axis-label axis-core">共享核心筒</view>
        <view class="axis-label axis-south">南向展线</view>

        <button
          v-for="hall in activeFloor.halls"
          :key="hall.id"
          class="hall-node"
          :class="{ 'is-selected': selectedHall?.id === hall.id }"
          :style="getHallStyle(hall)"
          @click="selectHall(hall.id)"
        >
          <text class="hall-chip">{{ hall.shortLabel }}</text>
          <text class="hall-label">{{ hall.label }}</text>
        </button>
      </view>
    </view>

    <view class="map-floating bottom-left panel-soft hall-card">
      <text class="floating-kicker">当前标记</text>
      <text class="floating-title">{{ selectedHall?.label }}</text>
      <text class="floating-copy">{{ selectedHall?.description }}</text>
      <text class="floating-meta">拖动地图查看整层，点选馆块聚焦具体位置。</text>
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
    radial-gradient(circle at 18% 16%, rgba(243, 217, 157, 0.12), transparent 24%),
    radial-gradient(circle at 82% 84%, rgba(112, 142, 149, 0.18), transparent 30%),
    linear-gradient(180deg, rgba(18, 20, 24, 0.98), rgba(9, 10, 13, 1));
}

.museum-map-stage {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: left top;
}

.stage-grid,
.stage-frame,
.stage-atrium,
.stage-spine,
.stage-orbit,
.axis-label,
.hall-node {
  position: absolute;
}

.stage-grid {
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    radial-gradient(circle at center, rgba(243, 217, 157, 0.06), transparent 58%);
  background-size: 48px 48px, 48px 48px, auto;
  opacity: 0.88;
}

.stage-frame {
  inset: 44px;
  border: 1px solid rgba(247, 239, 221, 0.12);
  border-radius: 42px;
  box-shadow: inset 0 0 0 1px rgba(247, 239, 221, 0.04);
}

.stage-atrium {
  left: 515px;
  top: 240px;
  width: 540px;
  height: 430px;
  border-radius: 26px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
    radial-gradient(circle at center, rgba(209, 178, 111, 0.04), transparent 65%);
}

.stage-spine {
  background: linear-gradient(90deg, transparent, rgba(247, 239, 221, 0.15), transparent);
}

.stage-spine.north {
  left: 430px;
  top: 220px;
  width: 760px;
  height: 3px;
}

.stage-spine.south {
  left: 335px;
  bottom: 175px;
  width: 930px;
  height: 3px;
}

.stage-spine.west,
.stage-spine.east {
  width: 3px;
  height: 560px;
  background: linear-gradient(180deg, transparent, rgba(247, 239, 221, 0.15), transparent);
}

.stage-spine.west {
  left: 470px;
  top: 165px;
}

.stage-spine.east {
  right: 320px;
  top: 165px;
}

.stage-orbit {
  right: 150px;
  top: 300px;
  width: 255px;
  height: 255px;
  border-radius: 999px;
  border: 6px solid rgba(255, 255, 255, 0.13);
  opacity: 0.6;
}

.stage-orbit.is-inner {
  right: 210px;
  top: 330px;
  width: 170px;
  height: 170px;
  border-width: 4px;
  opacity: 0.48;
}

.axis-label {
  color: rgba(247, 239, 221, 0.38);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.axis-north {
  left: 660px;
  top: 132px;
}

.axis-core {
  left: 720px;
  top: 445px;
}

.axis-south {
  left: 705px;
  bottom: 122px;
}

.hall-node {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f8f2e7;
  text-align: left;
}

.hall-node::after {
  border: 0;
}

.hall-node.is-selected {
  border-color: rgba(255, 248, 234, 0.62);
}

.hall-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(7, 8, 10, 0.24);
  color: rgba(255, 248, 234, 0.82);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.hall-label {
  font-size: 26px;
  line-height: 1.12;
  font-weight: 900;
  letter-spacing: 0.05em;
}

.map-floating {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 22rpx 24rpx;
  backdrop-filter: blur(22rpx);
  -webkit-backdrop-filter: blur(22rpx);
}

.top-left {
  top: 20rpx;
  left: 20rpx;
  width: 410rpx;
}

.top-right {
  top: 20rpx;
  right: 20rpx;
  width: 250rpx;
}

.bottom-left {
  left: 20rpx;
  right: 20rpx;
  bottom: 24rpx;
}

.controls-card {
  gap: 18rpx;
}

.floating-kicker {
  color: #d1b26f;
  font-size: 21rpx;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.floating-title {
  color: #fff8ea;
  font-size: 30rpx;
  line-height: 1.22;
  font-weight: 900;
}

.floating-copy {
  color: rgba(247, 239, 221, 0.76);
  font-size: 24rpx;
  line-height: 1.55;
}

.floating-meta {
  color: rgba(247, 239, 221, 0.48);
  font-size: 21rpx;
  line-height: 1.45;
}

.floor-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.floor-pill,
.reset-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 62rpx;
  border-radius: 999rpx;
  font-size: 23rpx;
  font-weight: 900;
  letter-spacing: 0.04em;
}

.floor-pill {
  min-width: 94rpx;
  padding: 0 18rpx;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04) !important;
  color: rgba(247, 239, 221, 0.62);
}

.floor-pill.is-active {
  background: linear-gradient(135deg, rgba(209, 178, 111, 0.32), rgba(209, 178, 111, 0.14)) !important;
  color: #fff8ea;
  border-color: rgba(209, 178, 111, 0.38);
}

.reset-pill {
  padding: 0 20rpx;
  border: 1px solid rgba(209, 178, 111, 0.32);
  background: rgba(209, 178, 111, 0.08) !important;
  color: #fff2d0;
}

@media (max-width: 420px) {
  .top-left {
    width: 360rpx;
  }

  .top-right {
    width: 224rpx;
  }

  .hall-label {
    font-size: 22px;
  }
}
</style>
