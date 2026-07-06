<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { UiBadge, UiButton, UiCard } from "@path-seeker/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { toSingleSentence } from "@/utils/copy"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()

const routeId = computed(() => String(route.params.routeId || ""))
const introCopy = computed(() => toSingleSentence(missionStore.activeMission?.introPanel.narrative || ""))

async function ensureMissionReady() {
  if (missionStore.activeSession?.routeId === routeId.value && missionStore.activeMission) {
    return
  }

  if (missionStore.activeSession?.routeId === routeId.value) {
    await missionStore.restoreActiveMission()
    return
  }

  const mission = missionStore.getMission(routeId.value) || await missionStore.loadMissionDetail(routeId.value)
  if (!mission) {
    return
  }

  await missionStore.startRemoteMission(mission.id)
}

async function enterMap() {
  await router.push(`/missions/${routeId.value}/map`)
}

onMounted(() => {
  void ensureMissionReady()
})
</script>

<template>
  <div class="space-y-4">
    <UiCard v-if="missionStore.activeMission" class="client-panel overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <UiBadge v-if="missionStore.activeMission.persona.name">{{ missionStore.activeMission.persona.name }}</UiBadge>
            <UiBadge variant="muted">{{ missionStore.activeMission.theme }}</UiBadge>
          </div>

          <div class="space-y-2">
            <h2 class="font-display text-3xl leading-tight text-foreground">{{ missionStore.activeMission.title }}</h2>
            <p v-if="introCopy" class="client-page-copy">{{ introCopy }}</p>
          </div>
        </div>

        <div v-if="missionStore.activeMission.prologue.length" class="space-y-3">
          <div
            v-for="beat in missionStore.activeMission.prologue"
            :key="beat.title"
            class="rounded-[1rem] bg-background/70 p-4"
          >
            <p v-if="beat.eyebrow" class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{{ beat.eyebrow }}</p>
            <h3 class="mt-2 text-lg font-semibold text-foreground">{{ beat.title }}</h3>
            <p v-if="beat.content" class="mt-2 text-sm leading-6 text-muted-foreground">{{ toSingleSentence(beat.content) }}</p>
          </div>
        </div>

        <div v-if="missionStore.activeMission.startLocation" class="rounded-[1rem] bg-background/70 p-4">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">起点</p>
          <p class="mt-2 text-sm font-medium text-foreground">{{ missionStore.activeMission.startLocation }}</p>
        </div>

        <UiButton class="w-full" @click="enterMap()">进入章节地图</UiButton>
      </div>
    </UiCard>

    <UiCard v-else-if="missionStore.gameplayPending || missionStore.detailPending" class="client-panel">
      <div class="p-5 text-sm leading-6 text-muted-foreground">正在加载开场内容...</div>
    </UiCard>

    <UiCard v-else class="client-panel">
      <div class="space-y-4 p-5">
        <div class="space-y-2">
          <h2 class="text-2xl font-display text-foreground">开场内容不可用</h2>
          <p class="client-page-copy">{{ missionStore.gameplayError || missionStore.detailError || "请回到任务详情重新进入。" }}</p>
        </div>

        <UiButton variant="outline" class="w-full" @click="router.push(`/tasks/${routeId}`)">返回任务详情</UiButton>
      </div>
    </UiCard>
  </div>
</template>
