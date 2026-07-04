<script setup lang="ts">
import { computed } from "vue"
import { onShow } from "@dcloudio/uni-app"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import MissionCard from "@/components/mission/MissionCard.vue"
import { useRemoteRouteCards } from "@/composables/useRemoteRouteCards"
import { DIFFICULTY_OPTIONS } from "@/mock/schema"
import { useMissionStore } from "@/stores/useMissionStore"
import { requireAuthForTab } from "@/utils/authGuard"
import { MINI_ROUTES, withQuery } from "@/utils/navigation"

const missionStore = useMissionStore()

const {
  routes: remoteRoutes,
  pending: remotePending,
  error: remoteError,
  total: remoteTotal,
} = useRemoteRouteCards(() => missionStore.filters)

const displayRoutes = computed(() => remoteRoutes.value)
const routeSummary = computed(() => `${remoteTotal.value || displayRoutes.value.length} 条任务`)

function openRoute(routeId: string) {
  uni.navigateTo({
    url: withQuery(MINI_ROUTES.taskDetail, { routeId }),
  })
}

function continueMission() {
  const session = missionStore.activeSession

  if (!session) {
    return
  }

  if (session.latestChapterResult) {
    const path = session.latestChapterResult.finalChapter ? MINI_ROUTES.finale : MINI_ROUTES.chapterResult
    uni.redirectTo({ url: path })
    return
  }

  const path = session.status === "completed" ? MINI_ROUTES.finale : MINI_ROUTES.chapterMap
  uni.redirectTo({ url: path })
}

function getRouteStatus(routeId: string) {
  if (routeId === missionStore.activeSession?.routeId) {
    return "in-progress" as const
  }

  if (missionStore.archiveEntries.some((item) => item.routeId === routeId)) {
    return "completed" as const
  }

  return "available" as const
}

onShow(() => {
  requireAuthForTab()
  void missionStore.restoreActiveMission()
})
</script>

<template>
  <PageScaffold title="任务大厅" :show-back="false">
    <view class="content-stack bottom-safe home-stack">
      <view class="panel filter-panel">
        <view class="filter-head">
          <text class="section-title">筛选任务</text>
          <text class="muted-copy">{{ routeSummary }}</text>
        </view>

        <view class="filter-group">
          <text class="metric-label">难度</text>
          <view class="chip-row">
            <button
              class="filter-chip"
              :class="{ 'is-active': missionStore.filters.difficulty === 'all' }"
              @click="missionStore.setFilters({ difficulty: 'all' })">
              全部
            </button>
            <button
              v-for="option in DIFFICULTY_OPTIONS"
              :key="option.value"
              class="filter-chip"
              :class="{ 'is-active': missionStore.filters.difficulty === option.value }"
              @click="missionStore.setFilters({ difficulty: option.value })">
              {{ option.label }}
            </button>
          </view>
        </view>
      </view>

      <button
        v-if="missionStore.activeMission && missionStore.activeSession"
        class="secondary-button continue-button"
        @click="continueMission">
        继续当前任务
      </button>

      <view v-if="remoteError" class="panel notice-card">
        <text class="notice-copy">{{ remoteError }}</text>
      </view>

      <view v-if="remotePending && !displayRoutes.length" class="panel state-card">
        <text class="section-title">正在同步任务列表</text>
        <text class="muted-copy">稍等一下，马上把接口任务拉下来。</text>
      </view>

      <view v-else-if="displayRoutes.length" class="route-list">
        <MissionCard
          v-for="route in displayRoutes"
          :key="route.id"
          :route="route"
          :show-resume="route.id === missionStore.activeSession?.routeId"
          :status="getRouteStatus(route.id)"
          @open="openRoute" />
      </view>

      <view v-else class="panel state-card">
        <text class="section-title">当前没有可进入任务</text>
        <text class="muted-copy">可以切换筛选条件，或者稍后再看新路线。</text>
      </view>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.home-stack {
  padding-top: 24rpx;
}

.filter-panel,
.notice-card,
.state-card {
  padding: 28rpx;
}

.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.filter-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.continue-button {
  min-height: 76rpx;
  font-size: 28rpx;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04) !important;
  color: rgba(247, 239, 221, 0.74);
  font-size: 24rpx;
  font-weight: 800;
}

.filter-chip.is-active {
  border-color: rgba(209, 178, 111, 0.52);
  background: rgba(209, 178, 111, 0.16) !important;
  color: #fff8ea;
}

.notice-card {
  border-color: rgba(209, 178, 111, 0.2);
  background: rgba(209, 178, 111, 0.08);
}

.notice-copy {
  color: rgba(255, 241, 207, 0.88);
  font-size: 24rpx;
  line-height: 1.5;
}

.state-card {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.route-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
</style>
