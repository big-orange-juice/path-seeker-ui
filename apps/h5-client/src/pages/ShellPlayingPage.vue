<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRouter } from "vue-router"
import { UiButton, UiCard } from "@path-seeker/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { getPuzzleTypeLabel } from "@/utils/puzzleLabels"

const missionStore = useMissionStore()
const router = useRouter()

const resumePath = computed(() => missionStore.resolveResumeRoutePath())

async function restoreMission() {
  if (!missionStore.activeSession || missionStore.activeMission) {
    return
  }

  await missionStore.restoreActiveMission()
}

async function continueMission() {
  if (!resumePath.value) {
    return
  }

  await router.push(resumePath.value)
}

onMounted(() => {
  void restoreMission()
})
</script>

<template>
  <div class="space-y-4">
    <UiCard v-if="missionStore.activeSession" class="client-panel">
      <div class="space-y-4 p-5">
        <div class="space-y-1">
          <p class="text-xs font-semibold uppercase tracking-[0.14em] text-primary">当前任务</p>
          <h2 class="text-2xl font-display text-foreground">{{ missionStore.activeSession.routeTitle }}</h2>
          <p class="client-page-copy">{{ missionStore.currentChapter?.title }}</p>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-[0.9rem] bg-background/70 p-3">
            <div class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">进度</div>
            <div class="mt-2 text-lg font-semibold text-foreground">{{ missionStore.progressPercent }}%</div>
          </div>
          <div class="rounded-[0.9rem] bg-background/70 p-3">
            <div class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">已完成</div>
            <div class="mt-2 text-lg font-semibold text-foreground">
              {{ missionStore.activeSession.solvedChapterIds.length }}/{{ missionStore.activeMission?.chapterCount ?? 0 }}
            </div>
          </div>
          <div class="rounded-[0.9rem] bg-background/70 p-3">
            <div class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">当前类型</div>
            <div class="mt-2 text-lg font-semibold text-foreground">
              {{ missionStore.currentChapter ? getPuzzleTypeLabel(missionStore.currentChapter.puzzle.templateType, missionStore.currentChapter.puzzle.interactionType) : "待进入" }}
            </div>
          </div>
        </div>

        <div class="grid gap-3">
          <UiButton class="w-full" :disabled="!resumePath" @click="continueMission()">
            继续当前进度
          </UiButton>
          <UiButton variant="outline" class="w-full" @click="router.push(`/missions/${missionStore.activeSession.routeId}/map`)">
            查看章节地图
          </UiButton>
          <UiButton variant="outline" class="w-full" @click="missionStore.clearActiveSession()">清空当前会话</UiButton>
        </div>
      </div>
    </UiCard>

    <UiCard v-else class="client-panel">
      <div class="space-y-3 p-5">
        <h2 class="text-xl font-display text-foreground">还没有可恢复的任务</h2>
        <p class="client-page-copy">先去大厅选择一条路线开始。开始后会话会由 Pinia 持久化，回到这里就能继续。</p>
        <UiButton variant="outline" class="w-full" @click="router.push('/shell/hall')">回到任务大厅</UiButton>
      </div>
    </UiCard>
  </div>
</template>
