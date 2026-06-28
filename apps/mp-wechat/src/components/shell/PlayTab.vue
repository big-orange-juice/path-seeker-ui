<script setup lang="ts">
import { computed } from "vue"
import MissionCard from "@/components/mission/MissionCard.vue"
import type { MissionDetail, MissionSession } from "@/types/mission"

interface Props {
  mission: MissionDetail | null
  session: MissionSession | null
  progressPercent: number
  unlockedClues: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  continue: []
  replay: [routeId: string]
  open: [routeId: string]
}>()

const missionCard = computed(() => props.mission)
const currentStep = computed(() => {
  if (!props.mission || !props.session) {
    return ""
  }

  return `${props.session.currentChapterIndex + 1} / ${props.mission.chapterCount}`
})
</script>

<template>
  <view class="content-stack bottom-safe">
    <view v-if="props.mission && props.session" class="play-ticket">
      <text class="eyebrow">正在进行</text>
      <text class="display-title play-title">{{ props.mission.title }}</text>

      <view class="play-progress">
        <view class="progress-copy">
          <text class="metric-label">大地图进度</text>
          <text class="progress-value">{{ currentStep }}</text>
        </view>
        <view class="progress-copy right">
          <text class="metric-label">完成度</text>
          <text class="progress-value">{{ progressPercent }}%</text>
        </view>
      </view>

      <view v-if="unlockedClues.length" class="clue-line">
        <text class="metric-label">线索袋</text>
        <view class="chip-row clue-row">
          <text v-for="clue in unlockedClues" :key="clue" class="chip is-active">{{ clue }}</text>
        </view>
      </view>

      <view class="button-row play-actions">
        <button class="primary-button" @click="emit('continue')">回到大地图</button>
        <button class="secondary-button" @click="props.mission && emit('replay', props.mission.id)">重玩</button>
      </view>
    </view>

    <MissionCard v-if="missionCard" :route="missionCard" show-resume @open="emit('open', $event)" />

    <view v-else class="panel empty-panel">
      <text class="display-title empty-title">还没有任务</text>
      <text class="body-copy">先去任务页选一条路线。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.play-ticket {
  padding: 30rpx;
  border: 1px solid rgba(209, 178, 111, 0.26);
  border-radius: 34rpx;
  background:
    radial-gradient(circle at 88% 10%, rgba(209, 178, 111, 0.22), transparent 28%),
    linear-gradient(180deg, rgba(34, 31, 27, 0.98), rgba(14, 16, 20, 0.98));
}

.play-title {
  display: block;
  margin-top: 12rpx;
}

.play-progress {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 24rpx;
}

.progress-copy {
  padding: 18rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.055);
}

.progress-copy.right {
  text-align: right;
}

.progress-value {
  display: block;
  margin-top: 8rpx;
  color: #fff8ea;
  font-size: 32rpx;
  font-weight: 900;
}

.clue-line {
  margin-top: 22rpx;
}

.clue-row {
  margin-top: 12rpx;
}

.play-actions {
  margin-top: 24rpx;
}

.empty-panel {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 26rpx;
}

.empty-title {
  font-size: 38rpx;
}
</style>