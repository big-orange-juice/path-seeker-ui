<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { onLoad } from "@dcloudio/uni-app"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { getCachedRemoteRouteCard } from "@/composables/useRemoteRouteCards"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"
import { getDifficultyLabel, getPuzzleTypeGlyph, getPuzzleTypeLabel } from "@/utils/puzzleLabels"
import { toSingleSentence } from "@/utils/copy"
import type { AgeBand, MissionDetail, MissionRouteCard } from "@/types/mission"

const missionStore = useMissionStore()
const routeId = shallowRef("")
const mission = shallowRef<MissionDetail | null>(null)
const remoteRoute = shallowRef<MissionRouteCard | null>(null)
const selectedAgeBand = shallowRef<AgeBand>("6-10")

const canResumeCurrent = computed(
  () => {
    const currentId = mission.value?.id || remoteRoute.value?.id || ""
    return missionStore.activeSession?.routeId === currentId && missionStore.activeSession?.status === "in_progress"
  },
)

const routePreview = computed(() => mission.value?.chapters.slice(0, 6) ?? [])
const summaryCopy = computed(() => toSingleSentence(mission.value?.summary || ""))
const cardSummaryCopy = computed(() => toSingleSentence(remoteRoute.value?.summary || ""))

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
  remoteRoute.value = getCachedRemoteRouteCard(routeId.value)

  if (mission.value) {
    selectedAgeBand.value = mission.value.recommendedAgeBand
    return
  }

  if (remoteRoute.value) {
    selectedAgeBand.value = remoteRoute.value.recommendedAgeBand
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
            <text class="eyebrow">路线预览</text>
            <text class="section-title preview-title">从起点一路到终点</text>
          </view>
          <text class="muted-copy">{{ mission.chapterCount }} 站</text>
        </view>
        <scroll-view class="preview-scroll" scroll-x enable-flex show-scrollbar="false">
          <view class="preview-map">
            <view v-for="chapter in routePreview" :key="chapter.id" class="preview-node">
              <text class="node-step">{{ chapter.stageNo }}</text>
              <text class="node-glyph">{{ getPuzzleTypeGlyph(chapter.puzzle.templateType) }}</text>
              <text class="node-title text-clip-1">{{ chapter.targetLocation }}</text>
              <text class="node-type">{{ getPuzzleTypeLabel(chapter.puzzle.templateType) }}</text>
            </view>
          </view>
        </scroll-view>
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
        <text class="eyebrow">年龄档</text>
        <text class="section-title age-title">选择讲述方式</text>
        <view class="chip-row age-row">
          <button
            v-for="band in mission.availableAgeBands"
            :key="band"
            class="age-chip"
            :class="{ 'is-active': selectedAgeBand === band }"
            @click="selectedAgeBand = band"
          >
            {{ band }}
          </button>
        </view>
      </view>

      <view class="panel note-card">
        <text class="eyebrow">任务摘要</text>
        <text class="section-title note-title">{{ summaryCopy }}</text>
      </view>

      <view class="panel story-preview">
        <text class="eyebrow">开场</text>
        <view class="route-line">
          <view v-for="beat in mission.prologue" :key="beat.title" class="route-line-item">
            <text class="section-title beat-title">{{ beat.title }}</text>
            <text class="muted-copy">{{ toSingleSentence(beat.content) }}</text>
          </view>
        </view>
      </view>

      <view class="button-row action-row">
        <button v-if="canResumeCurrent" class="secondary-button" @click="continueMission">回到任务</button>
        <button class="primary-button" @click="startMission">拿任务牌出发</button>
      </view>
    </view>

    <view v-else-if="remoteRoute" class="content-stack bottom-safe">
      <view class="detail-ticket">
        <view class="ticket-topline">
          <text class="eyebrow">{{ remoteRoute.badgeLabel }}</text>
          <text class="ticket-time">{{ remoteRoute.estimatedMinutes || "-" }} 分钟</text>
        </view>
        <text class="display-title detail-title">{{ remoteRoute.title }}</text>
        <view class="ticket-meta">
          <text>{{ remoteRoute.theme }}</text>
          <text>{{ getDifficultyLabel(remoteRoute.difficultyLevel) }}</text>
          <text>{{ remoteRoute.puzzleCount }} 题</text>
        </view>
      </view>

      <view class="panel note-card">
        <text class="section-title note-title">{{ cardSummaryCopy || "暂无简介" }}</text>
      </view>

      <view class="info-pair">
        <view class="panel info-card">
          <text class="metric-label">适龄</text>
          <text class="info-value">{{ remoteRoute.recommendedAgeBand }}</text>
        </view>
        <view class="panel info-card">
          <text class="metric-label">奖励</text>
          <text class="info-value">{{ remoteRoute.rewardTitle }}</text>
        </view>
      </view>

      <view class="panel age-card">
        <text class="eyebrow">年龄档</text>
        <view class="chip-row age-row">
          <text class="chip is-active">{{ remoteRoute.recommendedAgeBand }}</text>
          <text v-for="tag in remoteRoute.taglines" :key="tag" class="chip">{{ tag }}</text>
        </view>
      </view>

      <button v-if="canResumeCurrent" class="secondary-button" @click="continueMission">继续当前任务</button>
      <view v-else class="panel note-card">
        <text class="muted-copy">该任务详情流程暂未接入，当前先展示列表基础信息。</text>
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
.note-card,
.story-preview,
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
.note-title {
  display: block;
  margin-top: 8rpx;
}

.preview-scroll {
  margin-top: 24rpx;
  white-space: nowrap;
}

.preview-map {
  display: inline-flex;
  gap: 12rpx;
}

.preview-node {
  position: relative;
  width: 156rpx;
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

.age-card,
.story-preview,
.note-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.age-title {
  display: block;
  margin-top: 6rpx;
}

.age-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(247, 239, 221, 0.72);
  font-size: 22rpx;
  font-weight: 800;
}

.age-chip.is-active {
  background: rgba(209, 178, 111, 0.18);
  color: #fff8ea;
  box-shadow: inset 0 0 0 1px rgba(209, 178, 111, 0.38);
}

.beat-title {
  display: block;
  margin-bottom: 8rpx;
  font-size: 28rpx;
}

.note-copy {
  color: rgba(247, 239, 221, 0.72);
  font-size: 25rpx;
}

.action-row {
  margin-top: 4rpx;
}
</style>
