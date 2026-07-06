<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { UiBadge, UiButton, UiCard } from "@path-seeker/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { getPuzzleTypeLabel } from "@/utils/puzzleLabels"
import { toSingleSentence } from "@/utils/copy"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()

const routeId = computed(() => String(route.params.routeId || ""))
const chapterId = computed(() => String(route.params.chapterId || ""))

const artifactStory = computed(() => toSingleSentence(missionStore.currentArtifact?.storyFragment || ""))
const observeTips = computed(() => {
  const artifact = missionStore.currentArtifact
  if (!artifact) {
    return []
  }

  return [artifact.detailCallout, artifact.observationPoint, artifact.suspiciousPoint, ...artifact.checklist]
    .map((item) => toSingleSentence(item))
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
  await router.push(`/missions/${routeId.value}/chapters/${chapterId.value}/puzzle`)
}

onMounted(() => {
  void ensureMissionReady()
})
</script>

<template>
  <div class="space-y-4">
    <UiCard v-if="missionStore.currentArtifact && missionStore.currentChapter" class="client-panel overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <UiBadge>{{ missionStore.currentArtifact.location }}</UiBadge>
            <UiBadge variant="muted">
              {{ getPuzzleTypeLabel(missionStore.currentChapter.puzzle.templateType, missionStore.currentChapter.puzzle.interactionType) }}
            </UiBadge>
          </div>

          <div class="space-y-2">
            <h2 class="font-display text-3xl leading-tight text-foreground">{{ missionStore.currentArtifact.title }}</h2>
            <p class="client-page-copy">
              {{ missionStore.currentArtifact.subtitle || artifactStory }}
            </p>
          </div>
        </div>

        <div class="rounded-[1rem] bg-background/70 p-4">
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
          <UiButton class="w-full" @click="goPuzzle()">开始作答</UiButton>
          <UiButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">返回章节地图</UiButton>
        </div>
      </div>
    </UiCard>

    <UiCard v-else-if="missionStore.gameplayPending || missionStore.detailPending" class="client-panel">
      <div class="p-5 text-sm leading-6 text-muted-foreground">正在恢复当前章节...</div>
    </UiCard>

    <UiCard v-else class="client-panel">
      <div class="space-y-4 p-5">
        <div class="space-y-2">
          <h2 class="text-2xl font-display text-foreground">当前章节不可用</h2>
          <p class="client-page-copy">{{ missionStore.gameplayError || missionStore.detailError || "请回到章节地图重新进入。" }}</p>
        </div>

        <UiButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">返回章节地图</UiButton>
      </div>
    </UiCard>
  </div>
</template>
