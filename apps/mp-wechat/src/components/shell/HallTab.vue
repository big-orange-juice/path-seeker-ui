<script setup lang="ts">
import MuseumOverviewMap from "@/components/shell/MuseumOverviewMap.vue"
import MissionCard from "@/components/mission/MissionCard.vue"
import type { AgeBand, DifficultyLevel, MissionRouteCard, TaskKind } from "@/types/mission"

interface Props {
  routes: MissionRouteCard[]
  activeRouteId?: string | null
  completedRouteIds?: string[]
  filters: {
    ageBand: AgeBand | "all"
    difficulty: DifficultyLevel | "all"
    taskKind: TaskKind | "all"
  }
  coverage: {
    ageBands: number
    difficulties: number
    taskKinds: number
    missionCount: number
  }
}

defineProps<Props>()

const emit = defineEmits<{
  open: [routeId: string]
  "filter-age-band": [value: AgeBand | "all"]
  "filter-difficulty": [value: DifficultyLevel | "all"]
  "filter-task-kind": [value: TaskKind | "all"]
}>()

const ageFilters: Array<{ label: string; value: AgeBand | "all" }> = [
  { label: "不限年龄", value: "all" },
  { label: "6-10", value: "6-10" },
  { label: "10-15", value: "10-15" },
  { label: "15+", value: "15+" },
]

const difficultyFilters: Array<{ label: string; value: DifficultyLevel | "all" }> = [
  { label: "不限", value: "all" },
  { label: "轻松", value: "L1" },
  { label: "进阶", value: "L2" },
  { label: "挑战", value: "L3" },
]

const taskKindFilters: Array<{ label: string; value: TaskKind | "all" }> = [
  { label: "全部玩法", value: "all" },
  { label: "亲子冒险", value: "family_adventure" },
  { label: "剧情推理", value: "story_detective" },
  { label: "深度推理", value: "deep_reasoning" },
]
</script>

<template>
  <view class="content-stack bottom-safe">
    <view class="hall-hero">
      <text class="eyebrow">总地图</text>
      <text class="display-title hall-title">从馆内挑路线</text>
    </view>

    <view class="panel map-panel">
      <MuseumOverviewMap
        :routes="routes"
        :active-route-id="activeRouteId"
        :completed-route-ids="completedRouteIds"
        @open="emit('open', $event)"
      />
    </view>

    <view class="filter-board panel">
      <view class="filter-summary">
        <text class="section-title">筛选</text>
        <text class="route-count">{{ coverage.missionCount }} 条</text>
      </view>

      <view class="filter-inline">
        <text class="filter-label">年龄</text>
        <scroll-view class="filter-scroll" scroll-x enable-flex show-scrollbar="false">
          <view class="filter-options">
            <button
              v-for="item in ageFilters"
              :key="item.value"
              class="filter-pill"
              :class="{ 'is-active': filters.ageBand === item.value }"
              @click="emit('filter-age-band', item.value)"
            >
              {{ item.label }}
            </button>
          </view>
        </scroll-view>
      </view>

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

      <view class="filter-inline">
        <text class="filter-label">玩法</text>
        <scroll-view class="filter-scroll" scroll-x enable-flex show-scrollbar="false">
          <view class="filter-options">
            <button
              v-for="item in taskKindFilters"
              :key="item.value"
              class="filter-pill"
              :class="{ 'is-active': filters.taskKind === item.value }"
              @click="emit('filter-task-kind', item.value)"
            >
              {{ item.label }}
            </button>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="route-head">
      <view>
        <text class="section-title">任务清单</text>
      </view>
      <text class="route-count">{{ routes.length }} 条</text>
    </view>

    <view class="route-list">
      <MissionCard
        v-for="route in routes"
        :key="route.id"
        :route="route"
        :status="activeRouteId === route.id ? 'in-progress' : completedRouteIds?.includes(route.id) ? 'completed' : 'available'"
        @open="emit('open', $event)"
      />
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

.map-panel,
.filter-board {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 18rpx;
}

.filter-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
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

.route-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18rpx;
  padding: 0 4rpx;
}

.route-count {
  color: rgba(247, 239, 221, 0.46);
  font-size: 22rpx;
  font-weight: 900;
}

.route-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
</style>
