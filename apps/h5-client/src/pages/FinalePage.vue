<script setup lang="ts">
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { UiButton, UiCard } from "@path-seeker/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { getDifficultyLabel } from "@/utils/puzzleLabels"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()

const routeId = computed(() => String(route.params.routeId || ""))

async function backToArchive() {
  await router.push("/shell/archive")
}

async function replayMission() {
  if (!missionStore.activeMission) {
    return
  }

  const session = await missionStore.replayMission(missionStore.activeMission.id)
  if (!session) {
    return
  }

  await router.push(`/missions/${missionStore.activeMission.id}/map`)
}
</script>

<template>
  <div class="space-y-4">
    <UiCard v-if="missionStore.activeMission && missionStore.activeSession" class="client-panel overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="space-y-2">
          <p v-if="missionStore.activeMission.rewardTitle" class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            {{ missionStore.activeMission.rewardTitle }}
          </p>
          <h2 class="font-display text-3xl leading-tight text-foreground">{{ missionStore.activeMission.title }}</h2>
          <p class="client-page-copy">{{ missionStore.activeMission.finale.debrief }}</p>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-[1rem] bg-background/70 p-4 text-center">
            <p class="text-xs text-muted-foreground">总分</p>
            <p class="mt-2 text-2xl font-semibold text-foreground">{{ missionStore.activeSession.totalScore }}</p>
          </div>
          <div class="rounded-[1rem] bg-background/70 p-4 text-center">
            <p class="text-xs text-muted-foreground">完成</p>
            <p class="mt-2 text-2xl font-semibold text-foreground">
              {{ missionStore.activeSession.solvedChapterIds.length }}/{{ missionStore.activeMission.chapterCount }}
            </p>
          </div>
          <div class="rounded-[1rem] bg-background/70 p-4 text-center">
            <p class="text-xs text-muted-foreground">难度</p>
            <p class="mt-2 text-2xl font-semibold text-foreground">{{ getDifficultyLabel(missionStore.activeMission.difficultyLevel) }}</p>
          </div>
        </div>

        <div class="space-y-3">
          <UiButton variant="outline" class="w-full" @click="backToArchive()">查看归档</UiButton>
          <UiButton class="w-full" @click="replayMission()">重新开始</UiButton>
        </div>
      </div>
    </UiCard>

    <UiCard v-else class="client-panel">
      <div class="space-y-4 p-5">
        <div class="space-y-2">
          <h2 class="text-2xl font-display text-foreground">终局数据不可用</h2>
          <p class="client-page-copy">请先完成当前路线，再查看终局结果。</p>
        </div>

        <UiButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">返回章节地图</UiButton>
      </div>
    </UiCard>
  </div>
</template>
