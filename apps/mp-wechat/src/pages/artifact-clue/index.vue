<script setup lang="ts">
import { computed } from "vue"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"
import { getPuzzleTypeLabel } from "@/utils/puzzleLabels"
import { toSingleSentence } from "@/utils/copy"

const missionStore = useMissionStore()
const artifactStory = computed(() => toSingleSentence(missionStore.currentArtifact?.storyFragment || ""))
const observeTips = computed(() => {
  const artifact = missionStore.currentArtifact
  if (!artifact) {
    return []
  }

  return [artifact.detailCallout, artifact.observationPoint, artifact.suspiciousPoint].filter(Boolean)
})

function goPuzzle() {
  uni.redirectTo({ url: MINI_ROUTES.puzzle })
}
</script>

<template>
  <PageScaffold title="当前节点">
    <view v-if="missionStore.currentArtifact && missionStore.currentChapter" class="content-stack bottom-safe">
      <view class="artifact-card">
        <text v-if="missionStore.currentArtifact.location" class="eyebrow">{{ missionStore.currentArtifact.location }}</text>
        <text class="display-title artifact-title">{{ missionStore.currentArtifact.title }}</text>
        <text v-if="missionStore.currentArtifact.subtitle" class="body-copy artifact-copy">{{ missionStore.currentArtifact.subtitle }}</text>
        <text v-else-if="artifactStory" class="body-copy artifact-copy">{{ artifactStory }}</text>
        <text v-if="missionStore.currentPuzzle" class="type-copy">
          {{ getPuzzleTypeLabel(missionStore.currentPuzzle.templateType, missionStore.currentPuzzle.interactionType) }}
        </text>
      </view>

      <view v-if="observeTips.length" class="panel tip-card">
        <text class="section-title">观察提示</text>
        <view class="tip-list">
          <text v-for="item in observeTips" :key="item" class="muted-copy">{{ toSingleSentence(item) }}</text>
        </view>
      </view>

      <button class="primary-button" @click="goPuzzle">开始游玩</button>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.artifact-card {
  padding: 30rpx;
  border: 1px solid rgba(209, 178, 111, 0.26);
  border-radius: 30rpx;
  background: linear-gradient(180deg, rgba(38, 34, 27, 0.98), rgba(14, 16, 20, 0.98));
}

.artifact-title,
.artifact-copy,
.type-copy {
  display: block;
  margin-top: 14rpx;
}

.type-copy {
  color: rgba(247, 239, 221, 0.58);
  font-size: 23rpx;
  font-weight: 800;
}

.tip-card {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 24rpx;
}

.tip-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
</style>
