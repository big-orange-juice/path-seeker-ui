<script setup lang="ts">
import { computed } from "vue"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"
import { getPuzzleTypeLabel } from "@/utils/puzzleLabels"

const missionStore = useMissionStore()

const chapterStatuses = computed(() => {
  if (!missionStore.activeMission || !missionStore.activeSession) {
    return []
  }

  return missionStore.activeMission.chapters.map((chapter, index) => ({
    ...chapter,
    solved: missionStore.activeSession?.solvedChapterIds.includes(chapter.id),
    active: missionStore.activeSession?.currentChapterIndex === index,
  }))
})

const currentStepLabel = computed(() => {
  if (!missionStore.activeSession || !missionStore.activeMission) {
    return ""
  }

  return `${missionStore.activeSession.currentChapterIndex + 1} / ${missionStore.activeMission.chapterCount}`
})

function goArtifact() {
  uni.redirectTo({ url: MINI_ROUTES.artifactClue })
}
</script>

<template>
  <PageScaffold title="查看任务">
    <view v-if="missionStore.activeMission && missionStore.activeSession" class="content-stack bottom-safe">
      <view class="current-card">
        <view class="current-head">
          <view>
            <text class="eyebrow">{{ currentStepLabel }}</text>
            <text class="display-title current-title">{{ missionStore.currentChapter?.title }}</text>
          </view>
          <view class="progress-pill">{{ missionStore.progressPercent }}%</view>
        </view>
        <text v-if="missionStore.currentChapter?.targetLocation" class="body-copy current-copy">{{ missionStore.currentChapter.targetLocation }}</text>
        <text v-if="missionStore.currentPuzzle" class="type-copy">{{ getPuzzleTypeLabel(missionStore.currentPuzzle.templateType, missionStore.currentPuzzle.interactionType) }}</text>
        <button class="primary-button current-button" @click="goArtifact">进入当前节点</button>
      </view>

      <view v-if="chapterStatuses.length" class="panel stage-board">
        <button
          v-for="chapter in chapterStatuses"
          :key="chapter.id"
          class="stage-row"
          :class="{ 'is-active': chapter.active, 'is-solved': chapter.solved }"
          hover-class="stage-row-hover"
          @click="chapter.active && goArtifact()">
          <text class="stage-dot">{{ chapter.solved ? '✓' : chapter.stageNo }}</text>
          <view class="stage-copy">
            <text class="stage-title text-clip-1">{{ chapter.title }}</text>
            <text v-if="chapter.targetLocation" class="muted-copy text-clip-1">{{ chapter.targetLocation }}</text>
          </view>
          <text class="stage-state">{{ chapter.active ? '当前' : chapter.solved ? '完成' : '' }}</text>
        </button>
      </view>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.current-card {
  padding: 30rpx;
  border: 1px solid rgba(209, 178, 111, 0.26);
  border-radius: 30rpx;
  background: linear-gradient(180deg, rgba(38, 34, 27, 0.98), rgba(14, 16, 20, 0.98));
}

.current-head,
.stage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.current-title,
.current-copy,
.type-copy {
  display: block;
  margin-top: 14rpx;
}

.type-copy {
  color: rgba(247, 239, 221, 0.58);
  font-size: 23rpx;
  font-weight: 800;
}

.progress-pill {
  flex: 0 0 auto;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.16);
  color: #f3d99d;
  font-size: 22rpx;
  font-weight: 900;
}

.current-button {
  margin-top: 24rpx;
}

.stage-board {
  display: flex;
  flex-direction: column;
  padding: 12rpx 22rpx;
}

.stage-row {
  width: 100%;
  min-height: 88rpx;
  padding: 14rpx 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: #fff8ea;
  text-align: left;
}

.stage-row:last-child {
  border-bottom: 0;
}

.stage-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 48rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(247, 239, 221, 0.7);
  font-size: 20rpx;
  font-weight: 900;
}

.stage-row.is-active .stage-dot,
.stage-row.is-solved .stage-dot {
  background: linear-gradient(135deg, #d1b26f, #f3d99d);
  color: #171310;
}

.stage-copy {
  flex: 1;
  min-width: 0;
}

.stage-title {
  color: #fff8ea;
  font-size: 27rpx;
  font-weight: 900;
}

.stage-state {
  min-width: 58rpx;
  color: #d1b26f;
  font-size: 21rpx;
  font-weight: 900;
  text-align: right;
}
</style>
