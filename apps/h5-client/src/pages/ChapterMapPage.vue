<script setup lang="ts">
import { computed, onMounted } from "vue"
import { RouterLink, useRoute, useRouter } from "vue-router"
import { ClientBadge, ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { getPuzzleTypeLabel } from "@/utils/puzzleLabels"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()

const routeId = computed(() => String(route.params.routeId || ""))

const chapterStatuses = computed(() => {
  if (!missionStore.activeMission || !missionStore.activeSession) {
    return []
  }

  return missionStore.activeMission.chapters.map((chapter, index) => ({
    ...chapter,
    index,
    solved: missionStore.activeSession?.solvedChapterIds.includes(chapter.id),
    active: missionStore.activeSession?.currentChapterIndex === index,
  }))
})

const currentStepLabel = computed(() => {
  if (!missionStore.activeSession || !missionStore.activeMission) {
    return ""
  }

  return `已完成 ${missionStore.activeSession.solvedChapterIds.length} / ${missionStore.activeMission.chapterCount}`
})

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

function selectChapter(index: number) {
  missionStore.selectChapter(index)
}

async function goCurrentChapter() {
  if (!missionStore.currentChapter) {
    return
  }

  await router.push(`/missions/${routeId.value}/chapters/${missionStore.currentChapter.id}/clue`)
}

async function goBackToDetail() {
  await router.push(`/tasks/${routeId.value}`)
}

onMounted(() => {
  void ensureMissionReady()
})
</script>

<template>
  <div class="space-y-4">
    <ClientCard v-if="missionStore.activeMission && missionStore.activeSession" class="overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <ClientBadge>{{ currentStepLabel }}</ClientBadge>
            <h2 class="font-display text-3xl leading-tight text-foreground">{{ missionStore.currentChapter?.title }}</h2>
            <p class="client-page-copy">{{ missionStore.currentChapter?.targetLocation }}</p>
          </div>
          <div class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {{ missionStore.progressPercent }}%
          </div>
        </div>

        <div class="rounded-[1rem] bg-background/70 p-4">
          <div v-if="missionStore.currentChapter?.objective" class="text-sm font-semibold text-foreground">
            {{ missionStore.currentChapter?.objective }}
          </div>
          <div
            v-if="missionStore.currentChapter?.artifact.subtitle"
            class="text-sm leading-6 text-muted-foreground"
            :class="missionStore.currentChapter?.objective ? 'mt-2' : ''"
          >
            {{ missionStore.currentChapter?.artifact.subtitle }}
          </div>
          <div class="mt-3 text-xs text-muted-foreground">
            {{ missionStore.currentChapter ? getPuzzleTypeLabel(missionStore.currentChapter.puzzle.templateType, missionStore.currentChapter.puzzle.interactionType) : "" }}
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-foreground">章节列表</h3>
            <span class="text-sm text-muted-foreground">{{ missionStore.activeMission.chapterCount }} 站</span>
          </div>

          <div class="space-y-3">
            <button
              v-for="chapter in chapterStatuses"
              :key="chapter.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-[1rem] border p-4 text-left transition-colors"
              :class="chapter.active ? 'border-primary bg-primary/5' : chapter.solved ? 'border-primary/30 bg-background/80' : 'border-border bg-background/70'"
              @click="selectChapter(chapter.index)"
            >
              <div class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                :class="chapter.solved || chapter.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'">
                {{ chapter.solved ? "✓" : chapter.stageNo }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-foreground">{{ chapter.title }}</div>
                <div class="text-sm text-muted-foreground">{{ chapter.targetLocation }}</div>
              </div>
              <div class="text-right text-xs text-muted-foreground">
                {{ chapter.active ? "已选" : chapter.solved ? "完成" : "待探索" }}
              </div>
            </button>
          </div>
        </div>

        <div class="grid gap-3">
          <ClientButton class="w-full" @click="goCurrentChapter()">进入当前章节</ClientButton>
          <ClientButton variant="outline" class="w-full" @click="goBackToDetail()">返回任务详情</ClientButton>
        </div>
      </div>
    </ClientCard>

    <ClientCard v-else-if="missionStore.gameplayPending || missionStore.detailPending">
      <div class="space-y-4 p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <ClientSkeleton class="h-6 w-28 rounded-full" />
            <ClientSkeleton class="h-10 w-48" />
            <ClientSkeleton class="h-5 w-32" />
          </div>
          <ClientSkeleton class="h-8 w-16 rounded-full" />
        </div>
        <ClientSkeleton class="h-24 w-full" />
        <ClientSkeleton class="h-20 w-full" />
        <ClientSkeleton class="h-20 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="还没有可用的任务会话"
      :description="missionStore.gameplayError || missionStore.detailError || '先回到任务详情重新开始路线。'"
    >
      <RouterLink :to="`/tasks/${routeId}`" class="block">
        <ClientButton variant="outline" class="w-full">返回任务详情</ClientButton>
      </RouterLink>
    </ClientEmptyState>
  </div>
</template>
