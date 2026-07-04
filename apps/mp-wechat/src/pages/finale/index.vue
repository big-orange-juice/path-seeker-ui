<script setup lang="ts">
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"
import { getDifficultyLabel } from "@/utils/puzzleLabels"

const missionStore = useMissionStore()

function backToArchive() {
  uni.redirectTo({ url: MINI_ROUTES.archive })
}

async function replayMission() {
  if (!missionStore.activeMission) {
    return
  }

  const session = await missionStore.replayMission(missionStore.activeMission.id)
  if (!session) {
    return
  }

  uni.redirectTo({ url: missionStore.activeMission.prologue.length ? MINI_ROUTES.prologue : MINI_ROUTES.chapterMap })
}
</script>

<template>
  <PageScaffold title="任务完成">
    <view v-if="missionStore.activeMission && missionStore.activeSession" class="content-stack bottom-safe">
      <view class="finish-card">
        <text v-if="missionStore.activeMission.rewardTitle" class="eyebrow">{{ missionStore.activeMission.rewardTitle }}</text>
        <text class="display-title finish-title">{{ missionStore.activeMission.title }}</text>
      </view>

      <view class="panel score-card">
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
            <text class="metric-label">难度</text>
            <text class="metric-value">{{ getDifficultyLabel(missionStore.activeMission.difficultyLevel) }}</text>
          </view>
        </view>
      </view>

      <view class="button-row">
        <button class="secondary-button" @click="backToArchive">看记录</button>
        <button class="primary-button" @click="replayMission">重新开始</button>
      </view>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.finish-card,
.score-card {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 28rpx;
}

.finish-card {
  border: 1px solid rgba(209, 178, 111, 0.26);
  border-radius: 30rpx;
  background: linear-gradient(180deg, rgba(38, 34, 27, 0.98), rgba(14, 16, 20, 0.98));
}

.finish-title {
  display: block;
}

.finale-grid {
  margin-top: 2rpx;
}
</style>
