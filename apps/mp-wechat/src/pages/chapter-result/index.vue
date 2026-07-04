<script setup lang="ts">
import { computed } from "vue"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"
import { toSingleSentence } from "@/utils/copy"

const missionStore = useMissionStore()
const resultCopy = computed(() => toSingleSentence(missionStore.activeSession?.latestChapterResult?.narrative || ""))

function continueFlow() {
  missionStore.advanceFromChapterResult()
  uni.redirectTo({ url: MINI_ROUTES.chapterMap })
}
</script>

<template>
  <PageScaffold title="节点结果">
    <view v-if="missionStore.activeSession?.latestChapterResult" class="content-stack bottom-safe">
      <view class="result-card">
        <text class="score-pill">+{{ missionStore.activeSession.latestChapterResult.gainedScore }} 分</text>
        <text class="display-title result-title">{{ missionStore.activeSession.latestChapterResult.chapterTitle }}</text>
        <text v-if="resultCopy" class="body-copy result-copy">{{ resultCopy }}</text>
      </view>

      <button class="primary-button" @click="continueFlow">继续任务</button>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.result-card {
  padding: 32rpx;
  border: 1px solid rgba(209, 178, 111, 0.28);
  border-radius: 30rpx;
  background: linear-gradient(180deg, rgba(38, 34, 27, 0.98), rgba(14, 16, 20, 0.98));
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

.result-title,
.result-copy {
  display: block;
  margin-top: 18rpx;
}
</style>
