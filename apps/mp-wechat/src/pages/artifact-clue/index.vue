<script setup lang="ts">
import { computed } from "vue"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"
import { getPuzzleTypeGlyph, getPuzzleTypeLabel } from "@/utils/puzzleLabels"
import { toSingleSentence } from "@/utils/copy"

const missionStore = useMissionStore()
const artifactStory = computed(() => toSingleSentence(missionStore.currentArtifact?.storyFragment || ""))

function goPuzzle() {
  uni.redirectTo({ url: MINI_ROUTES.puzzle })
}
</script>

<template>
  <PageScaffold title="先观察">
    <view v-if="missionStore.currentArtifact && missionStore.currentChapter" class="content-stack bottom-safe">
      <view class="artifact-card">
        <text class="eyebrow">{{ missionStore.currentChapter.targetLocation }}</text>
        <text class="display-title artifact-title">{{ missionStore.currentArtifact.title }}</text>
        <text class="body-copy artifact-copy">{{ artifactStory }}</text>
        <view v-if="missionStore.currentPuzzle" class="play-chip">
          <text>{{ getPuzzleTypeGlyph(missionStore.currentPuzzle.templateType) }}</text>
          <text>{{ getPuzzleTypeLabel(missionStore.currentPuzzle.templateType) }}</text>
        </view>
      </view>

      <view class="look-grid">
        <view class="panel look-card primary">
          <text class="look-label">看哪里</text>
          <text class="look-copy">{{ toSingleSentence(missionStore.currentArtifact.detailCallout) }}</text>
        </view>
        <view class="panel look-card">
          <text class="look-label">留意</text>
          <text class="look-copy">{{ toSingleSentence(missionStore.currentArtifact.suspiciousPoint) }}</text>
        </view>
      </view>

      <view class="panel story-card">
        <text class="eyebrow">提示</text>
        <text class="section-title">{{ missionStore.currentArtifact.observationPoint }}</text>
      </view>

      <view class="panel checklist-card">
        <text class="section-title">对照展品</text>
        <view class="checklist-row">
          <text v-for="item in missionStore.currentArtifact.checklist" :key="item" class="check-pill">{{ item }}</text>
        </view>
      </view>

      <button class="primary-button" @click="goPuzzle">我看好了</button>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.artifact-card {
  padding: 30rpx;
  border: 1px solid rgba(209, 178, 111, 0.26);
  border-radius: 34rpx;
  background:
    radial-gradient(circle at 84% 10%, rgba(209, 178, 111, 0.22), transparent 28%),
    linear-gradient(180deg, rgba(38, 34, 27, 0.98), rgba(14, 16, 20, 0.98));
}

.artifact-title {
  display: block;
  margin-top: 12rpx;
}

.artifact-copy {
  display: block;
  margin-top: 14rpx;
}

.play-chip {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 22rpx;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.16);
  color: #fff8ea;
  font-size: 22rpx;
  font-weight: 900;
}

.look-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.look-card,
.checklist-card,
.story-card {
  padding: 22rpx;
}

.look-card.primary {
  border-color: rgba(209, 178, 111, 0.26);
}

.look-label {
  color: #d1b26f;
  font-size: 22rpx;
  font-weight: 900;
}

.look-copy {
  display: block;
  margin-top: 12rpx;
  color: #fff8ea;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1.38;
}

.story-card,
.checklist-card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.checklist-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.check-pill {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.055);
  color: rgba(247, 239, 221, 0.76);
  font-size: 22rpx;
  font-weight: 800;
}
</style>
