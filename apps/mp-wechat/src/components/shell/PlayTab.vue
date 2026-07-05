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
  continue: [index?: number]
  replay: [routeId: string]
  open: [routeId: string]
}>()

const currentStep = computed(() => {
  if (!props.mission || !props.session) {
    return ""
  }

  return `已完成 ${props.session.solvedChapterIds.length} / ${props.mission.chapterCount}`
})

const currentChapter = computed(() => {
  if (!props.mission || !props.session) {
    return null
  }

  return props.mission.chapters[props.session.currentChapterIndex] || null
})

const stageLine = computed(() => {
  if (!props.mission || !props.session) {
    return []
  }

  return props.mission.chapters.map((chapter, index) => ({
    id: chapter.id,
    index,
    title: chapter.title,
    location: chapter.targetLocation,
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
            <text class="eyebrow">{{ currentStep }}</text>
            <text class="display-title play-title">{{ props.mission.title }}</text>
          </view>
          <view class="progress-pill">{{ progressPercent }}%</view>
        </view>
        <text v-if="currentChapter?.title" class="section-title current-title">{{ currentChapter.title }}</text>
        <text v-if="currentChapter?.targetLocation" class="muted-copy current-location">{{ currentChapter.targetLocation }}</text>
      </button>

      <view v-if="stageLine.length" class="panel stage-board">
        <button
          v-for="stage in stageLine"
          :key="stage.id"
          class="stage-row"
          :class="{ 'is-active': stage.active, 'is-solved': stage.solved }"
          hover-class="stage-row-hover"
          @click="emit('continue', stage.index)">
          <view class="stage-dot">{{ stage.solved ? '✓' : stage.active ? '今' : '·' }}</view>
          <view class="stage-copy">
            <text class="stage-title text-clip-1">{{ stage.title }}</text>
            <text v-if="stage.location" class="stage-objective text-clip-1">{{ stage.location }}</text>
          </view>
          <text class="stage-state">{{ stage.active ? '已选' : stage.solved ? '完成' : '可选' }}</text>
        </button>
      </view>

      <MissionCard :route="props.mission" show-resume status="in-progress" @open="emit('open', $event)" />
    </template>

    <view v-else class="panel empty-panel">
      <text class="display-title empty-title">还没有任务</text>
      <text class="body-copy">先去任务大厅选一条路线。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.play-ticket {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  width: 100%;
  padding: 30rpx;
  border: 1px solid rgba(209, 178, 111, 0.26);
  border-radius: 30rpx;
  background: linear-gradient(180deg, rgba(34, 31, 27, 0.98), rgba(14, 16, 20, 0.98));
  color: #fff8ea;
  text-align: left;
}

.panel-hover,
.stage-row-hover {
  opacity: 0.96;
  transform: scale(0.995);
}

.ticket-head,
.stage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.play-title {
  display: block;
  margin-top: 10rpx;
  color: #fff8ea;
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

.current-title,
.current-location {
  display: block;
}

.stage-board {
  display: flex;
  flex-direction: column;
  padding: 12rpx 22rpx;
}

.stage-row {
  width: 100%;
  min-height: 84rpx;
  padding: 14rpx 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: #fff8ea;
  text-align: left;
}

.stage-row:last-child {
  border-bottom: 0;
}

.stage-dot {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46rpx;
  height: 46rpx;
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
}

.stage-title {
  color: #fff8ea;
  font-size: 27rpx;
  font-weight: 900;
}

.stage-objective {
  display: block;
  margin-top: 6rpx;
  color: rgba(247, 239, 221, 0.56);
  font-size: 22rpx;
}

.stage-state {
  flex: 0 0 auto;
  min-width: 58rpx;
  color: rgba(247, 239, 221, 0.46);
  font-size: 21rpx;
  font-weight: 800;
  text-align: right;
}

.stage-row.is-active .stage-state {
  color: #d1b26f;
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
