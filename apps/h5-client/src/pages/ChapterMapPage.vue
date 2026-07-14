<script setup lang="ts">
import { computed, onMounted } from "vue"
import { RouterLink, useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { getInteractionTypeMeta } from "@path-seeker/game-renderer"
import { ClientBadge, ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()

const routeId = computed(() => String(route.params.routeId || ""))

const chapterStatuses = computed(() => {
  if (!missionStore.activeMission || !missionStore.activeSession) {
    return []
  }

  return missionStore.activeMission.chapters.map((chapter, index) => {
    const progress = missionStore.getChapterProgress(chapter.id)
    const solved = missionStore.activeSession?.solvedChapterIds.includes(chapter.id) || progress.solved
    const active = missionStore.activeSession?.currentChapterIndex === index

    const type = Number(chapter.interactionType ?? chapter.puzzle?.interactionType ?? 0)
    const typeLabel = getInteractionTypeMeta(type)?.label || ""

    let stateLabel = "待探索"
    if (solved) {
      stateLabel = "完成"
    } else if (active) {
      stateLabel = "当前"
    } else if (type === 11) {
      stateLabel = "待收听"
    } else if (progress.videoWatched) {
      stateLabel = type === 10 ? "待完成" : "待闯关"
    } else if (progress.recognized) {
      stateLabel = "待播片"
    } else if (type === 10) {
      stateLabel = "待找一找"
    }

    return {
      ...chapter,
      index,
      solved,
      active,
      stateLabel,
      typeLabel,
      displayNo: chapter.sortOrder || chapter.stageNo || index + 1,
    }
  })
})

const currentStepLabel = computed(() => {
  if (!missionStore.activeSession || !missionStore.activeMission) {
    return ""
  }

  return `${missionStore.activeSession.solvedChapterIds.length}/${missionStore.activeMission.chapterCount}`
})

async function ensureMissionReady() {
  // 刷新后 missionMap 不在持久化里：有会话无详情时走 MyRouteProgress 恢复
  if (missionStore.activeSession?.routeId === routeId.value) {
    if (!missionStore.activeMission) {
      await missionStore.restoreActiveMission()
    }
    return
  }

  // 禁止页面内隐式 Join：无会话回详情明确开始
  await router.replace(`/tasks/${routeId.value}`)
}

function selectChapter(index: number) {
  const alreadySelected = missionStore.activeSession?.currentChapterIndex === index
  missionStore.selectChapter(index)
  if (alreadySelected) {
    void enterSelectedChapter()
  }
}

async function enterSelectedChapter() {
  if (!missionStore.currentChapter || !missionStore.activeSession) {
    return
  }

  const chapter = missionStore.currentChapter
  const progress = missionStore.getChapterProgress(chapter.id)

  if (progress.solved || missionStore.activeSession.solvedChapterIds.includes(chapter.id)) {
    toastStore.info("这一站已完成", "可以选其他站点继续探索。")
    return
  }

  const path = missionStore.resolveEnterChapterPath(chapter.id)
  if (!path) {
    return
  }

  await router.push(path)
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
            <ClientBadge>{{ currentStepLabel }} 站 · {{ missionStore.activeSession.totalScore }} 分</ClientBadge>
            <h2 class="font-display text-3xl leading-tight text-foreground">
              {{ missionStore.currentChapter?.title || missionStore.activeMission.title }}
            </h2>
            <p v-if="missionStore.currentChapter?.targetLocation" class="client-page-copy">
              {{ missionStore.currentChapter.targetLocation }}
            </p>
          </div>
          <div class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {{ missionStore.progressPercent }}%
          </div>
        </div>

        <div
          v-if="missionStore.currentChapter"
          class="rounded-[1rem] bg-background/70 p-4"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">本章简介</p>
          <h3 class="mt-2 text-lg font-semibold text-foreground">{{ missionStore.currentChapter.title }}</h3>
          <p class="mt-2 text-sm leading-6 text-muted-foreground">
            {{
              missionStore.currentChapter.objective
                || missionStore.currentChapter.artifact.detailCallout
                || "到站后细细观察。"
            }}
          </p>
          <p v-if="missionStore.currentChapter.targetLocation" class="mt-2 text-xs text-muted-foreground">
            {{ missionStore.currentChapter.targetLocation }}
          </p>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-foreground">路线站点</h3>
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
              <div
                class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                :class="chapter.solved || chapter.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
              >
                {{ chapter.solved ? "✓" : chapter.displayNo }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-foreground">{{ chapter.title }}</div>
                <div class="text-sm text-muted-foreground">
                  <span v-if="chapter.typeLabel">{{ chapter.typeLabel }}</span>
                  <span v-if="chapter.typeLabel && chapter.targetLocation"> · </span>
                  <span v-if="chapter.targetLocation">{{ chapter.targetLocation }}</span>
                </div>
              </div>
              <div class="text-right text-xs text-muted-foreground">
                {{ chapter.stateLabel }}
              </div>
            </button>
          </div>
        </div>

        <div class="grid gap-3">
          <ClientButton class="w-full" @click="enterSelectedChapter()">进入这一站</ClientButton>
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
