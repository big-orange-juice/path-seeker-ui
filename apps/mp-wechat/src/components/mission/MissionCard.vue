<script setup lang="ts">
import { computed } from "vue"
import type { MissionRouteCard } from "@/types/mission"

interface Props {
  route: MissionRouteCard
  showResume?: boolean
  status?: "available" | "in-progress" | "completed"
}

const props = withDefaults(defineProps<Props>(), {
  showResume: false,
  status: "available",
})

const emit = defineEmits<{
  open: [routeId: string]
}>()

const visibleTags = computed(() => props.route.taglines.slice(0, 1))
const metaItems = computed(() => [
  props.route.theme,
  props.route.difficultyLevel,
  props.route.puzzleCount ? `${props.route.puzzleCount} 题` : "",
  props.route.totalScore ? `${props.route.totalScore} 分` : "",
].filter(Boolean))
const statusLabel = computed(() => {
  if (props.status === "in-progress") {
    return "进行中"
  }

  if (props.status === "completed") {
    return "已完成"
  }

  return "可进入"
})
</script>

<template>
  <button class="card-button" hover-class="card-button-hover" @click="emit('open', route.id)">
    <view class="mission-card" :class="`is-${status}`">
      <view class="mission-top">
        <text class="mission-status">{{ statusLabel }}</text>
        <text v-if="route.estimatedMinutes" class="mission-time">{{ route.estimatedMinutes }} 分钟</text>
      </view>

      <text v-if="route.theme" class="mission-kicker">{{ route.theme }}</text>
      <text class="mission-title">{{ route.title }}</text>
      <text v-if="route.summary" class="muted-copy mission-summary">{{ route.summary }}</text>

      <view v-if="metaItems.length" class="meta-row">
        <text v-for="item in metaItems" :key="item" class="meta-pill">{{ item }}</text>
      </view>

      <view v-if="showResume || status !== 'available' || visibleTags.length" class="chip-row mission-tags">
        <text v-if="showResume || status === 'in-progress'" class="chip is-active">继续</text>
        <text v-else-if="status === 'completed'" class="chip is-active">已完成</text>
        <text v-for="tag in visibleTags" :key="tag" class="chip">{{ tag }}</text>
      </view>
    </view>
  </button>
</template>

<style scoped lang="scss">
.card-button {
  display: block;
  width: 100%;
  overflow: hidden;
  border: 0;
  border-radius: 28rpx;
  background: transparent;
  text-align: left;
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.card-button-hover {
  transform: scale(0.985);
  opacity: 0.96;
}

.card-button::after {
  border: 0;
}

.mission-card {
  position: relative;
  overflow: hidden;
  padding: 22rpx;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 28rpx;
  background: linear-gradient(180deg, rgba(28, 29, 32, 0.98), rgba(14, 16, 20, 0.98));
  box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.24);
}

.mission-card.is-in-progress {
  border-color: rgba(243, 217, 157, 0.28);
  background: linear-gradient(180deg, rgba(45, 38, 26, 0.98), rgba(16, 17, 20, 0.98));
}

.mission-card.is-completed {
  border-color: rgba(159, 216, 175, 0.22);
}

.mission-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 14rpx;
}

.mission-status,
.mission-time,
.meta-pill {
  display: inline-flex;
  align-items: center;
  min-height: 42rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 900;
}

.mission-status {
  background: rgba(209, 178, 111, 0.14);
  color: #f3d99d;
}

.mission-time,
.meta-pill {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(247, 239, 221, 0.62);
}

.mission-kicker {
  color: #d1b26f;
  font-size: 21rpx;
  font-weight: 800;
}

.mission-title {
  display: block;
  margin-top: 8rpx;
  color: #fff8ea;
  font-size: 34rpx;
  line-height: 1.18;
  font-weight: 900;
}

.mission-summary {
  display: block;
  margin-top: 10rpx;
}

.meta-row,
.mission-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 16rpx;
}

.mission-tags :deep(.chip) {
  min-height: 42rpx;
  padding: 0 14rpx;
  font-size: 20rpx;
}
</style>
