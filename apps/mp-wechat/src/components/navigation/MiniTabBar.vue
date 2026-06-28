<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from "vue"
import { gsap } from "gsap"
import type { ShellTab } from "@/types/mission"

interface TabItem {
  label: string
  value: ShellTab
  accent: string
}

interface Props {
  modelValue: ShellTab
  canOpenMap?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canOpenMap: false,
})

const emit = defineEmits<{
  "update:modelValue": [value: ShellTab]
  "open-map": []
}>()

const items: TabItem[] = [
  { label: "任务", value: "hall", accent: "任" },
  { label: "继续", value: "playing", accent: "走" },
  { label: "收获", value: "archive", accent: "奖" },
]

const TAB_WIDTH = 142
const MAP_WIDTH = 128
const ITEM_HEIGHT = 72
const GAP = 10
const PAD = 8

const activeIndex = computed(() => Math.max(items.findIndex((item) => item.value === props.modelValue), 0))
const isExpanded = shallowRef(false)
const expandedProgress = shallowRef(0)
const tweenState = { progress: 0 }
let expandTween: gsap.core.Tween | null = null

function getExpandedWidth() {
  const tabGaps = items.length - 1
  const mapWidth = props.canOpenMap ? MAP_WIDTH + GAP : 0
  return items.length * TAB_WIDTH + tabGaps * GAP + mapWidth + PAD * 2
}

function animateProgress(target: number) {
  expandTween?.kill()
  expandTween = gsap.to(tweenState, {
    progress: target,
    duration: 0.42,
    ease: target ? "power3.out" : "power3.inOut",
    overwrite: true,
    onUpdate: () => {
      expandedProgress.value = tweenState.progress
    },
    onComplete: () => {
      expandedProgress.value = target
      tweenState.progress = target
    },
  })
}

function collapse() {
  isExpanded.value = false
  animateProgress(0)
}

function expand() {
  isExpanded.value = true
  animateProgress(1)
}

function handleTabClick(value: ShellTab) {
  if (!isExpanded.value) {
    if (value === props.modelValue) {
      expand()
      return
    }

    emit("update:modelValue", value)
    return
  }

  emit("update:modelValue", value)
  collapse()
}

function handleMapClick() {
  if (!isExpanded.value) {
    expand()
    return
  }

  emit("open-map")
  collapse()
}

watch(
  () => [props.modelValue, props.canOpenMap],
  () => {
    if (!isExpanded.value) {
      tweenState.progress = 0
      expandedProgress.value = 0
      return
    }

    animateProgress(1)
  },
)

onUnmounted(() => {
  expandTween?.kill()
})

const islandStyle = computed(() => {
  const progress = expandedProgress.value
  const collapsedWidth = TAB_WIDTH + PAD * 2
  const width = collapsedWidth + (getExpandedWidth() - collapsedWidth) * progress

  return {
    width: `${width}rpx`,
  }
})

const indicatorStyle = computed(() => {
  const progress = expandedProgress.value
  const expandedX = PAD + activeIndex.value * (TAB_WIDTH + GAP)
  const x = PAD + (expandedX - PAD) * progress

  return {
    width: `${TAB_WIDTH}rpx`,
    height: `${ITEM_HEIGHT}rpx`,
    transform: `translateX(${x}rpx)`,
  }
})

function getTabStyle(index: number) {
  const progress = expandedProgress.value
  const isActive = index === activeIndex.value
  const visibleProgress = isActive ? 1 : progress
  const hasTrailingGap = index < items.length - 1 || props.canOpenMap

  return {
    width: `${TAB_WIDTH * visibleProgress}rpx`,
    minWidth: `${TAB_WIDTH * visibleProgress}rpx`,
    height: `${ITEM_HEIGHT}rpx`,
    marginRight: `${hasTrailingGap ? GAP * progress : 0}rpx`,
    opacity: String(visibleProgress),
    transform: `scale(${0.94 + 0.06 * visibleProgress})`,
    pointerEvents: visibleProgress > 0.05 ? "auto" : "none",
  }
}

const mapStyle = computed(() => {
  const progress = props.canOpenMap ? expandedProgress.value : 0

  return {
    width: `${MAP_WIDTH * progress}rpx`,
    minWidth: `${MAP_WIDTH * progress}rpx`,
    height: `${ITEM_HEIGHT}rpx`,
    opacity: String(progress),
    transform: `scale(${0.94 + 0.06 * progress})`,
    pointerEvents: progress > 0.05 ? "auto" : "none",
  }
})
</script>

<template>
  <view class="tabbar-wrap">
    <view class="tabbar floating-card" :class="{ 'is-expanded': isExpanded }" :style="islandStyle">
      <view class="tab-indicator" :style="indicatorStyle"></view>

      <button
        v-for="(item, index) in items"
        :key="item.value"
        class="tab-item"
        :class="{ 'is-active': props.modelValue === item.value }"
        :style="getTabStyle(index)"
        @click="handleTabClick(item.value)"
      >
        <view class="tab-icon">{{ item.accent }}</view>
        <text class="tab-label">{{ item.label }}</text>
      </button>

      <button v-if="canOpenMap" class="map-pill" :style="mapStyle" @click="handleMapClick">
        <view class="map-pill-icon">图</view>
        <text class="map-pill-label">地图</text>
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.tabbar-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  justify-content: center;
  padding: 0 18rpx calc(12rpx + env(safe-area-inset-bottom));
  pointer-events: none;
}

.tabbar {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 88rpx;
  padding: 8rpx;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 999rpx;
  background: linear-gradient(180deg, rgba(16, 17, 20, 0.96), rgba(7, 8, 10, 0.96));
  box-shadow: 0 22rpx 52rpx rgba(0, 0, 0, 0.36);
  pointer-events: auto;
}

.tab-indicator {
  position: absolute;
  left: 0;
  top: 8rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(209, 178, 111, 0.18));
  box-shadow: inset 0 0 0 1px rgba(243, 217, 157, 0.08);
}

.tab-item {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: transparent;
  color: rgba(247, 239, 221, 0.58);
  transform-origin: center center;
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
  width: 36rpx;
  height: 36rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.05);
  color: #d1b26f;
  font-size: 20rpx;
  font-weight: 700;
  flex: 0 0 auto;
}

.tab-item.is-active .tab-icon {
  background: linear-gradient(135deg, rgba(209, 178, 111, 0.46), rgba(209, 178, 111, 0.22));
  color: #fff8ea;
}

.tab-label {
  font-size: 23rpx;
  font-weight: 800;
  white-space: nowrap;
}

.map-pill {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  overflow: hidden;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.04);
  color: #fff8ea;
  transform-origin: center center;
}

.map-pill::after {
  border: 0;
}

.map-pill-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36rpx;
  height: 36rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #d1b26f, #f3d99d);
  color: #171310;
  font-size: 20rpx;
  font-weight: 900;
  flex: 0 0 auto;
}

.map-pill-label {
  font-size: 23rpx;
  font-weight: 800;
  white-space: nowrap;
}
</style>
