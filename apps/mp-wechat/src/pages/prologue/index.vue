<script setup lang="ts">
import { computed } from "vue"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"
import { toSingleSentence } from "@/utils/copy"

const missionStore = useMissionStore()
const introCopy = computed(() => toSingleSentence(missionStore.activeMission?.introPanel.narrative || ""))

function enterMap() {
  uni.redirectTo({ url: MINI_ROUTES.chapterMap })
}
</script>

<template>
  <PageScaffold title="任务开始">
    <view v-if="missionStore.activeMission" class="content-stack bottom-safe">
      <view class="start-card">
        <view class="guide-mark">{{ missionStore.activeMission.persona.avatar }}</view>
        <text class="eyebrow">{{ missionStore.activeMission.persona.name }}</text>
        <text class="display-title start-title">{{ missionStore.activeMission.title }}</text>
        <text class="body-copy start-copy">{{ introCopy }}</text>
      </view>

      <view class="panel section-card">
        <text class="eyebrow">开场</text>
        <view class="route-line">
          <view v-for="beat in missionStore.activeMission.prologue" :key="beat.title" class="route-line-item">
            <text class="section-title beat-title">{{ beat.title }}</text>
            <text class="muted-copy">{{ toSingleSentence(beat.content) }}</text>
          </view>
        </view>
      </view>

      <view class="brief-grid">
        <view class="panel brief-card">
          <text class="brief-no">01</text>
          <text class="section-title">先到起点</text>
          <text class="muted-copy">{{ missionStore.activeMission.startLocation }}</text>
        </view>
        <view class="panel brief-card">
          <text class="brief-no">02</text>
          <text class="section-title">一路拼真相</text>
          <text class="muted-copy">前半段重观察，后半段重闭环。</text>
        </view>
      </view>

      <view class="panel playbook-card">
        <text class="eyebrow">玩法</text>
        <view class="chip-row">
          <text v-for="item in missionStore.activeMission.introPanel.playbook" :key="item" class="chip is-active">{{ item }}</text>
        </view>
      </view>

      <button class="primary-button" @click="enterMap">打开大地图</button>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.start-card {
  padding: 32rpx;
  border: 1px solid rgba(209, 178, 111, 0.28);
  border-radius: 34rpx;
  background:
    radial-gradient(circle at 86% 10%, rgba(209, 178, 111, 0.24), transparent 28%),
    linear-gradient(180deg, rgba(38, 34, 27, 0.98), rgba(14, 16, 20, 0.98));
}

.guide-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  margin-bottom: 18rpx;
  border-radius: 24rpx;
  background: rgba(209, 178, 111, 0.18);
  color: #fff8ea;
  font-size: 32rpx;
  font-weight: 900;
}

.start-title {
  display: block;
  margin-top: 12rpx;
}

.start-copy {
  display: block;
  margin-top: 16rpx;
}

.section-card,
.playbook-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 24rpx;
}

.beat-title {
  display: block;
  margin-bottom: 8rpx;
  font-size: 28rpx;
}

.brief-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.brief-card {
  min-height: 168rpx;
  padding: 22rpx;
}

.brief-no {
  color: #d1b26f;
  font-size: 22rpx;
  font-weight: 900;
}

.brief-card .section-title {
  display: block;
  margin-top: 14rpx;
  font-size: 28rpx;
}

.brief-card .muted-copy {
  display: block;
  margin-top: 8rpx;
}
</style>
