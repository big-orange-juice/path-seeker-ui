<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { ClientBadge, ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { getPuzzleTypeLabel } from "@/utils/puzzleLabels"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()

const routeId = computed(() => String(route.params.routeId || ""))
const chapterId = computed(() => String(route.params.chapterId || ""))

const observeTips = computed(() => {
  const artifact = missionStore.currentArtifact
  if (!artifact) {
    return []
  }

  return [artifact.detailCallout, artifact.observationPoint, artifact.suspiciousPoint, ...artifact.checklist]
    .filter(Boolean)
})

async function ensureMissionReady() {
  if (missionStore.activeSession?.routeId !== routeId.value) {
    await missionStore.restoreActiveMission()
  }

  if (!missionStore.activeMission || missionStore.activeSession?.routeId !== routeId.value) {
    await missionStore.loadMissionDetail(routeId.value)
    await missionStore.startRemoteMission(routeId.value)
  }

  if (!missionStore.activeMission) {
    return
  }

  const index = missionStore.activeMission.chapters.findIndex((chapter) => chapter.id === chapterId.value)
  if (index >= 0) {
    missionStore.selectChapter(index)
  }
}

async function goPuzzle() {
  toastStore.info("进入作答", "观察信息已保留，可以开始挑战当前题目。")
  await router.push(`/missions/${routeId.value}/chapters/${chapterId.value}/puzzle`)
}

onMounted(() => {
  void ensureMissionReady()
})
</script>

<template>
  <div class="space-y-4">
    <ClientCard v-if="missionStore.currentArtifact && missionStore.currentChapter" class="overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <ClientBadge v-if="missionStore.currentArtifact.location">{{ missionStore.currentArtifact.location }}</ClientBadge>
            <ClientBadge variant="muted">
              {{ getPuzzleTypeLabel(missionStore.currentChapter.puzzle.templateType, missionStore.currentChapter.puzzle.interactionType) }}
            </ClientBadge>
          </div>

          <div class="space-y-2">
            <h2 class="font-display text-3xl leading-tight text-foreground">{{ missionStore.currentArtifact.title }}</h2>
            <p v-if="missionStore.currentArtifact.subtitle" class="client-page-copy">{{ missionStore.currentArtifact.subtitle }}</p>
          </div>
        </div>

        <div v-if="missionStore.currentChapter.objective" class="rounded-[1rem] bg-background/70 p-4">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">章节目标</p>
          <p class="mt-3 text-sm leading-6 text-foreground">{{ missionStore.currentChapter.objective }}</p>
        </div>

        <div v-if="observeTips.length" class="space-y-3">
          <h3 class="text-lg font-semibold text-foreground">观察提示</h3>
          <div class="space-y-3">
            <div
              v-for="(item, index) in observeTips"
              :key="`${index}-${item}`"
              class="rounded-[1rem] bg-background/70 p-4 text-sm leading-6 text-muted-foreground"
            >
              {{ item }}
            </div>
          </div>
        </div>

        <div class="grid gap-3">
          <ClientButton class="w-full" @click="goPuzzle()">开始作答</ClientButton>
          <ClientButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">返回章节地图</ClientButton>
        </div>
      </div>
    </ClientCard>

    <ClientCard v-else-if="missionStore.gameplayPending || missionStore.detailPending">
      <div class="space-y-4 p-5">
        <div class="flex gap-2">
          <ClientSkeleton class="h-6 w-24 rounded-full" />
          <ClientSkeleton class="h-6 w-28 rounded-full" />
        </div>
        <ClientSkeleton class="h-10 w-2/3" />
        <ClientSkeleton class="h-20 w-full" />
        <ClientSkeleton class="h-16 w-full" />
        <ClientSkeleton class="h-10 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="当前章节不可用"
      :description="missionStore.gameplayError || missionStore.detailError || '请回到章节地图重新进入。'"
      action-text="返回章节地图"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>
