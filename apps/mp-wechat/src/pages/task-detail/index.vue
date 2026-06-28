<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { onLoad } from "@dcloudio/uni-app"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"
import { getDifficultyLabel, getPuzzleTypeGlyph, getPuzzleTypeLabel } from "@/utils/puzzleLabels"
import type { AgeBand, MissionDetail } from "@/types/mission"

const missionStore = useMissionStore()
const routeId = shallowRef("")
const mission = shallowRef<MissionDetail | null>(null)
const selectedAgeBand = shallowRef<AgeBand>("6-10")

const canResumeCurrent = computed(
  () => missionStore.activeSession?.routeId === mission.value?.id && missionStore.activeSession?.status === "in_progress",
)

const routePreview = computed(() => mission.value?.chapters.slice(0, 5) ?? [])

function startMission() {
  if (!mission.value) {
    return
  }

  missionStore.startMission(mission.value.id, selectedAgeBand.value)
  uni.redirectTo({ url: MINI_ROUTES.prologue })
}

function continueMission() {
  uni.redirectTo({ url: MINI_ROUTES.chapterMap })
}

onLoad((query) => {
  routeId.value = String(query?.routeId || "")
  mission.value = missionStore.getMission(routeId.value)

  if (mission.value) {
    selectedAgeBand.value = mission.value.recommendedAgeBand
  }
})
</script>

<template>
  <PageScaffold title="准备出发">
    <view v-if="mission" class="content-stack bottom-safe">
      <view class="detail-ticket">
        <view class="ticket-topline">
          <text class="eyebrow">{{ mission.badgeLabel }}</text>
          <text class="ticket-time">{{ mission.estimatedMinutes }} 分钟</text>
        </view>
        <text class="display-title detail-title">{{ mission.title }}</text>
        <view class="ticket-meta">
          <text>{{ mission.theme }}</text>
          <text>{{ getDifficultyLabel(mission.difficultyLevel) }}</text>
          <text>{{ mission.chapterCount }} 站地图</text>
        </view>
      </view>

      <view class="panel route-preview">
        <view class="preview-head">
          <view>
            <text class="eyebrow">路线棋盘</text>
            <text class="section-title preview-title">从起点一路闯到终点</text>
          </view>
          <text class="muted-copy">{{ mission.chapterCount }} 站</text>
        </view>
        <view class="preview-map">
          <view v-for="chapter in routePreview" :key="chapter.id" class="preview-node">
            <text class="node-step">{{ chapter.stageNo }}</text>
            <text class="node-glyph">{{ getPuzzleTypeGlyph(chapter.puzzle.templateType) }}</text>
            <text class="node-title text-clip-1">{{ chapter.targetLocation }}</text>
            <text class="node-type">{{ getPuzzleTypeLabel(chapter.puzzle.templateType) }}</text>
          </view>
        </view>
      </view>

      <view class="info-pair">
        <view class="panel info-card">
          <text class="metric-label">第一站</text>
          <text class="info-value">{{ mission.startLocation }}</text>
        </view>
        <view class="panel info-card">
          <text class="metric-label">通关奖励</text>
          <text class="info-value">{{ mission.rewardTitle }}</text>
        </view>
      </view>

      <view class="panel age-card">
        <view>
          <text class="eyebrow">探险队</text>
          <text class="section-title age-title">谁来一起玩？</text>
        </view>
        <view class="age-options">
          <button
            v-for="ageBand in mission.availableAgeBands"
            :key="ageBand"
            class="age-pill"
            :class="{ 'is-active': selectedAgeBand === ageBand }"
            @click="selectedAgeBand = ageBand"
          >
            {{ ageBand }}
          </button>
        </view>
      </view>

      <view class="button-row action-row">
        <button v-if="canResumeCurrent" class="secondary-button" @click="continueMission">回到地图</button>
        <button class="primary-button" @click="startMission">拿任务牌出发</button>
      </view>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.detail-ticket {
  overflow: hidden;
  padding: 32rpx;
  border: 1px solid rgba(209, 178, 111, 0.28);
  border-radius: 36rpx;
  background:
    radial-gradient(circle at 90% 0, rgba(209, 178, 111, 0.25), transparent 28%),
    radial-gradient(circle at 10% 100%, rgba(243, 217, 157, 0.1), transparent 32%),
    linear-gradient(180deg, rgba(39, 35, 27, 0.96), rgba(16, 17, 20, 0.98));
}

.ticket-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.ticket-time {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.14);
  color: #f3d99d;
  font-size: 22rpx;
  font-weight: 900;
}

.detail-title {
  display: block;
  margin-top: 14rpx;
}

.ticket-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 24rpx;
  color: rgba(247, 239, 221, 0.78);
  font-size: 24rpx;
  font-weight: 900;
}

.ticket-meta text {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.055);
}

.route-preview,
.age-card {
  padding: 26rpx;
}

.preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.preview-title,
.age-title {
  display: block;
  margin-top: 8rpx;
}

.preview-map {
  display: flex;
  gap: 12rpx;
  margin-top: 24rpx;
}

.preview-node {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 160rpx;
  padding: 18rpx 10rpx 14rpx;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.045);
  text-align: center;
}

.preview-node::after {
  content: "";
  position: absolute;
  top: 50%;
  right: -12rpx;
  width: 12rpx;
  height: 4rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.42);
}

.preview-node:last-child::after {
  display: none;
}

.node-step {
  position: absolute;
  left: 10rpx;
  top: 10rpx;
  color: rgba(247, 239, 221, 0.5);
  font-size: 18rpx;
  font-weight: 900;
}

.node-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 52rpx;
  margin: 16rpx auto 12rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.18);
  color: #fff8ea;
  font-size: 22rpx;
  font-weight: 900;
}

.node-title {
  color: #fff8ea;
  font-size: 22rpx;
  font-weight: 900;
}

.node-type {
  display: block;
  margin-top: 8rpx;
  color: rgba(247, 239, 221, 0.56);
  font-size: 20rpx;
  font-weight: 800;
}

.info-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.info-card {
  padding: 22rpx;
}

.info-value {
  display: block;
  margin-top: 12rpx;
  color: #fff8ea;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.35;
}

.age-card {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.age-options {
  display: flex;
  gap: 14rpx;
}

.age-pill {
  min-width: 112rpx;
  min-height: 68rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.055);
  color: rgba(247, 239, 221, 0.76);
  font-size: 26rpx;
  font-weight: 900;
}

.age-pill.is-active {
  background: linear-gradient(135deg, rgba(209, 178, 111, 0.34), rgba(209, 178, 111, 0.14));
  color: #fff8ea;
}

.action-row {
  margin-top: 4rpx;
}
</style>

