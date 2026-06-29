<script setup lang="ts">
import { computed } from "vue"
import { getDifficultyLabel } from "@/utils/puzzleLabels"
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

const routeDots = computed(() => Array.from({ length: props.route.chapterCount }, (_, index) => index))
const visibleTags = computed(() => props.route.taglines.slice(0, 2))
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
        <text class="mission-time">{{ route.estimatedMinutes }} 分钟</text>
      </view>

      <view class="mission-plate">
        <view class="plate-copy">
          <text class="mission-kicker">{{ route.theme }} / {{ getDifficultyLabel(route.difficultyLevel) }}</text>
          <text class="mission-title">{{ route.title }}</text>
        </view>
        <view class="mission-seal">{{ route.persona.avatar }}</view>
      </view>

      <view class="route-strip">
        <view v-for="dot in routeDots" :key="dot" class="route-dot" :class="{ 'is-first': dot === 0 }"></view>
      </view>

      <view class="mission-bottom">
        <view class="mission-start">
          <text class="metric-label">起点</text>
          <text class="mission-meta-value">{{ route.startLocation }}</text>
        </view>
        <view class="mission-stats">
          <text>{{ route.taskKind === "family_adventure" ? "亲子探索" : route.taskKind === "story_detective" ? "剧情推理" : "深度推理" }}</text>
          <text>{{ route.chapterCount }} 站</text>
        </view>
      </view>

      <view class="chip-row mission-tags">
        <text v-if="showResume || status === 'in-progress'" class="chip is-active">继续探索</text>
        <text v-else-if="status === 'completed'" class="chip is-active">已通关</text>
        <text class="chip is-active">{{ route.recommendedAgeBand }}</text>
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
  padding: 20rpx 22rpx 22rpx;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 28rpx;
  background:
    radial-gradient(circle at 88% 10%, rgba(209, 178, 111, 0.16), transparent 26%),
    linear-gradient(180deg, rgba(28, 29, 32, 0.98), rgba(14, 16, 20, 0.98));
  box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.24);
}

.mission-card.is-in-progress {
  border-color: rgba(243, 217, 157, 0.28);
  background:
    radial-gradient(circle at 88% 10%, rgba(243, 217, 157, 0.18), transparent 26%),
    linear-gradient(180deg, rgba(45, 38, 26, 0.98), rgba(16, 17, 20, 0.98));
}

.mission-card.is-completed {
  border-color: rgba(159, 216, 175, 0.22);
}

.mission-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.mission-status,
.mission-time {
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

.mission-time {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(247, 239, 221, 0.62);
}

.mission-plate,
.mission-bottom {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
}

.plate-copy {
  flex: 1;
  min-width: 0;
  padding-top: 12rpx;
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
  line-height: 1.16;
  font-weight: 900;
}

.mission-seal {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60rpx;
  height: 60rpx;
  border-radius: 18rpx;
  background: rgba(209, 178, 111, 0.14);
  color: #fff8ea;
  font-size: 26rpx;
  font-weight: 900;
}

.route-strip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin: 18rpx 0 16rpx;
  padding: 10rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.04);
}

.route-dot {
  flex: 1;
  height: 6rpx;
  border-radius: 999rpx;
  background: rgba(247, 239, 221, 0.12);
}

.route-dot.is-first {
  background: linear-gradient(90deg, #d1b26f, #f2d999);
}

.mission-start {
  flex: 1;
  min-width: 0;
}

.mission-meta-value {
  display: block;
  margin-top: 4rpx;
  overflow: hidden;
  color: #fff8ea;
  font-size: 24rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mission-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
  color: rgba(247, 239, 221, 0.68);
  font-size: 21rpx;
  font-weight: 800;
}

.mission-tags {
  margin-top: 14rpx;
  gap: 8rpx;
}

.mission-tags :deep(.chip) {
  min-height: 42rpx;
  padding: 0 14rpx;
  font-size: 20rpx;
}
</style>
