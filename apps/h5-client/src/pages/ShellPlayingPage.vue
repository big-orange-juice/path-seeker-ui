<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { getPuzzleTypeLabel } from "@/utils/puzzleLabels"

const missionStore = useMissionStore()
const router = useRouter()
const toastStore = useToastStore()

const activeSession = computed(() => missionStore.activeSession)
const resumePath = computed(() => missionStore.resolveResumeRoutePath())
const hasRestorableSession = computed(() => Boolean(activeSession.value))
const activeRouteMapPath = computed(() =>
  activeSession.value ? `/missions/${activeSession.value.routeId}/map` : "/shell/hall",
)
const chapterTimeline = computed(() => {
  if (!missionStore.activeMission || !activeSession.value) {
    return []
  }

  return missionStore.activeMission.chapters.map((chapter, index) => ({
    id: chapter.id,
    title: chapter.title,
    location: chapter.targetLocation,
    solved: activeSession.value?.solvedChapterIds.includes(chapter.id),
    active: activeSession.value?.currentChapterIndex === index,
    index,
  }))
})

async function restoreMission() {
  if (!missionStore.activeSession || missionStore.activeMission) {
    return
  }

  await missionStore.restoreActiveMission()
}

async function continueMission() {
  if (!resumePath.value) {
    toastStore.warning("当前没有可恢复节点", "先回到任务大厅选择一条路线开始。")
    return
  }

  toastStore.info("继续任务", "正在带你回到上次停下来的位置。")
  await router.push(resumePath.value)
}

function clearCurrentSession() {
  missionStore.clearActiveSession()
  toastStore.info("已清空当前会话", "本地恢复记录已移除，但远程任务进度仍保留。")
}

async function jumpToChapter(index: number) {
  if (!activeSession.value || !missionStore.activeMission) {
    return
  }

  missionStore.selectChapter(index)
  const chapter = missionStore.activeMission.chapters[index]
  if (!chapter) {
    return
  }

  toastStore.info("已切换章节", `准备进入 ${chapter.title}。`)
  const path = missionStore.resolveEnterChapterPath(chapter.id)
  await router.push(path || `/missions/${activeSession.value.routeId}/map`)
}

async function replayCurrentMission() {
  if (!activeSession.value) {
    return
  }

  const session = await missionStore.replayMission(activeSession.value.routeId)
  if (!session) {
    toastStore.error("重新开始失败", missionStore.gameplayError || "请稍后再试。")
    return
  }

  toastStore.success("已重建任务会话", "新的任务进度已经就绪。")
  await router.push(`/missions/${session.routeId}/map`)
}

onMounted(() => {
  void restoreMission()
})
</script>

<template>
  <div class="space-y-4">
    <ClientCard v-if="hasRestorableSession">
      <div class="space-y-4 p-5">
        <div class="space-y-1">
          <span class="client-tag is-gold">探索中</span>
          <h2 class="mt-2 text-2xl font-display text-foreground">{{ activeSession?.routeTitle }}</h2>
          <p class="client-page-copy">
            {{ missionStore.currentChapter?.title || "选择一站继续" }}
          </p>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-[0.9rem] bg-background/70 p-3">
            <div class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">进度</div>
            <div class="mt-2 text-lg font-semibold text-foreground">{{ missionStore.progressPercent }}%</div>
          </div>
          <div class="rounded-[0.9rem] bg-background/70 p-3">
            <div class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">已完成</div>
            <div class="mt-2 text-lg font-semibold text-foreground">
              {{ activeSession?.solvedChapterIds.length ?? 0 }}/{{ missionStore.activeMission?.chapterCount ?? 0 }}
            </div>
          </div>
          <div class="rounded-[0.9rem] bg-background/70 p-3">
            <div class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">当前类型</div>
            <div class="mt-2 text-lg font-semibold text-foreground">
              {{ missionStore.currentChapter ? getPuzzleTypeLabel(missionStore.currentChapter.puzzle.templateType, missionStore.currentChapter.puzzle.interactionType) : "待进入" }}
            </div>
          </div>
        </div>

        <div v-if="chapterTimeline.length" class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-foreground">章节时间线</h3>
            <span class="text-sm text-muted-foreground">{{ chapterTimeline.length }} 站</span>
          </div>

          <div class="space-y-3">
            <button
              v-for="chapter in chapterTimeline"
              :key="chapter.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-[1rem] border p-4 text-left transition-colors"
              :class="chapter.active ? 'border-primary bg-primary/5' : chapter.solved ? 'border-primary/30 bg-background/80' : 'border-border bg-background/70'"
              @click="jumpToChapter(chapter.index)"
            >
              <div
                class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                :class="chapter.solved || chapter.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
              >
                {{ chapter.solved ? "✓" : chapter.index + 1 }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-foreground">{{ chapter.title }}</div>
                <div class="text-sm text-muted-foreground">{{ chapter.location }}</div>
              </div>
              <div class="text-right text-xs text-muted-foreground">
                {{ chapter.active ? "当前" : chapter.solved ? "完成" : "可进入" }}
              </div>
            </button>
          </div>
        </div>

        <div class="grid gap-3">
          <ClientButton class="w-full" :disabled="!resumePath" @click="continueMission()">
            继续探索
          </ClientButton>
          <div class="grid grid-cols-2 gap-3">
            <ClientButton variant="outline" class="w-full" @click="router.push(activeRouteMapPath)">
              路线图
            </ClientButton>
            <ClientButton variant="outline" class="w-full" @click="clearCurrentSession()">
              清空
            </ClientButton>
          </div>
          <ClientButton
            v-if="activeSession?.routeId"
            variant="outline"
            class="w-full"
            @click="replayCurrentMission()"
          >
            重新开始
          </ClientButton>
        </div>
      </div>
    </ClientCard>

    <ClientCard v-else-if="missionStore.gameplayPending || missionStore.detailPending">
      <div class="space-y-4 p-5">
        <ClientSkeleton class="h-8 w-36" />
        <div class="grid grid-cols-3 gap-3">
          <ClientSkeleton class="h-20 w-full" />
          <ClientSkeleton class="h-20 w-full" />
          <ClientSkeleton class="h-20 w-full" />
        </div>
        <ClientSkeleton class="h-10 w-full" />
        <ClientSkeleton class="h-10 w-full" />
        <ClientSkeleton class="h-10 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="还没有任务"
      description="先去展厅选一条路线开始。"
      action-text="去展厅"
      @action="router.push('/shell/hall')"
    />
  </div>
</template>
