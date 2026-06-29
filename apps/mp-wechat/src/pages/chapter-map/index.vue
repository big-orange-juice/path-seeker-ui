<script setup lang="ts">
import { computed } from "vue"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"
import { getPuzzleTypeAction, getPuzzleTypeGlyph, getPuzzleTypeLabel } from "@/utils/puzzleLabels"

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
  <PageScaffold title="任务路线">
    <view v-if="missionStore.activeMission && missionStore.activeSession" class="content-stack bottom-safe">
      <view class="map-board">
        <view class="map-board-head">
          <view>
            <text class="eyebrow">路线进度 {{ currentStepLabel }}</text>
            <text class="display-title map-title">{{ missionStore.currentChapter?.targetLocation }}</text>
          </view>
          <view class="progress-ring">
            <text class="progress-value">{{ missionStore.progressPercent }}%</text>
            <text class="progress-label">完成</text>
          </view>
        </view>

        <view class="map-path">
          <view
            v-for="chapter in chapterStatuses"
            :key="chapter.id"
            class="waypoint"
            :class="{ 'is-active': chapter.active, 'is-solved': chapter.solved }"
          >
            <view class="waypoint-pin">{{ chapter.solved ? '✓' : getPuzzleTypeGlyph(chapter.puzzle.templateType) }}</view>
            <view class="waypoint-copy">
              <text class="waypoint-title text-clip-1">{{ chapter.stageNo }}. {{ chapter.targetLocation }}</text>
              <text class="waypoint-type">{{ getPuzzleTypeLabel(chapter.puzzle.templateType) }} · {{ getPuzzleTypeAction(chapter.puzzle.templateType) }}</text>
            </view>
            <text v-if="chapter.active" class="waypoint-state">现在</text>
            <text v-else-if="chapter.solved" class="waypoint-state muted">完成</text>
          </view>
        </view>
      </view>

      <view v-if="missionStore.unlockedClueTitles.length" class="panel clue-dock">
        <text class="section-title">线索袋</text>
        <view class="chip-row clue-row">
          <text v-for="clue in missionStore.unlockedClueTitles" :key="clue" class="chip is-active">{{ clue }}</text>
        </view>
      </view>

      <view class="next-card panel">
        <text class="eyebrow">当前任务</text>
        <text class="section-title">{{ missionStore.currentChapter?.objective }}</text>
        <button class="primary-button" @click="goArtifact">开始观察</button>
      </view>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.map-board {
  overflow: hidden;
  padding: 28rpx;
  border: 1px solid rgba(209, 178, 111, 0.26);
  border-radius: 38rpx;
  background:
    radial-gradient(circle at 12% 8%, rgba(209, 178, 111, 0.2), transparent 28%),
    radial-gradient(circle at 88% 92%, rgba(243, 217, 157, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(31, 30, 28, 0.98), rgba(13, 15, 19, 0.98));
}

.map-board-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.map-title {
  display: block;
  margin-top: 10rpx;
  font-size: 42rpx;
}

.progress-ring {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 96rpx;
  height: 96rpx;
  border-radius: 999rpx;
  border: 1px solid rgba(209, 178, 111, 0.42);
  background: rgba(209, 178, 111, 0.12);
  color: #fff8ea;
}

.progress-value {
  font-size: 25rpx;
  font-weight: 900;
}

.progress-label {
  margin-top: 2rpx;
  color: rgba(247, 239, 221, 0.58);
  font-size: 18rpx;
  font-weight: 900;
}

.map-path {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 30rpx;
}

.map-path::before {
  content: "";
  position: absolute;
  left: 34rpx;
  top: 42rpx;
  bottom: 42rpx;
  width: 4rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, rgba(209, 178, 111, 0.72), rgba(255, 255, 255, 0.08));
}

.waypoint {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 104rpx;
  padding: 16rpx 16rpx 16rpx 0;
  border-radius: 28rpx;
}

.waypoint.is-active {
  background: rgba(209, 178, 111, 0.14);
  box-shadow: inset 0 0 0 1px rgba(243, 217, 157, 0.12);
}

.waypoint-pin {
  z-index: 1;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  border-radius: 24rpx;
  background: rgba(247, 239, 221, 0.1);
  color: rgba(247, 239, 221, 0.72);
  font-size: 24rpx;
  font-weight: 900;
}

.waypoint.is-active .waypoint-pin,
.waypoint.is-solved .waypoint-pin {
  background: linear-gradient(135deg, #d1b26f, #f3d99d);
  color: #171310;
}

.waypoint-copy {
  flex: 1;
  min-width: 0;
}

.waypoint-title {
  color: #fff8ea;
  font-size: 30rpx;
  font-weight: 900;
}

.waypoint-type {
  display: block;
  margin-top: 8rpx;
  color: rgba(247, 239, 221, 0.58);
  font-size: 23rpx;
  font-weight: 700;
}

.waypoint-state {
  flex: 0 0 auto;
  min-width: 62rpx;
  color: #d1b26f;
  font-size: 22rpx;
  font-weight: 900;
  text-align: right;
}

.waypoint-state.muted {
  color: rgba(247, 239, 221, 0.42);
}

.clue-dock,
.next-card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 26rpx;
}

.next-card {
  border-color: rgba(209, 178, 111, 0.2);
}

.next-card .primary-button {
  margin-top: 6rpx;
}
</style>
