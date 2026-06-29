<script setup lang="ts">
import { computed } from 'vue';
import {
  MUSEUM_FLOOR_LAYOUTS,
  MUSEUM_WORLD_HEIGHT,
  MUSEUM_WORLD_WIDTH
} from '@/mock/museumMap';
import { useMuseumMapViewport } from '@/composables/useMuseumMapViewport';
import { useChromeMetrics } from '@/composables/useChromeMetrics';
import type { MuseumFloorId, MuseumHallBlock } from '@/types/museumMap';

interface Props {
  activeFloorId?: MuseumFloorId;
  selectedHallId?: string;
  routeCount?: number;
  completedCount?: number;
}

type SimpleHallNode = MuseumHallBlock & {
  nodeX: number;
  nodeY: number;
  nodeSize: number;
};

const props = withDefaults(defineProps<Props>(), {
  activeFloorId: '1F',
  selectedHallId: '',
  routeCount: 0,
  completedCount: 0
});

const emit = defineEmits<{
  'update:activeFloorId': [floorId: MuseumFloorId];
  selectHall: [hallId: string];
}>();

const { metrics } = useChromeMetrics();
const CENTER_X = MUSEUM_WORLD_WIDTH / 2;
const CENTER_Y = MUSEUM_WORLD_HEIGHT / 2;
const NODE_FIELD_WIDTH = 480;
const NODE_FIELD_HEIGHT = 320;
const BASE_NODE_SIZE = 96;

const {
  offsetX,
  offsetY,
  scale,
  syncViewport,
  resetView,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  canTriggerTap
} = useMuseumMapViewport({
  worldWidth: MUSEUM_WORLD_WIDTH,
  worldHeight: MUSEUM_WORLD_HEIGHT,
  minCoverRatio: 1.5
});

const activeFloor = computed(
  () =>
    MUSEUM_FLOOR_LAYOUTS.find((item) => item.id === props.activeFloorId) ||
    MUSEUM_FLOOR_LAYOUTS[0]
);

const selectedHall = computed<MuseumHallBlock | null>(() => {
  const hall = activeFloor.value.halls.find(
    (item) => item.id === props.selectedHallId
  );
  return hall || activeFloor.value.halls[0] || null;
});

const simpleHallNodes = computed<SimpleHallNode[]>(() => {
  const halls = activeFloor.value.halls;
  if (!halls.length) {
    return [];
  }

  const minX = Math.min(...halls.map((hall) => hall.x));
  const minY = Math.min(...halls.map((hall) => hall.y));
  const maxX = Math.max(...halls.map((hall) => hall.x + hall.width));
  const maxY = Math.max(...halls.map((hall) => hall.y + hall.height));
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);

  return halls.map((hall) => {
    const rawX = (hall.x + hall.width / 2 - minX) / spanX - 0.5;
    const rawY = (hall.y + hall.height / 2 - minY) / spanY - 0.5;
    const areaRatio = Math.sqrt((hall.width * hall.height) / (360 * 240));

    return {
      ...hall,
      nodeX: CENTER_X + rawX * NODE_FIELD_WIDTH,
      nodeY: CENTER_Y + rawY * NODE_FIELD_HEIGHT,
      nodeSize: Math.max(80, Math.min(BASE_NODE_SIZE * areaRatio, 130))
    };
  });
});

const stageStyle = computed(() => ({
  width: `${MUSEUM_WORLD_WIDTH}px`,
  height: `${MUSEUM_WORLD_HEIGHT}px`,
  transform: `translate3d(${offsetX.value}px, ${offsetY.value}px, 0) scale(${scale.value})`
}));

const topRightStyle = computed(() => ({
  top: `${metrics.value.navHeight + 16}px`,
  right: '12rpx'
}));

function getNodeStyle(hall: SimpleHallNode) {
  const isSelected = selectedHall.value?.id === hall.id;
  const half = hall.nodeSize / 2;

  return {
    left: `${hall.nodeX - half}px`,
    top: `${hall.nodeY - half}px`,
    width: `${hall.nodeSize}px`,
    height: `${hall.nodeSize}px`,
    background: isSelected
      ? `radial-gradient(circle at 35% 28%, rgba(255, 248, 234, 0.3), transparent 34%), linear-gradient(135deg, ${hall.accent}, rgba(209, 178, 111, 0.26))`
      : `radial-gradient(circle at 35% 28%, rgba(255, 248, 234, 0.18), transparent 34%), linear-gradient(135deg, ${hall.accent}, rgba(255, 248, 234, 0.08))`,
    boxShadow: isSelected
      ? `0 0 0 2px rgba(255, 248, 234, 0.58), 0 18px 52px ${hall.accent}77`
      : `0 14px 40px ${hall.accent}38`
  };
}

function selectHall(hallId: string) {
  if (!canTriggerTap()) {
    return;
  }

  emit('selectHall', hallId);
}

async function switchFloor(floorId: MuseumFloorId) {
  if (floorId === props.activeFloorId) {
    return;
  }

  emit('update:activeFloorId', floorId);
  await syncViewport();
  resetView();
}

async function recenterMap() {
  await syncViewport();
  resetView();
}
</script>

<template>
  <view class="museum-map-shell">
    <view
      class="museum-map-viewport"
      @touchstart.stop="handleTouchStart($event)"
      @touchmove.stop.prevent="handleTouchMove($event)"
      @touchend.stop="handleTouchEnd"
      @touchcancel.stop="handleTouchEnd">
      <view class="museum-map-stage" :style="stageStyle">
        <view class="map-grid"></view>

        <button
          v-for="hall in simpleHallNodes"
          :key="hall.id"
          class="hall-node"
          :class="{ 'is-selected': selectedHall?.id === hall.id }"
          :style="getNodeStyle(hall)"
          @click="selectHall(hall.id)">
          <text class="hall-short">{{ hall.shortLabel }}</text>
          <text class="hall-name">{{ hall.label }}</text>
        </button>
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
    radial-gradient(
      circle at 50% 38%,
      rgba(209, 178, 111, 0.12),
      transparent 320px
    ),
    radial-gradient(
      circle at 20% 72%,
      rgba(112, 142, 149, 0.16),
      transparent 280px
    ),
    linear-gradient(180deg, rgba(18, 20, 24, 0.98), rgba(7, 8, 11, 1));
}

.museum-map-stage {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: left top;
}

.map-grid,
.hall-node {
  position: absolute;
}

.map-grid {
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(
    circle at center,
    #000 0,
    rgba(0, 0, 0, 0.72) 46%,
    transparent 78%
  );
}

.hall-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  overflow: hidden;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #fff8ea;
  text-align: center;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.hall-node::after {
  border: 0;
}

.hall-node.is-selected {
  z-index: 3;
  border-color: rgba(255, 248, 234, 0.7);
  transform: scale(1.08);
}

.hall-short {
  color: rgba(255, 248, 234, 0.72);
  font-size: 10px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0;
}

.hall-name {
  max-width: 82%;
  color: #fff8ea;
  font-size: 13px;
  line-height: 1.08;
  font-weight: 900;
  letter-spacing: 0;
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
  .hall-name {
    font-size: 12px;
  }
}
</style>
