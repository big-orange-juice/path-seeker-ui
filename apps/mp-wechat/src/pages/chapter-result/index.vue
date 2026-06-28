<script setup lang="ts">
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"

const missionStore = useMissionStore()

function continueFlow() {
  missionStore.advanceFromChapterResult()
  uni.redirectTo({ url: MINI_ROUTES.chapterMap })
}
</script>

<template>
  <PageScaffold title="线索入袋">
    <view v-if="missionStore.activeSession?.latestChapterResult" class="content-stack bottom-safe">
      <view class="result-card">
        <text class="score-pill">+{{ missionStore.activeSession.latestChapterResult.gainedScore }} 分</text>
        <text class="display-title result-title">{{ missionStore.activeSession.latestChapterResult.chapterTitle }}</text>
        <text class="body-copy result-copy">{{ missionStore.activeSession.latestChapterResult.narrative }}</text>
      </view>

      <view class="clue-card panel">
        <text class="eyebrow">得到线索</text>
        <text class="section-title">{{ missionStore.activeSession.latestChapterResult.unlockedClue.clueTitle }}</text>
        <view class="chip-row result-row">
          <text class="chip is-active">{{ missionStore.activeSession.latestChapterResult.unlockedClue.fragmentTitle }}</text>
          <text v-if="!missionStore.activeSession.latestChapterResult.usedHints.length" class="chip">无提示完成</text>
        </view>
      </view>

      <button class="primary-button" @click="continueFlow">回到大地图</button>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.result-card {
  padding: 32rpx;
  border: 1px solid rgba(209, 178, 111, 0.28);
  border-radius: 34rpx;
  background:
    radial-gradient(circle at 86% 12%, rgba(209, 178, 111, 0.24), transparent 28%),
    linear-gradient(180deg, rgba(38, 34, 27, 0.98), rgba(14, 16, 20, 0.98));
}

.score-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.16);
  color: #f3d99d;
  font-size: 22rpx;
  font-weight: 900;
}

.result-title {
  display: block;
  margin-top: 20rpx;
}

.result-copy {
  display: block;
  margin-top: 14rpx;
}

.clue-card {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 24rpx;
}

.result-row {
  margin-top: 4rpx;
}
</style>
