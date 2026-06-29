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

const stageLine = computed(() => {
  if (!props.mission || !props.session) {
    return []
  }

  return props.mission.chapters.map((chapter, index) => ({
    id: chapter.id,
    label: chapter.targetLocation,
    objective: chapter.objective,
    solved: props.session?.solvedChapterIds.includes(chapter.id),
    active: props.session?.currentChapterIndex === index,
  }))
})
</script>

<template>
  <view class="content-stack bottom-safe">
    <template v-if="props.mission && props.session">
      <button class="play-ticket" hover-class="panel-hover" @click="emit('continue')">
        <view class="ticket-head">
          <view>
            <text class="eyebrow">探索进行中</text>
            <text class="display-title play-title">{{ props.mission.title }}</text>
          </view>
          <view class="progress-ring">
            <text class="ring-value">{{ progressPercent }}%</text>
            <text class="ring-copy">完成</text>
          </view>
        </view>

        <view class="play-progress">
          <view class="progress-copy">
            <text class="metric-label">当前段落</text>
            <text class="progress-value">{{ currentStep }}</text>
          </view>
          <view class="progress-copy right">
            <text class="metric-label">下一站</text>
            <text class="progress-value text-clip-1">{{ props.mission.chapters[props.session.currentChapterIndex]?.targetLocation }}</text>
          </view>
        </view>

        <view v-if="unlockedClues.length" class="clue-line">
          <text class="metric-label">线索袋</text>
          <view class="chip-row clue-row">
            <text v-for="clue in unlockedClues" :key="clue" class="chip is-active">{{ clue }}</text>
          </view>
        </view>
      </button>

      <view class="panel stage-board">
        <view class="stage-head">
          <text class="section-title">任务线</text>
        </view>

        <button
          v-for="stage in stageLine"
          :key="stage.id"
          class="stage-row"
          :class="{ 'is-active': stage.active, 'is-solved': stage.solved }"
          hover-class="stage-row-hover"
          @click="emit('continue')"
        >
          <view class="stage-dot">{{ stage.active ? "今" : stage.solved ? "✓" : "·" }}</view>
          <view class="stage-copy">
            <text class="stage-title">{{ stage.label }}</text>
            <text class="stage-objective text-clip-2">{{ stage.objective }}</text>
          </view>
          <text class="stage-state">{{ stage.active ? "继续" : stage.solved ? "已到达" : "未开始" }}</text>
        </button>
      </view>

      <MissionCard v-if="missionCard" :route="missionCard" show-resume status="in-progress" @open="emit('open', $event)" />
    </template>

    <view v-else class="panel empty-panel">
      <text class="display-title empty-title">还没有任务</text>
      <text class="body-copy">先去任务页选一条路线。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.play-ticket {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  width: 100%;
  padding: 30rpx;
  border: 1px solid rgba(209, 178, 111, 0.26);
  border-radius: 34rpx;
  background:
    radial-gradient(circle at 88% 10%, rgba(209, 178, 111, 0.22), transparent 28%),
    linear-gradient(180deg, rgba(34, 31, 27, 0.98), rgba(14, 16, 20, 0.98));
  color: #fff8ea;
  text-align: left;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.panel-hover {
  opacity: 0.96;
  transform: scale(0.995);
}

.ticket-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.play-title {
  display: block;
  margin-top: 12rpx;
  color: #fff8ea;
}

.progress-ring {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 108rpx;
  height: 108rpx;
  border-radius: 999rpx;
  border: 1px solid rgba(209, 178, 111, 0.36);
  background: rgba(209, 178, 111, 0.12);
}

.ring-value {
  color: #fff8ea;
  font-size: 26rpx;
  font-weight: 900;
}

.ring-copy {
  margin-top: 4rpx;
  color: rgba(247, 239, 221, 0.56);
  font-size: 18rpx;
  font-weight: 900;
}

.play-progress {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
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
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.stage-board {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 24rpx;
}

.stage-row {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  width: 100%;
  padding: 18rpx 18rpx 2rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.03);
  color: #fff8ea;
  text-align: left;
  transition: background 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
}

.stage-row-hover {
  opacity: 0.96;
  transform: translateY(-2rpx);
}

.stage-row.is-active {
  background:
    radial-gradient(circle at 92% 12%, rgba(209, 178, 111, 0.14), transparent 24%),
    rgba(54, 43, 24, 0.64);
}

.stage-row.is-solved {
  background: rgba(255, 255, 255, 0.04);
}

.stage-dot {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46rpx;
  height: 46rpx;
  margin-top: 4rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(247, 239, 221, 0.66);
  font-size: 22rpx;
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
  padding-bottom: 16rpx;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.stage-title {
  color: #fff8ea;
  font-size: 27rpx;
  font-weight: 900;
}

.stage-objective {
  display: block;
  margin-top: 8rpx;
  color: rgba(247, 239, 221, 0.56);
  font-size: 22rpx;
  line-height: 1.42;
}

.stage-state {
  flex: 0 0 auto;
  min-width: 70rpx;
  padding-top: 4rpx;
  color: rgba(247, 239, 221, 0.46);
  font-size: 21rpx;
  font-weight: 800;
  text-align: right;
}

.stage-row.is-active .stage-state {
  color: #d1b26f;
}

.stage-row:last-child .stage-copy {
  border-bottom: 0;
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
