<script setup lang="ts">
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"

const missionStore = useMissionStore()

function backToArchive() {
  missionStore.setShellTab("archive")
  uni.reLaunch({ url: MINI_ROUTES.shell })
}

function replayMission() {
  if (!missionStore.activeMission) {
    return
  }

  missionStore.replayMission(missionStore.activeMission.id)
  uni.redirectTo({ url: MINI_ROUTES.prologue })
}
</script>

<template>
  <PageScaffold title="任务完成">
    <view v-if="missionStore.activeMission && missionStore.activeSession" class="content-stack">
      <view class="panel glow-banner section-pad finale-hero">
        <text class="eyebrow">{{ missionStore.activeMission.rewardTitle }}</text>
        <text class="display-title">{{ missionStore.activeMission.finale.title }}</text>
        <text class="body-copy">{{ missionStore.activeMission.finale.truth }}</text>
      </view>

      <view class="panel section-pad score-card">
        <text class="section-title">成绩</text>
        <view class="metric-grid finale-grid">
          <view class="metric-cell">
            <text class="metric-label">总分</text>
            <text class="metric-value">{{ missionStore.activeSession.totalScore }}</text>
          </view>
          <view class="metric-cell">
            <text class="metric-label">完成</text>
            <text class="metric-value">{{ missionStore.activeSession.solvedChapterIds.length }}/{{ missionStore.activeMission.chapterCount }}</text>
          </view>
          <view class="metric-cell">
            <text class="metric-label">称号</text>
            <text class="metric-value title-value">{{ missionStore.activeMission.rewardTitle }}</text>
          </view>
          <view class="metric-cell">
            <text class="metric-label">同行</text>
            <text class="metric-value">{{ missionStore.activeSession.selectedAgeBand }}</text>
          </view>
        </view>
      </view>

      <view class="panel section-pad route-line">
        <view v-for="note in missionStore.activeMission.finale.knowledgeNotes" :key="note" class="route-line-item">
          <text class="muted-copy">{{ note }}</text>
        </view>
      </view>

      <view class="button-row">
        <button class="secondary-button" @click="backToArchive">看收获</button>
        <button class="primary-button" @click="replayMission">再玩一次</button>
      </view>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.finale-hero,
.score-card {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.finale-grid {
  margin-top: 2rpx;
}

.title-value {
  font-size: 24rpx;
  line-height: 1.28;
}
</style>
