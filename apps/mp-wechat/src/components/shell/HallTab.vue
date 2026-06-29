<script setup lang="ts">
import { computed, nextTick, onUnmounted, shallowRef, watch } from 'vue';
import { gsap } from 'gsap';
import MissionCard from '@/components/mission/MissionCard.vue';
import MuseumOverviewMap from '@/components/shell/MuseumOverviewMap.vue';
import { MUSEUM_FLOOR_LAYOUTS } from '@/mock/museumMap';
import { useChromeMetrics } from '@/composables/useChromeMetrics';
import type {
  AgeBand,
  DifficultyLevel,
  MissionRouteCard,
  TaskKind
} from '@/types/mission';
import type { MuseumFloorId, MuseumHallBlock } from '@/types/museumMap';

interface Props {
  routes: MissionRouteCard[];
  activeRouteId?: string | null;
  completedRouteIds?: string[];
  filters: {
    ageBand: AgeBand | 'all';
    difficulty: DifficultyLevel | 'all';
    taskKind: TaskKind | 'all';
  };
  coverage: {
    ageBands: number;
    difficulties: number;
    taskKinds: number;
    missionCount: number;
  };
}

const props = defineProps<Props>();
const { metrics } = useChromeMetrics();

const activeFloorId = shallowRef<MuseumFloorId>('1F');
const selectedHallId = shallowRef(MUSEUM_FLOOR_LAYOUTS[0]?.halls[0]?.id || '');
const sheetVisible = shallowRef(false);
const sheetRendered = shallowRef(false);
const sheetMaskRef = shallowRef<unknown>(null);
const sheetPanelRef = shallowRef<unknown>(null);
let sheetTween: { kill?: () => void } | null = null;

const mapStageStyle = computed(() => {
  const shellHeight = Math.max(
    640,
    uni.getSystemInfoSync().windowHeight - metrics.value.navHeight
  );

  return {
    height: `${shellHeight}px`
  };
});

const activeFloor = computed(
  () =>
    MUSEUM_FLOOR_LAYOUTS.find((floor) => floor.id === activeFloorId.value) ||
    MUSEUM_FLOOR_LAYOUTS[0]
);

const selectedHall = computed<MuseumHallBlock | null>(() => {
  const hall = activeFloor.value.halls.find(
    (item) => item.id === selectedHallId.value
  );
  return hall || activeFloor.value.halls[0] || null;
});

const hallRoutes = computed(() =>
  props.routes.filter((route) => route.hallId === selectedHall.value?.id)
);

const hallTaskSummary = computed(() => {
  const count = hallRoutes.value.length;

  if (!selectedHall.value) {
    return '';
  }

  return count ? `当前共 ${count} 条可进入任务` : '当前展馆暂未配置任务';
});

function resolveElement(target: unknown): HTMLElement | null {
  if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement) {
    return target;
  }

  const maybeRef = target as { $el?: unknown } | null;
  if (
    typeof HTMLElement !== 'undefined' &&
    maybeRef?.$el instanceof HTMLElement
  ) {
    return maybeRef.$el;
  }

  return null;
}

function syncSelectedHallForFloor(floorId: MuseumFloorId) {
  const nextFloor =
    MUSEUM_FLOOR_LAYOUTS.find((floor) => floor.id === floorId) ||
    MUSEUM_FLOOR_LAYOUTS[0];
  const hasSelectedHall = nextFloor.halls.some(
    (hall) => hall.id === selectedHallId.value
  );

  if (!hasSelectedHall) {
    selectedHallId.value = nextFloor.halls[0]?.id || '';
  }
}

function handleFloorChange(floorId: MuseumFloorId) {
  activeFloorId.value = floorId;
  syncSelectedHallForFloor(floorId);
  sheetVisible.value = false;
}

function playSheetEnter() {
  sheetTween?.kill?.();

  const mask = resolveElement(sheetMaskRef.value);
  const panel = resolveElement(sheetPanelRef.value);

  if (!mask || !panel) {
    return;
  }

  mask.style.opacity = '0';
  mask.style.visibility = 'hidden';
  panel.style.opacity = '0';
  panel.style.transform = 'translate3d(0, 44px, 0)';

  const timeline = gsap.timeline({ defaults: { overwrite: 'auto' } }) as any;
  timeline
    .to(mask, {
      autoAlpha: 1,
      duration: 0.18,
      ease: 'power1.out'
    })
    .to(
      panel,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.3,
        ease: 'power2.out'
      },
      0
    );

  sheetTween = timeline;
}

function playSheetExit() {
  sheetTween?.kill?.();

  const mask = resolveElement(sheetMaskRef.value);
  const panel = resolveElement(sheetPanelRef.value);

  if (!mask || !panel) {
    sheetRendered.value = false;
    return;
  }

  const timeline = gsap.timeline({
    defaults: { overwrite: 'auto' },
    onComplete: () => {
      sheetRendered.value = false;
    }
  }) as any;

  timeline
    .to(panel, {
      autoAlpha: 0,
      y: 28,
      duration: 0.2,
      ease: 'power2.in'
    })
    .to(
      mask,
      {
        autoAlpha: 0,
        duration: 0.16,
        ease: 'power1.in'
      },
      0
    );

  sheetTween = timeline;
}

function handleHallSelect(hallId: string) {
  selectedHallId.value = hallId;
  sheetVisible.value = true;
}

function closeSheet() {
  sheetVisible.value = false;
}

function getRouteStatus(routeId: string) {
  if (routeId === props.activeRouteId) {
    return 'in-progress' as const;
  }

  if (props.completedRouteIds?.includes(routeId)) {
    return 'completed' as const;
  }

  return 'available' as const;
}

watch(
  activeFloorId,
  (floorId) => {
    syncSelectedHallForFloor(floorId);
  },
  { immediate: true }
);

watch(sheetVisible, async (visible) => {
  if (visible) {
    sheetRendered.value = true;
    await nextTick();
    playSheetEnter();
    return;
  }

  if (!sheetRendered.value) {
    return;
  }

  playSheetExit();
});

onUnmounted(() => {
  sheetTween?.kill?.();
});
</script>

<template>
  <view class="hall-map-stage" :style="mapStageStyle">
    <MuseumOverviewMap
      :active-floor-id="activeFloorId"
      :selected-hall-id="selectedHallId"
      :route-count="props.coverage.missionCount"
      :completed-count="props.completedRouteIds?.length || 0"
      @update:active-floor-id="handleFloorChange"
      @select-hall="handleHallSelect" />

    <view
      v-if="sheetRendered && selectedHall"
      ref="sheetMaskRef"
      class="hall-sheet-mask"
      @click="closeSheet"></view>

    <view
      v-if="sheetRendered && selectedHall"
      ref="sheetPanelRef"
      class="hall-sheet panel-soft">
      <view class="hall-sheet-header">
        <view class="hall-sheet-copy">
          <text class="hall-sheet-floor">
            {{ activeFloor.label }} / {{ selectedHall.shortLabel }}
          </text>
          <text class="hall-sheet-title">{{ selectedHall.label }}</text>
          <text class="hall-sheet-description">
            {{ selectedHall.description }}
          </text>
        </view>
        <button class="hall-sheet-close" @click="closeSheet">收起</button>
      </view>

      <view class="hall-sheet-meta">
        <text class="hall-sheet-badge">{{ hallTaskSummary }}</text>
      </view>

      <scroll-view
        v-if="hallRoutes.length"
        class="hall-sheet-list"
        scroll-y
        enable-flex>
        <MissionCard
          v-for="route in hallRoutes"
          :key="route.id"
          :route="route"
          :show-resume="route.id === activeRouteId"
          :status="getRouteStatus(route.id)"
          @open="$emit('open', $event)" />
      </scroll-view>

      <view v-else class="hall-sheet-empty">
        <text class="hall-sheet-empty-title">这个展馆还没有可进入任务</text>
        <text class="hall-sheet-empty-copy">
          可以切换楼层或点击其他展馆查看已配置的路线。
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.hall-map-stage {
  position: relative;
  margin-left: -20rpx;
  margin-right: -20rpx;
}

.hall-sheet-mask {
  position: absolute;
  inset: 0;
  z-index: 58;
  background: linear-gradient(180deg, rgba(6, 7, 9, 0), rgba(6, 7, 9, 0.42));
}

.hall-sheet {
  position: absolute;
  left: 20rpx;
  right: 20rpx;
  bottom: calc(112rpx + env(safe-area-inset-bottom));
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  max-height: 50%;
  padding: 24rpx;
  border-radius: 32rpx;
  background:
    radial-gradient(
      circle at top right,
      rgba(209, 178, 111, 0.18),
      transparent 28%
    ),
    linear-gradient(180deg, rgba(26, 27, 30, 0.97), rgba(10, 12, 16, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 -8rpx 40rpx rgba(0, 0, 0, 0.32);
}

.hall-sheet-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.hall-sheet-copy {
  flex: 1;
  min-width: 0;
}

.hall-sheet-floor,
.hall-sheet-description,
.hall-sheet-badge,
.hall-sheet-empty-copy {
  color: rgba(247, 239, 221, 0.68);
}

.hall-sheet-floor {
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 0;
}

.hall-sheet-title {
  display: block;
  margin-top: 8rpx;
  color: #fff8ea;
  font-size: 34rpx;
  line-height: 1.14;
  font-weight: 900;
}

.hall-sheet-description {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  line-height: 1.6;
}

.hall-sheet-close {
  flex: 0 0 auto;
  min-height: 56rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  border: 1px solid rgba(209, 178, 111, 0.24);
  background: rgba(209, 178, 111, 0.08) !important;
  color: #f4ddb0;
  font-size: 22rpx;
  font-weight: 800;
}

.hall-sheet-meta {
  display: flex;
  align-items: center;
}

.hall-sheet-badge {
  display: inline-flex;
  align-items: center;
  min-height: 44rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.05);
  font-size: 20rpx;
  font-weight: 800;
}

.hall-sheet-list {
  min-height: 0;
  white-space: normal;
}

.hall-sheet-list :deep(.card-button) {
  margin-bottom: 16rpx;
}

.hall-sheet-list :deep(.card-button:last-child) {
  margin-bottom: 0;
}

.hall-sheet-empty {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.04);
}

.hall-sheet-empty-title {
  color: #fff8ea;
  font-size: 26rpx;
  font-weight: 800;
}

.hall-sheet-empty-copy {
  font-size: 22rpx;
  line-height: 1.6;
}
</style>
