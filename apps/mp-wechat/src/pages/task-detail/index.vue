<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { onLoad } from "@dcloudio/uni-app"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import { getCachedRemoteRouteCard } from "@/composables/useRemoteRouteCards"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"
import { getDifficultyLabel, getPuzzleTypeLabel } from "@/utils/puzzleLabels"
import { toSingleSentence } from "@/utils/copy"
import type { AgeBand, MissionDetail, MissionRouteCard } from "@/types/mission"

const missionStore = useMissionStore()
const routeId = shallowRef("")
const mission = shallowRef<MissionDetail | null>(null)
const remoteRoute = shallowRef<MissionRouteCard | null>(null)
const selectedAgeBand = shallowRef<AgeBand>("6-10")

const displayRoute = computed(() => mission.value || remoteRoute.value)
const summaryCopy = computed(() => toSingleSentence(displayRoute.value?.summary || ""))
const routePreview = computed(() => mission.value?.chapters ?? [])
const canResumeCurrent = computed(() => {
  const currentId = displayRoute.value?.id || ""
  return missionStore.activeSession?.routeId === currentId && missionStore.activeSession?.status === "in_progress"
})
const metaItems = computed(() => {
  const route = displayRoute.value
  if (!route) {
    return []
  }

  return [
    route.theme,
    getDifficultyLabel(route.difficultyLevel),
    route.estimatedMinutes ? `${route.estimatedMinutes} 分钟` : "",
    route.puzzleCount ? `${route.puzzleCount} 题` : "",
    route.totalScore ? `${route.totalScore} 分` : "",
    route.allowTeam ? "支持组队" : "",
  ].filter(Boolean)
})

async function loadDetail() {
  mission.value = missionStore.getMission(routeId.value)
  remoteRoute.value = getCachedRemoteRouteCard(routeId.value)

  if (!mission.value) {
    mission.value = await missionStore.loadMissionDetail(routeId.value)
  }

  const route = mission.value || remoteRoute.value
  if (route) {
    selectedAgeBand.value = route.recommendedAgeBand
  }
}

async function startMission() {
  const route = displayRoute.value
  if (!route) {
    return
  }

  const session = await missionStore.startRemoteMission(route.id, selectedAgeBand.value)
  if (!session) {
    return
  }

  uni.redirectTo({ url: missionStore.activeMission?.prologue.length ? MINI_ROUTES.prologue : MINI_ROUTES.chapterMap })
}

function continueMission() {
  uni.redirectTo({ url: MINI_ROUTES.chapterMap })
}

onLoad((query) => {
  routeId.value = String(query?.routeId || "")
  void loadDetail()
})
</script>

<template>
  <PageScaffold title="任务详情">
    <view v-if="displayRoute" class="content-stack bottom-safe">
      <view class="detail-card">
        <text v-if="displayRoute.badgeLabel" class="eyebrow">{{ displayRoute.badgeLabel }}</text>
        <text class="display-title detail-title">{{ displayRoute.title }}</text>
        <text v-if="summaryCopy" class="body-copy detail-copy">{{ summaryCopy }}</text>
        <view v-if="metaItems.length" class="meta-row">
          <text v-for="item in metaItems" :key="item" class="meta-pill">{{ item }}</text>
        </view>
      </view>

      <view v-if="routePreview.length" class="panel section-card">
        <view class="section-head">
          <text class="section-title">任务节点</text>
          <text class="muted-copy">{{ routePreview.length }} 站</text>
        </view>
        <view class="stage-list">
          <view v-for="chapter in routePreview" :key="chapter.id" class="stage-row">
            <text class="stage-no">{{ chapter.stageNo }}</text>
            <view class="stage-copy">
              <text class="stage-title text-clip-1">{{ chapter.title }}</text>
              <text v-if="chapter.targetLocation" class="muted-copy text-clip-1">{{ chapter.targetLocation }}</text>
            </view>
            <text class="stage-type">{{ getPuzzleTypeLabel(chapter.puzzle.templateType, chapter.puzzle.interactionType) }}</text>
          </view>
        </view>
      </view>

      <view v-if="displayRoute.availableAgeBands.length > 1" class="panel section-card">
        <text class="section-title">年龄档</text>
        <view class="chip-row">
          <button
            v-for="band in displayRoute.availableAgeBands"
            :key="band"
            class="age-chip"
            :class="{ 'is-active': selectedAgeBand === band }"
            @click="selectedAgeBand = band">
            {{ band }}
          </button>
        </view>
      </view>

      <view class="button-row action-row">
        <button v-if="canResumeCurrent" class="secondary-button" @click="continueMission">继续任务</button>
        <button class="primary-button" :disabled="missionStore.gameplayPending" @click="startMission">
          {{ missionStore.gameplayPending ? '开始中...' : '开始任务' }}
        </button>
      </view>

      <view v-if="missionStore.gameplayError || missionStore.detailError" class="panel notice-card">
        <text class="muted-copy">{{ missionStore.gameplayError || missionStore.detailError }}</text>
      </view>
    </view>

    <view v-else-if="missionStore.detailPending" class="content-stack bottom-safe">
      <view class="panel notice-card">
        <text class="section-title">正在读取任务详情</text>
      </view>
    </view>

    <view v-else class="content-stack bottom-safe">
      <view class="panel notice-card">
        <text class="section-title">任务详情不可用</text>
        <text v-if="missionStore.detailError" class="muted-copy">{{ missionStore.detailError }}</text>
      </view>
    </view>
  </PageScaffold>
</template>

<style scoped lang="scss">
.detail-card {
  padding: 30rpx;
  border: 1px solid rgba(209, 178, 111, 0.26);
  border-radius: 30rpx;
  background: linear-gradient(180deg, rgba(38, 34, 27, 0.98), rgba(14, 16, 20, 0.98));
}

.detail-title,
.detail-copy {
  display: block;
  margin-top: 14rpx;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 22rpx;
}

.meta-pill,
.age-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.055);
  color: rgba(247, 239, 221, 0.78);
  font-size: 22rpx;
  font-weight: 800;
}

.section-card,
.notice-card {
  padding: 24rpx;
}

.section-head,
.stage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.stage-list {
  display: flex;
  flex-direction: column;
  margin-top: 16rpx;
}

.stage-row {
  min-height: 82rpx;
  padding: 14rpx 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.stage-row:last-child {
  border-bottom: 0;
}

.stage-no {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46rpx;
  height: 46rpx;
  border-radius: 999rpx;
  background: rgba(209, 178, 111, 0.14);
  color: #f3d99d;
  font-size: 20rpx;
  font-weight: 900;
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

.stage-type {
  color: rgba(247, 239, 221, 0.58);
  font-size: 21rpx;
  font-weight: 800;
}

.age-chip.is-active {
  background: rgba(209, 178, 111, 0.18);
  color: #fff8ea;
  box-shadow: inset 0 0 0 1px rgba(209, 178, 111, 0.38);
}

.action-row {
  margin-top: 4rpx;
}
</style>
