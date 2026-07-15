<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue';
import type { CSSProperties } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { gsap } from 'gsap';
import { Archive, Compass, Map, MessageCircle, Play } from 'lucide-vue-next';
import { useAskStore } from '@/stores/useAskStore';
import { useMissionStore } from '@/stores/useMissionStore';
import type { ShellTab } from '@/types/mission';

interface FabActionItem {
  key: string;
  label: string;
  icon: typeof Compass;
  to?: string;
  active?: boolean;
  action?: 'ask';
}

/** 收缩态与展开态每个 item 同宽，避免展开动画宽度抖动 */
const ITEM_WIDTH = 86;
const ITEM_HEIGHT = 36;
const ITEM_GAP = 6;
const CONTAINER_PADDING = 5;
const SELECTION_SETTLE_DURATION = 0.18;
/** 收缩 = 单 item + 左右 padding，与展开时一格一致 */
const COLLAPSED_WIDTH = ITEM_WIDTH + CONTAINER_PADDING * 2;
const ISLAND_HEIGHT = ITEM_HEIGHT + CONTAINER_PADDING * 2;

const route = useRoute();
const router = useRouter();
const missionStore = useMissionStore();
const askStore = useAskStore();
const fabRoot = useTemplateRef<HTMLElement>('fabRoot');

const shellItems: Array<{
  label: string;
  value: ShellTab;
  to: string;
  icon: typeof Compass;
}> = [
  { label: '展厅', value: 'hall', to: '/shell/hall', icon: Compass },
  { label: '探索', value: 'playing', to: '/shell/playing', icon: Play },
  { label: '收藏', value: 'archive', to: '/shell/archive', icon: Archive }
];

const routeId = computed(() => String(route.params.routeId || ''));
const chapterId = computed(() => String(route.params.chapterId || ''));
const onMissionRoute = computed(() => route.path.startsWith('/missions/'));
const onShellRoute = computed(() => route.path.startsWith('/shell/'));
const onAuthRoute = computed(() => route.path.startsWith('/auth'));
const shellTab = computed(() => String(route.meta.shellTab || 'hall'));
const resumePath = computed(() => missionStore.resolveResumeRoutePath());
const activeChapterMapPath = computed(() =>
  missionStore.activeSession
    ? `/missions/${missionStore.activeSession.routeId}/map`
    : '/shell/playing'
);

const askAction = computed<FabActionItem>(() => ({
  key: 'ask',
  label: '问',
  icon: MessageCircle,
  action: 'ask',
  active: askStore.open || route.path.startsWith('/shell/ask')
}));

const actions = computed<FabActionItem[]>(() => {
  if (onAuthRoute.value) {
    return [];
  }

  if (onShellRoute.value) {
    return [
      ...shellItems.map((item) => ({
        key: item.value,
        label: item.label,
        icon: item.icon,
        to: item.to,
        active: shellTab.value === item.value && !askStore.open
      })),
      askAction.value
    ];
  }

  if (onMissionRoute.value) {
    const onMapPage = route.path.endsWith('/map');
    const onPuzzleFlowPage = route.path.includes('/chapters/');
    const hasActiveChapter = Boolean(chapterId.value);

    return [
      {
        key: 'map',
        label: '路线',
        icon: Map,
        to: routeId.value
          ? `/missions/${routeId.value}/map`
          : activeChapterMapPath.value,
        active: onMapPage && !askStore.open
      },
      {
        key: 'resume',
        label: hasActiveChapter ? '当前' : '继续',
        icon: Play,
        to: resumePath.value || activeChapterMapPath.value,
        active: !onMapPage && onPuzzleFlowPage && !askStore.open
      },
      {
        key: 'hall',
        label: '展厅',
        icon: Compass,
        to: '/shell/hall',
        active: false
      },
      askAction.value
    ];
  }

  return [];
});

const showFab = computed(() => actions.value.length > 0);
const displayedKey = shallowRef('');
const pendingKey = shallowRef('');
const isExpanded = shallowRef(false);
const expandedProgress = shallowRef(0);
const isRouteSwitching = shallowRef(false);
const tweenState = { progress: 0 };

let expandTween: gsap.core.Tween | null = null;
let selectionDelayCall: gsap.core.Tween | null = null;
let ctx: gsap.Context | null = null;
let outsidePointerHandler: ((event: PointerEvent) => void) | null = null;

const activeKey = computed(() => {
  const matched = actions.value.find((item) => item.active);
  return matched?.key || actions.value[0]?.key || '';
});

const activeIndex = computed(() =>
  Math.max(
    actions.value.findIndex((item) => item.key === displayedKey.value),
    0
  )
);

const activeItem = computed(
  () => actions.value[activeIndex.value] || actions.value[0] || null
);

const expandedWidth = computed(
  () =>
    actions.value.length * ITEM_WIDTH +
    Math.max(actions.value.length - 1, 0) * ITEM_GAP +
    CONTAINER_PADDING * 2
);

const islandStyle = computed<CSSProperties>(() => {
  const width =
    COLLAPSED_WIDTH +
    (expandedWidth.value - COLLAPSED_WIDTH) * expandedProgress.value;

  return {
    width: `${width}px`,
    height: `${ISLAND_HEIGHT}px`,
    '--fab-item-width': `${ITEM_WIDTH}px`,
    '--fab-item-height': `${ITEM_HEIGHT}px`,
    '--fab-gap': `${ITEM_GAP}px`,
    '--fab-padding': `${CONTAINER_PADDING}px`
  };
});

const showCollapsed = computed(() => expandedProgress.value < 0.08);
const showRail = computed(() => expandedProgress.value > 0.08);

const indicatorStyle = computed<CSSProperties>(() => {
  const x = CONTAINER_PADDING + activeIndex.value * (ITEM_WIDTH + ITEM_GAP);

  return {
    width: `${ITEM_WIDTH}px`,
    height: `${ITEM_HEIGHT}px`,
    opacity: Math.min(1, expandedProgress.value * 1.2),
    transform: `translateX(${x}px)`
  };
});

function animateProgress(target: number, onComplete?: () => void) {
  expandTween?.kill();
  expandTween = gsap.to(tweenState, {
    progress: target,
    duration: 0.24,
    ease: target ? 'power2.out' : 'power2.inOut',
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

function unbindOutsideCollapse() {
  if (outsidePointerHandler) {
    document.removeEventListener('pointerdown', outsidePointerHandler, true);
    outsidePointerHandler = null;
  }
}

function bindOutsideCollapse() {
  unbindOutsideCollapse();
  outsidePointerHandler = (event: PointerEvent) => {
    if (!fabRoot.value?.contains(event.target as Node)) {
      collapse();
    }
  };
  window.setTimeout(() => {
    if (outsidePointerHandler) {
      document.addEventListener('pointerdown', outsidePointerHandler, true);
    }
  }, 0);
}

function expand() {
  isExpanded.value = true;
  animateProgress(1);
  bindOutsideCollapse();
}

function collapse() {
  isExpanded.value = false;
  unbindOutsideCollapse();
  animateProgress(0);
}

function waitForSelectionSettle() {
  selectionDelayCall?.kill();

  return new Promise<void>((resolve) => {
    selectionDelayCall = gsap.delayedCall(SELECTION_SETTLE_DURATION, () => {
      selectionDelayCall = null;
      resolve();
    });
  });
}

async function navigateTo(target: string) {
  if (!target || target === route.fullPath) {
    return;
  }

  await router.push(target);
}

function handleCollapsedClick() {
  expand();
}

async function handleActionClick(item: FabActionItem) {
  if (isRouteSwitching.value) {
    return;
  }

  if (item.action === 'ask') {
    displayedKey.value = item.key;
    askStore.openAsk({ path: route.path });
    collapse();
    return;
  }

  if (item.key === displayedKey.value) {
    collapse();
    return;
  }

  displayedKey.value = item.key;
  pendingKey.value = item.key;
  isRouteSwitching.value = true;

  try {
    await Promise.all([
      item.to ? navigateTo(item.to) : Promise.resolve(),
      waitForSelectionSettle()
    ]);

    if (pendingKey.value === item.key || activeKey.value === item.key) {
      collapse();
    }
  } finally {
    isRouteSwitching.value = false;
  }
}

/** 仅首次出现时轻入场；路由切换不再从 autoAlpha:0 重放，避免闪烁 */
let hasPlayedEnter = false;

function playEnterIfNeeded() {
  if (!fabRoot.value || hasPlayedEnter) {
    // 保持可见，不重置透明度
    gsap.set('.fab-island', { clearProps: 'opacity,visibility,transform' });
    return;
  }

  hasPlayedEnter = true;
  ctx?.revert();
  ctx = gsap.context(() => {
    gsap.fromTo(
      '.fab-island',
      { y: 6, autoAlpha: 0.92, scale: 0.99 },
      {
        y: 0,
        autoAlpha: 1,
        scale: 1,
        duration: 0.2,
        ease: 'power2.out',
        overwrite: true
      }
    );
  }, fabRoot.value);
}

function softCollapse() {
  if (!isExpanded.value && expandedProgress.value <= 0) {
    return;
  }
  expandTween?.kill();
  isExpanded.value = false;
  unbindOutsideCollapse();
  // 收起时用短动画，不要瞬间 snap + 透明度闪
  animateProgress(0);
}

watch(
  activeKey,
  (value) => {
    if (!pendingKey.value || value === pendingKey.value) {
      displayedKey.value = value;
    }

    if (value === pendingKey.value) {
      pendingKey.value = '';
    }
  },
  { immediate: true }
);

watch(
  () => route.fullPath,
  () => {
    // FAB 自身点击跳转时由 handleActionClick 收起，避免双重动画
    if (isRouteSwitching.value) {
      return;
    }
    softCollapse();
  }
);

// showFab 在 auth 等页为 false：用 v-show 保活 DOM，避免反复 mount 入场闪烁
watch(
  showFab,
  (visible) => {
    if (visible) {
      nextTick(() => playEnterIfNeeded());
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (showFab.value) {
    playEnterIfNeeded();
  }
});

onUnmounted(() => {
  ctx?.revert();
  expandTween?.kill();
  selectionDelayCall?.kill();
  unbindOutsideCollapse();
});
</script>

<template>
  <div
    ref="fabRoot"
    class="fab-root fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50"
    :class="{ 'fab-root-hidden': !showFab }"
    :aria-hidden="!showFab">
    <div class="mx-auto flex w-full max-w-[30rem] justify-center px-4">
      <!-- 根节点 pointer-events:none 不挡页面；岛本体重新开启点击 -->
      <div class="fab-shell">
        <div
          class="fab-island"
          :class="{ 'fab-island-expanded': isExpanded }"
          :style="islandStyle"
          role="toolbar"
          aria-label="快捷导航">
          <button
            v-if="activeItem && showCollapsed"
            type="button"
            class="fab-collapsed"
            @click="handleCollapsedClick()">
            <span class="fab-collapsed-item">
              <span class="fab-icon fab-icon-primary">
                <component
                  :is="activeItem.icon"
                  class="h-[0.95rem] w-[0.95rem]" />
              </span>
              <span class="fab-label">{{ activeItem.label }}</span>
            </span>
          </button>

          <div v-if="showRail" class="fab-rail">
            <div class="fab-indicator" :style="indicatorStyle" />
            <button
              v-for="item in actions"
              :key="item.key"
              type="button"
              class="fab-item"
              :class="{ 'fab-item-active': displayedKey === item.key }"
              @click="handleActionClick(item)">
              <span
                class="fab-icon"
                :class="{ 'fab-icon-primary': displayedKey === item.key }">
                <component :is="item.icon" class="h-[0.9rem] w-[0.9rem]" />
              </span>
              <span class="fab-label">{{ item.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fab-root {
  pointer-events: none;
}

.fab-root-hidden {
  visibility: hidden;
  opacity: 0;
  pointer-events: none !important;
}

/* 必须在 none 的祖先下显式 auto，否则按钮点不到 */
.fab-shell,
.fab-island,
.fab-collapsed,
.fab-item {
  pointer-events: auto;
}


.fab-island {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(232, 198, 128, 0.48);
  border-radius: 999px;
  background: rgba(8, 9, 12, 0.38);
  backdrop-filter: blur(22px) saturate(1.24);
  -webkit-backdrop-filter: blur(22px) saturate(1.24);
  box-shadow:
    inset 0 1px 0 rgba(255, 245, 224, 0.2),
    inset 0 0 0 1px rgba(255, 223, 163, 0.05),
    0 0 20px rgba(209, 178, 111, 0.26),
    0 12px 24px rgba(0, 0, 0, 0.22);
  white-space: nowrap;
  /* 宽度由 JS 插值控制，避免内容撑开导致抖动 */
  box-sizing: border-box;
}

.fab-island::before {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    rgba(255, 224, 166, 0.12),
    rgba(255, 255, 255, 0.015) 38%,
    rgba(255, 214, 138, 0.14)
  );
  pointer-events: none;
}

.fab-collapsed {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--fab-padding);
  border: 0;
  background: transparent;
  color: #fff8ea;
}

.fab-collapsed-item {
  display: flex;
  /* 与展开态 .fab-item 同宽，保证展开动画不抖 */
  width: var(--fab-item-width);
  height: var(--fab-item-height);
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 0.36rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  box-sizing: border-box;
  background: linear-gradient(
    135deg,
    rgba(88, 70, 36, 0.94),
    rgba(209, 178, 111, 0.2)
  );
  box-shadow:
    inset 0 0 0 1px rgba(243, 217, 157, 0.14),
    0 0 16px rgba(209, 178, 111, 0.14);
}

.fab-rail {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: var(--fab-gap);
  padding: var(--fab-padding);
}

.fab-indicator {
  position: absolute;
  left: 0;
  border-radius: 999px;
  background: linear-gradient(
    135deg,
    rgba(88, 70, 36, 0.94),
    rgba(209, 178, 111, 0.2)
  );
  transition:
    transform 0.18s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.18s ease;
  box-shadow:
    inset 0 0 0 1px rgba(243, 217, 157, 0.14),
    0 0 16px rgba(209, 178, 111, 0.14);
}

.fab-item {
  position: relative;
  z-index: 1;
  display: flex;
  width: var(--fab-item-width);
  height: var(--fab-item-height);
  flex: 0 0 var(--fab-item-width);
  align-items: center;
  justify-content: center;
  gap: 0.28rem;
  padding: 0 0.5rem;
  border: 0;
  border-radius: 999px;
  box-sizing: border-box;
  background: transparent;
  color: rgba(247, 239, 221, 0.56);
  line-height: 1;
  transition: color 0.18s ease;
}

.fab-item-active {
  color: #fff8ea;
}

.fab-icon {
  display: flex;
  width: 1.35rem;
  height: 1.35rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.055);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.fab-icon-primary {
  background: linear-gradient(135deg, #d1b26f, #f3d99d);
  color: #22180c;
  box-shadow:
    inset 0 1px 0 rgba(255, 248, 232, 0.34),
    0 0 14px rgba(209, 178, 111, 0.24);
}

.fab-label {
  font-size: 0.62rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
}

@media (max-width: 380px) {
  .fab-island {
    transform-origin: center bottom;
    transform: scale(0.94);
  }

  .fab-label {
    font-size: 0.58rem;
  }
}
</style>
