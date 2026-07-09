<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue"
import { RouterLink, useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { ClientBadge, ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { getDifficultyLabel, getPuzzleTypeLabel } from "@/utils/puzzleLabels"
import type { AgeBand, MissionDetail } from "@/types/mission"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()

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
    currentMission.estimatedMinutes ? `${currentMission.estimatedMinutes} 分钟` : "",
    currentMission.chapterCount ? `${currentMission.chapterCount} 章节` : "",
  ].filter(Boolean)
})

const canResumeCurrent = computed(() => {
  if (!mission.value || !missionStore.activeSession) {
    return false
  }

  return missionStore.activeSession.routeId === mission.value.id && missionStore.activeSession.status === "in_progress"
})

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
    toastStore.error("任务启动失败", missionStore.gameplayError || "请稍后重试。")
    return
  }

  toastStore.success("任务已开始", `已进入《${mission.value.title}》的真实任务流程。`)

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

  const resumePath = missionStore.resolveResumeRoutePath()
  toastStore.info("正在恢复进度", "已为你定位到上次停下来的节点。")
  await router.push(
    resumePath && missionStore.activeSession?.routeId === mission.value.id
      ? resumePath
      : `/missions/${mission.value.id}/map`,
  )
}

onMounted(() => {
  void loadMission()
})
</script>

<template>
  <div class="space-y-4">
    <ClientCard v-if="mission" class="overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <ClientBadge v-if="mission.theme">{{ mission.theme }}</ClientBadge>
            <ClientBadge variant="muted">{{ mission.recommendedAgeBand }}</ClientBadge>
            <ClientBadge variant="muted">{{ getDifficultyLabel(mission.difficultyLevel) }}</ClientBadge>
          </div>

          <div class="space-y-2">
            <h2 class="font-display text-3xl leading-tight text-foreground">{{ mission.title }}</h2>
            <p v-if="mission.summary" class="client-page-copy">{{ mission.summary }}</p>
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

        <div v-if="mission.rewardTitle" class="rounded-[1rem] bg-background/70 p-4">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">奖励</p>
          <p class="mt-3 text-sm leading-6 text-foreground">{{ mission.rewardTitle }}</p>
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
          <ClientButton v-if="canResumeCurrent" class="w-full" @click="handleContinueMission()">继续当前任务</ClientButton>
          <ClientButton
            :variant="canResumeCurrent ? 'outline' : 'default'"
            class="w-full"
            :disabled="missionStore.gameplayPending"
            @click="handleStartMission()"
          >
            {{ missionStore.gameplayPending ? "开始中..." : canResumeCurrent ? "重新开始本路线" : "开始任务" }}
          </ClientButton>
        </div>
      </div>
    </ClientCard>

    <ClientCard v-else-if="missionStore.detailPending">
      <div class="space-y-4 p-5">
        <ClientSkeleton class="h-6 w-32" />
        <ClientSkeleton class="h-10 w-full" />
        <ClientSkeleton class="h-24 w-full" />
        <div class="grid gap-3 sm:grid-cols-2">
          <ClientSkeleton class="h-32 w-full" />
          <ClientSkeleton class="h-32 w-full" />
        </div>
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="任务详情不可用"
      :description="missionStore.gameplayError || missionStore.detailError || '当前路线暂时没有可用详情。'"
    >
      <RouterLink to="/shell/hall" class="block">
        <ClientButton variant="outline" class="w-full">返回任务大厅</ClientButton>
      </RouterLink>
    </ClientEmptyState>
  </div>
</template>
