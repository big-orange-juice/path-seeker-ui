<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  shallowRef,
  watch
} from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { gsap } from 'gsap';
import { useMissionStore } from '@/stores/useMissionStore';
import {
  MINI_ROUTES,
  isFabTopLevelRoute,
  isMiniRoute
} from '@/utils/navigation';
import type { ShellTab } from '@/types/mission';

interface TabItem {
  label: string;
  value: ShellTab;
  icon: 'map' | 'route' | 'archive';
}

const missionStore = useMissionStore();

const items: TabItem[] = [
  { label: '首页', value: 'hall', icon: 'map' },
  { label: '继续', value: 'playing', icon: 'route' },
  { label: '收获', value: 'archive', icon: 'archive' }
];

const TAB_WIDTH = 148;
const ITEM_HEIGHT = 76;
const GAP = 10;
const PAD = 8;

const currentRoute = computed(() => {
  const pages = getCurrentPages();
  return pages[pages.length - 1]?.route || '';
});

const displayedTab = shallowRef<ShellTab>('hall');
const pendingTab = shallowRef<ShellTab | null>(null);
const isExpanded = shallowRef(false);
const expandedProgress = shallowRef(0);
const tweenState = { progress: 0 };
let expandTween: gsap.core.Tween | null = null;
let queuedAction: (() => void) | null = null;
let introExpandTimer: ReturnType<typeof setTimeout> | null = null;
let introCollapseTimer: ReturnType<typeof setTimeout> | null = null;
const introMarkerKey = '__path_seeker_island_intro__';

const activeTab = computed<ShellTab>(() => {
  const route = currentRoute.value;

  if (isMiniRoute(route, MINI_ROUTES.home)) {
    return 'hall';
  }

  if (isMiniRoute(route, MINI_ROUTES.archive) || isMiniRoute(route, MINI_ROUTES.finale)) {
    return 'archive';
  }

  if (
    isMiniRoute(route, MINI_ROUTES.missionCenter) ||
    isMiniRoute(route, MINI_ROUTES.prologue) ||
    isMiniRoute(route, MINI_ROUTES.chapterMap) ||
    isMiniRoute(route, MINI_ROUTES.artifactClue) ||
    isMiniRoute(route, MINI_ROUTES.puzzle) ||
    isMiniRoute(route, MINI_ROUTES.chapterResult)
  ) {
    return 'playing';
  }

  if (missionStore.activeSession) {
    return 'playing';
  }

  return 'hall';
});

const activeIndex = computed(() =>
  Math.max(
    items.findIndex((item) => item.value === displayedTab.value),
    0
  )
);

function getExpandedWidth() {
  const tabGaps = items.length - 1;
  return items.length * TAB_WIDTH + tabGaps * GAP + PAD * 2;
}

function animateProgress(target: number, onComplete?: () => void) {
  expandTween?.kill();
  expandTween = gsap.to(tweenState, {
    progress: target,
    duration: 0.42,
    ease: target ? 'power3.out' : 'power3.inOut',
    overwrite: true,
    onUpdate: () => {
      expandedProgress.value = tweenState.progress;
    },
    onComplete: () => {
      expandedProgress.value = target;
      tweenState.progress = target;
      onComplete?.();
    }
  });
}

function collapse() {
  isExpanded.value = false;
  animateProgress(0);
}

function expand() {
  isExpanded.value = true;
  animateProgress(1);
}

function collapseThen(action: () => void) {
  isExpanded.value = false;
  queuedAction = action;
  animateProgress(0, () => {
    const nextAction = queuedAction;
    queuedAction = null;
    nextAction?.();
  });
}

function switchToTab(tab: ShellTab) {
  const route = currentRoute.value;

  if (tab === 'playing' && !missionStore.activeSession) {
    openTopLevelPage(MINI_ROUTES.home);
    return;
  }

  if (tab === 'hall') {
    if (isMiniRoute(route, MINI_ROUTES.home)) {
      return;
    }

    openTopLevelPage(MINI_ROUTES.home);
    return;
  }

  if (tab === 'archive') {
    if (isMiniRoute(route, MINI_ROUTES.archive)) {
      return;
    }

    openTopLevelPage(MINI_ROUTES.archive);
    return;
  }

  if (isMiniRoute(route, MINI_ROUTES.missionCenter)) {
    return;
  }

  openTopLevelPage(MINI_ROUTES.missionCenter);
}

function openTopLevelPage(url: string) {
  const route = currentRoute.value;

  if (isFabTopLevelRoute(route)) {
    uni.redirectTo({ url });
    return;
  }

  uni.navigateTo({ url });
}

function handleTabClick(value: ShellTab) {
  if (!isExpanded.value) {
    if (value === displayedTab.value) {
      expand();
      return;
    }

    displayedTab.value = value;
    switchToTab(value);
    return;
  }

  if (value === displayedTab.value) {
    collapse();
    return;
  }

  displayedTab.value = value;
  pendingTab.value = value;
  collapseThen(() => {
    switchToTab(value);
  });
}

watch(
  activeTab,
  (value) => {
    if (!pendingTab.value || value === pendingTab.value) {
      displayedTab.value = value;
    }

    if (value === pendingTab.value) {
      pendingTab.value = null;
    }

    if (!isExpanded.value) {
      tweenState.progress = 0;
      expandedProgress.value = 0;
      return;
    }

    animateProgress(1);
  },
  { immediate: true }
);

onUnmounted(() => {
  expandTween?.kill();
  if (introExpandTimer) {
    clearTimeout(introExpandTimer);
  }
  if (introCollapseTimer) {
    clearTimeout(introCollapseTimer);
  }
});

onMounted(async () => {
  if ((globalThis as Record<string, unknown>)[introMarkerKey]) {
    return;
  }

  (globalThis as Record<string, unknown>)[introMarkerKey] = true;
  await nextTick();

  introExpandTimer = setTimeout(() => {
    expand();
    introCollapseTimer = setTimeout(() => {
      collapse();
    }, 1000);
  }, 140);
});

const islandStyle = computed(() => {
  const progress = expandedProgress.value;
  const collapsedWidth = TAB_WIDTH + PAD * 2;
  const width =
    collapsedWidth + (getExpandedWidth() - collapsedWidth) * progress;

  return {
    width: `${width}rpx`
  };
});

const indicatorStyle = computed(() => {
  const progress = expandedProgress.value;
  const expandedX = PAD + activeIndex.value * (TAB_WIDTH + GAP);
  const x = PAD + (expandedX - PAD) * progress;

  return {
    width: `${TAB_WIDTH}rpx`,
    height: `${ITEM_HEIGHT}rpx`,
    transform: `translateX(${x}rpx)`
  };
});

function getTabStyle(index: number) {
  const progress = expandedProgress.value;
  const isActive = index === activeIndex.value;
  const visibleProgress = isActive ? 1 : progress;
  const hasTrailingGap = index < items.length - 1;

  return {
    width: `${TAB_WIDTH * visibleProgress}rpx`,
    maxWidth: `${TAB_WIDTH * visibleProgress}rpx`,
    minWidth: `${TAB_WIDTH * visibleProgress}rpx`,
    height: `${ITEM_HEIGHT}rpx`,
    paddingLeft: `${18 * visibleProgress}rpx`,
    paddingRight: `${18 * visibleProgress}rpx`,
    gap: `${8 * visibleProgress}rpx`,
    marginRight: `${hasTrailingGap ? GAP * progress : 0}rpx`,
    opacity: visibleProgress,
    transform: `scale(${0.94 + 0.06 * visibleProgress})`,
    pointerEvents: (visibleProgress > 0.05 ? 'auto' : 'none') as 'auto' | 'none'
  };
}
</script>

<template>
  <view class="tabbar-fab">
    <view
      class="tabbar"
      :class="{ 'is-expanded': isExpanded }"
      :style="islandStyle">
      <view class="tab-indicator" :style="indicatorStyle"></view>

      <button
        v-for="(item, index) in items"
        :key="item.value"
        class="tab-item"
        :class="{ 'is-active': displayedTab === item.value }"
        :style="getTabStyle(index)"
        @click="handleTabClick(item.value)">
        <view class="tab-icon">
          <AppIcon :name="item.icon" :size="22" />
        </view>
        <text class="tab-label">{{ item.label }}</text>
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.tabbar-fab {
  position: fixed;
  left: 50%;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  z-index: 40;
  transform: translateX(-50%);
  pointer-events: none;
}

.tabbar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: nowrap;
  height: 96rpx;
  padding: 8rpx;
  overflow: hidden;
  border-radius: 48rpx;
  background: rgba(7, 8, 10, 0.35);
  backdrop-filter: blur(32rpx);
  -webkit-backdrop-filter: blur(32rpx);
  box-shadow: 0 0 28rpx rgba(209, 178, 111, 0.35);
  pointer-events: auto;
  white-space: nowrap;
}

.tab-indicator {
  position: absolute;
  left: 0;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(86, 70, 35, 0.92),
    rgba(209, 178, 111, 0.18)
  );
  box-shadow: inset 0 0 0 1px rgba(243, 217, 157, 0.1);
}

.tab-item {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 999rpx;
  background: transparent !important;
  color: rgba(247, 239, 221, 0.54);
  transform-origin: center center;
  box-sizing: border-box;
  white-space: nowrap;
  line-height: 1;
  appearance: none;
  -webkit-appearance: none;
}

.tab-item::after {
  border: 0;
}

.tab-item.is-active {
  color: #fff8ea;
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38rpx;
  height: 38rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.05);
  flex: 0 0 auto;
}

.tab-item.is-active .tab-icon {
  background: linear-gradient(135deg, #d1b26f, #f3d99d);
}

.tab-label {
  font-size: 23rpx;
  font-weight: 900;
  white-space: nowrap;
  letter-spacing: 0.02em;
  line-height: 1;
}
</style>
