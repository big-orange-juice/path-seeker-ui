<script setup lang="ts">
import { computed } from "vue"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"
import { toSingleSentence } from "@/utils/copy"

const missionStore = useMissionStore()
const introCopy = computed(() => toSingleSentence(missionStore.activeMission?.introPanel.narrative || ""))

function enterMap() {
  uni.navigateTo({ url: MINI_ROUTES.chapterMap })
}
</script>

<template>
  <PageScaffold title="任务开始">
    <view v-if="missionStore.activeMission" class="content-stack bottom-safe">
      <view class="start-card">
        <text v-if="missionStore.activeMission.persona.name" class="eyebrow">{{ missionStore.activeMission.persona.name }}</text>
        <text class="display-title start-title">{{ missionStore.activeMission.title }}</text>
        <text v-if="introCopy" class="body-copy start-copy">{{ introCopy }}</text>
      </view>

      <view v-if="missionStore.activeMission.prologue.length" class="panel section-card">
        <view v-for="beat in missionStore.activeMission.prologue" :key="beat.title" class="story-item">
          <text class="section-title story-title">{{ beat.title }}</text>
          <text v-if="beat.content" class="muted-copy">{{ toSingleSentence(beat.content) }}</text>
        </view>
      </view>

      <view v-if="missionStore.activeMission.startLocation" class="panel section-card">
        <text class="metric-label">起点</text>
        <text class="section-title location-title">{{ missionStore.activeMission.startLocation }}</text>
      </view>

      <button class="primary-button" @click="enterMap">查看任务</button>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.start-card {
  padding: 30rpx;
  border: 1px solid rgba(209, 178, 111, 0.26);
  border-radius: 30rpx;
  background: linear-gradient(180deg, rgba(38, 34, 27, 0.98), rgba(14, 16, 20, 0.98));
}

.start-title,
.start-copy,
.location-title {
  display: block;
  margin-top: 14rpx;
}

.section-card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 24rpx;
}

.story-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding-bottom: 18rpx;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.story-item:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.story-title {
  font-size: 28rpx;
}
</style>
