<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue"
import { RouterLink, useRoute, useRouter } from "vue-router"
import { UiBadge, UiButton, UiCard } from "@path-seeker/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { toSingleSentence } from "@/utils/copy"
import { getDifficultyLabel, getPuzzleTypeLabel } from "@/utils/puzzleLabels"
import type { AgeBand, MissionDetail } from "@/types/mission"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()

const routeId = computed(() => String(route.params.routeId || ""))
const mission = shallowRef<MissionDetail | null>(null)
const selectedAgeBand = shallowRef<AgeBand>("10-15")

const metaItems = computed(() => {
  const currentMission = mission.value
  if (!currentMission) {
    return []
  }

  return [
    currentMission.theme,
    getDifficultyLabel(currentMission.difficultyLevel),
    `${currentMission.estimatedMinutes} 分钟`,
    `${currentMission.chapterCount} 章节`,
    currentMission.allowTeam ? "支持组队" : "",
  ].filter(Boolean)
})

const canResumeCurrent = computed(() => {
  if (!mission.value || !missionStore.activeSession) {
    return false
  }

  return missionStore.activeSession.routeId === mission.value.id && missionStore.activeSession.status === "in_progress"
})

const summaryCopy = computed(() => toSingleSentence(mission.value?.summary || ""))

async function loadMission() {
  const cachedMission = missionStore.getMission(routeId.value)
  if (cachedMission) {
    mission.value = cachedMission
    selectedAgeBand.value = cachedMission.recommendedAgeBand
    return
  }

  const loadedMission = await missionStore.loadMissionDetail(routeId.value)
  mission.value = loadedMission
  selectedAgeBand.value = loadedMission?.recommendedAgeBand || "10-15"
}

async function handleStartMission() {
  if (!mission.value) {
    return
  }

  const session = await missionStore.startRemoteMission(mission.value.id, selectedAgeBand.value)
  if (!session) {
    return
  }

  await router.push(
    mission.value.prologue.length
      ? `/missions/${mission.value.id}/prologue`
      : `/missions/${mission.value.id}/map`,
  )
}

async function handleContinueMission() {
  if (!mission.value) {
    return
  }

  await router.push(`/missions/${mission.value.id}/map`)
}

onMounted(() => {
  void loadMission()
})
</script>

<template>
  <div class="space-y-4">
    <UiCard v-if="mission" class="client-panel overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <UiBadge>{{ mission.badgeLabel }}</UiBadge>
            <UiBadge variant="muted">{{ mission.recommendedAgeBand }}</UiBadge>
            <UiBadge variant="muted">{{ getDifficultyLabel(mission.difficultyLevel) }}</UiBadge>
          </div>

          <div class="space-y-2">
            <h2 class="font-display text-3xl leading-tight text-foreground">{{ mission.title }}</h2>
            <p class="client-page-copy">{{ summaryCopy }}</p>
          </div>

          <div v-if="metaItems.length" class="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span
              v-for="item in metaItems"
              :key="item"
              class="rounded-full bg-background/70 px-3 py-1"
            >
              {{ item }}
            </span>
          </div>
        </div>

        <div class="rounded-[1rem] bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
          {{ mission.introPanel.narrative }}
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-[1rem] bg-background/70 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">开局说明</p>
            <ul class="mt-3 space-y-2 text-sm leading-6 text-foreground">
              <li v-for="item in mission.introPanel.playbook" :key="item">{{ item }}</li>
            </ul>
          </div>
          <div class="rounded-[1rem] bg-background/70 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">奖励预览</p>
            <ul class="mt-3 space-y-2 text-sm leading-6 text-foreground">
              <li v-for="item in mission.introPanel.rewardPreview" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>

        <div v-if="mission.availableAgeBands.length > 1" class="space-y-3">
          <p class="text-sm font-semibold text-foreground">年龄档</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="band in mission.availableAgeBands"
              :key="band"
              type="button"
              class="rounded-full border px-4 py-2 text-sm transition-colors"
              :class="band === selectedAgeBand ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/60 text-muted-foreground'"
              @click="selectedAgeBand = band"
            >
              {{ band }}
            </button>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-foreground">任务节点</h3>
            <span class="text-sm text-muted-foreground">{{ mission.chapters.length }} 站</span>
          </div>

          <div class="space-y-3">
            <div
              v-for="chapter in mission.chapters"
              :key="chapter.id"
              class="flex items-center gap-3 rounded-[1rem] bg-background/70 p-4"
            >
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {{ chapter.stageNo }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-foreground">{{ chapter.title }}</div>
                <div class="text-sm text-muted-foreground">{{ chapter.targetLocation }}</div>
              </div>
              <div class="text-right text-xs text-muted-foreground">
                {{ getPuzzleTypeLabel(chapter.puzzle.templateType, chapter.puzzle.interactionType) }}
              </div>
            </div>
          </div>
        </div>

        <div class="grid gap-3">
          <UiButton v-if="canResumeCurrent" class="w-full" @click="handleContinueMission()">继续当前任务</UiButton>
          <UiButton
            :variant="canResumeCurrent ? 'outline' : 'default'"
            class="w-full"
            :disabled="missionStore.gameplayPending"
            @click="handleStartMission()"
          >
            {{ missionStore.gameplayPending ? "开始中..." : canResumeCurrent ? "重新开始本路线" : "开始任务" }}
          </UiButton>
        </div>
      </div>
    </UiCard>

    <UiCard v-else-if="missionStore.detailPending" class="client-panel">
      <div class="p-5 text-sm leading-6 text-muted-foreground">正在读取任务详情...</div>
    </UiCard>

    <UiCard v-else class="client-panel">
      <div class="space-y-4 p-5">
        <div class="space-y-2">
          <h2 class="text-2xl font-display text-foreground">任务详情不可用</h2>
          <p class="client-page-copy">{{ missionStore.gameplayError || missionStore.detailError || "当前路线暂时没有可用详情。" }}</p>
        </div>

        <RouterLink to="/shell/hall" class="block">
          <UiButton variant="outline" class="w-full">返回任务大厅</UiButton>
        </RouterLink>
      </div>
    </UiCard>
  </div>
</template>
