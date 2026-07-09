<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { ClientBadge, ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()

const routeId = computed(() => String(route.params.routeId || ""))
const introCopy = computed(() => missionStore.activeMission?.summary || "")

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
  toastStore.info("开场结束", "已切换到章节地图，开始正式探索。")
  await router.push(`/missions/${routeId.value}/map`)
}

onMounted(() => {
  void ensureMissionReady()
})
</script>

<template>
  <div class="space-y-4">
    <ClientCard v-if="missionStore.activeMission" class="overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <ClientBadge v-if="missionStore.activeMission.theme">{{ missionStore.activeMission.theme }}</ClientBadge>
            <ClientBadge variant="muted">{{ missionStore.activeMission.recommendedAgeBand }}</ClientBadge>
          </div>

          <div class="space-y-2">
            <h2 class="font-display text-3xl leading-tight text-foreground">{{ missionStore.activeMission.title }}</h2>
            <p v-if="introCopy" class="client-page-copy">{{ introCopy }}</p>
          </div>
        </div>

        <div v-if="missionStore.activeMission.prologue.length" class="space-y-3">
          <div
            v-for="(beat, index) in missionStore.activeMission.prologue"
            :key="beat.title || beat.content || index"
            class="rounded-[1rem] bg-background/70 p-4"
          >
            <p v-if="beat.eyebrow" class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{{ beat.eyebrow }}</p>
            <h3 v-if="beat.title" class="mt-2 text-lg font-semibold text-foreground">{{ beat.title }}</h3>
            <p v-if="beat.content" class="mt-2 text-sm leading-6 text-muted-foreground">{{ beat.content }}</p>
          </div>
        </div>

        <ClientButton class="w-full" @click="enterMap()">进入章节地图</ClientButton>
      </div>
    </ClientCard>

    <ClientCard v-else-if="missionStore.gameplayPending || missionStore.detailPending">
      <div class="space-y-4 p-5">
        <div class="flex gap-2">
          <ClientSkeleton class="h-6 w-24 rounded-full" />
          <ClientSkeleton class="h-6 w-20 rounded-full" />
        </div>
        <ClientSkeleton class="h-10 w-3/4" />
        <ClientSkeleton class="h-24 w-full" />
        <ClientSkeleton class="h-20 w-full" />
        <ClientSkeleton class="h-10 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="开场内容不可用"
      :description="missionStore.gameplayError || missionStore.detailError || '请回到任务详情重新进入。'"
      action-text="返回任务详情"
      @action="router.push(`/tasks/${routeId}`)"
    />
  </div>
</template>
