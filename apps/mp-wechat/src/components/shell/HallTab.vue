<script setup lang="ts">
import MissionCard from "@/components/mission/MissionCard.vue"
import type { DifficultyLevel, MissionRouteCard } from "@/types/mission"

interface Props {
  routes: MissionRouteCard[]
  filters: {
    difficulty: DifficultyLevel | "all"
  }
  coverage: {
    difficulties: number
    missionCount: number
  }
}

defineProps<Props>()

const emit = defineEmits<{
  open: [routeId: string]
  "filter-difficulty": [value: DifficultyLevel | "all"]
}>()

const difficultyFilters: Array<{ label: string; value: DifficultyLevel | "all" }> = [
  { label: "不限", value: "all" },
  { label: "轻松", value: "L1" },
  { label: "进阶", value: "L2" },
  { label: "挑战", value: "L3" },
]
</script>

<template>
  <view class="content-stack bottom-safe">
    <view class="hall-hero">
      <text class="display-title hall-title">选择任务</text>
    </view>

    <view class="filter-board panel">
      <view class="filter-inline">
        <text class="filter-label">难度</text>
        <scroll-view class="filter-scroll" scroll-x enable-flex show-scrollbar="false">
          <view class="filter-options">
            <button
              v-for="item in difficultyFilters"
              :key="item.value"
              class="filter-pill"
              :class="{ 'is-active': filters.difficulty === item.value }"
              @click="emit('filter-difficulty', item.value)"
            >
              {{ item.label }}
            </button>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="route-list">
      <MissionCard v-for="route in routes" :key="route.id" :route="route" @open="emit('open', $event)" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.hall-hero {
  padding: 6rpx 4rpx 0;
}

.hall-title {
  font-size: 40rpx;
  line-height: 1.1;
}

.filter-board {
  padding: 14rpx 16rpx;
  border-radius: 24rpx;
}

.filter-inline {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.filter-label {
  flex: 0 0 auto;
  color: rgba(247, 239, 221, 0.56);
  font-size: 22rpx;
  font-weight: 800;
}

.filter-scroll {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}

.filter-options {
  display: inline-flex;
  gap: 8rpx;
}

.filter-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.045);
  color: rgba(247, 239, 221, 0.68);
  font-size: 21rpx;
  font-weight: 800;
  white-space: nowrap;
}

.filter-pill.is-active {
  background: linear-gradient(135deg, rgba(209, 178, 111, 0.28), rgba(209, 178, 111, 0.12));
  color: #fff8ea;
}

.route-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
</style>
