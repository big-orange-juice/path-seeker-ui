<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { PuzzleRendererHost } from "@path-seeker/game-renderer"
import { createPuzzleDraft } from "@path-seeker/game-runtime"
import { useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionChapterReady } from "@/composables/useMissionChapterReady"
import { getPuzzleTypeLabel } from "@/utils/puzzleLabels"
import type { MissionAnswerDraft } from "@/types/mission"

const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()
const { missionStore, ensureMissionChapter } = useMissionChapterReady()

const routeId = computed(() => String(route.params.routeId || ""))
const chapterId = computed(() => String(route.params.chapterId || ""))
const ready = shallowRef(false)
const draft = shallowRef<MissionAnswerDraft | null>(null)

watch(
  () => missionStore.currentPuzzle,
  (puzzle) => {
    if (!puzzle) {
      draft.value = null
      return
    }

    draft.value = missionStore.getMissionDraft(puzzle.id) || createPuzzleDraft(puzzle)
  },
  { immediate: true },
)

const puzzleLabel = computed(() => {
  if (!missionStore.currentPuzzle) {
    return ""
  }

  return getPuzzleTypeLabel(missionStore.currentPuzzle.templateType, missionStore.currentPuzzle.interactionType)
})

const canUseHint = computed(() => !missionStore.currentChapterSolved && !missionStore.currentHintText && !missionStore.gameplayPending)

const canSubmit = computed(() => {
  const puzzle = missionStore.currentPuzzle
  if (!puzzle || missionStore.currentChapterSolved || missionStore.gameplayPending) {
    return false
  }

  if (puzzle.templateType === "observe_choice" || puzzle.templateType === "select" || puzzle.templateType === "story_branch") {
    return Boolean(draft.value?.value)
  }

  return true
})

async function bootstrap() {
  ready.value = false
  const ok = await ensureMissionChapter(routeId.value, chapterId.value)
  if (!ok) {
    ready.value = true
    return
  }

  const gate = missionStore.getChapterProgress(chapterId.value)
  if (gate.solved || missionStore.currentChapterSolved) {
    ready.value = true
    return
  }
  if (!gate.recognized) {
    await router.replace(`/missions/${routeId.value}/chapters/${chapterId.value}/brief`)
    return
  }
  if (!gate.videoWatched) {
    await router.replace(`/missions/${routeId.value}/chapters/${chapterId.value}/video`)
    return
  }

  ready.value = true
}

async function useHint() {
  const nextLevel = await missionStore.requestHint()
  if (!nextLevel) {
    toastStore.warning("当前没有更多提示", missionStore.gameplayError || "先自己再观察一轮。")
    return
  }

  toastStore.info("已解锁提示", missionStore.currentHintText || "新提示已加入。")
}

async function submitAnswer() {
  if (!draft.value || missionStore.currentChapterSolved) {
    return
  }

  const result = await missionStore.submitCurrentDraft(draft.value)

  if (!result.isCorrect) {
    toastStore.warning("再想想", result.message || "答案还差一点。")
    return
  }

  toastStore.success(
    result.snapshot?.finalChapter ? "本路线已完成" : "章节解锁成功",
    result.message || "可以继续探索。",
  )

  if (result.snapshot?.finalChapter) {
    await router.push(`/missions/${routeId.value}/finale`)
    return
  }

  await router.push(`/missions/${routeId.value}/chapters/${chapterId.value}/result`)
}

onMounted(() => {
  void bootstrap()
})
</script>

<template>
  <div class="space-y-4">
    <ClientCard v-if="ready && missionStore.currentPuzzle" class="overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="flex items-center justify-between gap-3">
          <span v-if="puzzleLabel" class="rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
            {{ puzzleLabel }}
          </span>
          <span class="text-sm text-muted-foreground">
            总分 {{ missionStore.activeSession?.totalScore ?? 0 }}
          </span>
        </div>

        <div class="space-y-2">
          <h2 class="font-display text-2xl leading-tight text-foreground">{{ missionStore.currentPuzzle.prompt }}</h2>
        </div>

        <div class="rounded-[1rem] bg-background/70 p-4">
          <PuzzleRendererHost
            v-if="draft"
            :puzzle="missionStore.currentPuzzle"
            :model-value="draft"
            @update:model-value="draft = $event"
          />
        </div>

        <div v-if="missionStore.currentChapterSolved" class="rounded-[1rem] bg-background/70 p-4">
          <p class="text-sm font-semibold text-foreground">此章节已完成</p>
          <p class="mt-2 text-sm leading-6 text-muted-foreground">可返回路线或查看本站结果。</p>
        </div>

        <div v-if="missionStore.currentHintText" class="rounded-[1rem] bg-primary/10 p-4">
          <p class="text-sm font-semibold text-foreground">提示</p>
          <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ missionStore.currentHintText }}</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <ClientButton variant="outline" class="w-full" :disabled="!canUseHint" @click="useHint()">
            {{ missionStore.currentHintText ? "已用提示" : "提示" }}
          </ClientButton>
          <ClientButton class="w-full" :disabled="!canSubmit" @click="submitAnswer()">
            {{ missionStore.currentChapterSolved ? "已通过" : missionStore.gameplayPending ? "提交中..." : "提交" }}
          </ClientButton>
        </div>

        <ClientButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">
          返回路线
        </ClientButton>

        <p v-if="missionStore.gameplayError" class="text-sm leading-6 text-destructive">{{ missionStore.gameplayError }}</p>
      </div>
    </ClientCard>

    <ClientCard v-else-if="!ready || missionStore.gameplayPending || missionStore.detailPending">
      <div class="space-y-4 p-5">
        <ClientSkeleton class="h-5 w-24" />
        <ClientSkeleton class="h-10 w-3/4" />
        <ClientSkeleton class="h-56 w-full" />
        <ClientSkeleton class="h-10 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="当前题目不可用"
      :description="missionStore.gameplayError || missionStore.detailError || '请回到路线重新进入。'"
      action-text="返回路线"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>
