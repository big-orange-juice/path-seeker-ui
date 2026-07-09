<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { PuzzleRendererHost } from "@path-seeker/game-renderer"
import { createPuzzleDraft } from "@path-seeker/game-runtime"
import { useMissionRuntimeStore, useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientCard, ClientDialog, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { getPuzzleTypeLabel } from "@/utils/puzzleLabels"
import type { MissionAnswerDraft } from "@/types/mission"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const missionRuntimeStore = useMissionRuntimeStore()
const toastStore = useToastStore()

const routeId = computed(() => String(route.params.routeId || ""))
const chapterId = computed(() => String(route.params.chapterId || ""))

const draft = shallowRef<MissionAnswerDraft | null>(null)

watch(
  () => missionStore.currentPuzzle,
  (puzzle) => {
    if (!puzzle) {
      draft.value = null
      missionRuntimeStore.closeSubmitFeedback()
      return
    }

    draft.value = missionStore.getMissionDraft(puzzle.id) || createPuzzleDraft(puzzle)
    missionRuntimeStore.closeSubmitFeedback()
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

  if (puzzle.templateType === "observe_choice") {
    return puzzle.questionPayload.options.length > 0
  }

  if (puzzle.templateType === "select") {
    return puzzle.questionPayload.candidates.length > 0
  }

  if (puzzle.templateType === "sort") {
    return puzzle.questionPayload.items.length > 0
  }

  if (puzzle.templateType === "match") {
    return puzzle.questionPayload.left.length > 0 && puzzle.questionPayload.right.length > 0
  }

  if (puzzle.templateType === "image_puzzle") {
    return puzzle.questionPayload.pieces.length > 0
  }

  if (puzzle.templateType === "clue_find") {
    const draftValue = draft.value?.value
    const requiredHits = Math.max(1, Number(puzzle.questionPayload.requiredHits || puzzle.questionPayload.hotspots.length || 1))

    if (puzzle.questionPayload.hotspots.length > 0) {
      return typeof draftValue === "string" && draftValue.length > 0
    }

    return Boolean(puzzle.questionPayload.imageUrl) && Array.isArray(draftValue) && draftValue.length >= requiredHits
  }

  if (puzzle.templateType === "multi_step_reasoning") {
    return puzzle.questionPayload.evidence.length > 0 && puzzle.questionPayload.conclusions.length > 0
  }

  if (puzzle.templateType === "story_branch") {
    return puzzle.questionPayload.options.length > 0
  }

  return true
})

const nextChapter = computed(() => missionStore.getNextUnsolvedChapter(chapterId.value))

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

async function useHint() {
  const nextLevel = await missionStore.requestHint()
  if (!nextLevel) {
    toastStore.warning("当前没有更多提示", missionStore.gameplayError || "先自己再观察一轮，必要时再回来。")
    return
  }

  toastStore.info("已解锁新提示", missionStore.currentHintText || "新提示已经加入当前章节。")
}

async function submitAnswer() {
  if (!draft.value || missionStore.currentChapterSolved) {
    return
  }

  const result = await missionStore.submitCurrentDraft(draft.value)
  missionRuntimeStore.openSubmitFeedback({
    title: result.isCorrect ? "已通过" : "还差一点",
    message: result.message,
    canAdvance: result.isCorrect,
    finalChapter: Boolean(result.snapshot?.finalChapter),
  })

  if (result.isCorrect) {
    toastStore.success(
      result.snapshot?.finalChapter ? "本路线已完成" : "章节解锁成功",
      result.message,
    )
    return
  }

  toastStore.warning("答案未通过", result.message)
}

async function nextStep() {
  if (!missionRuntimeStore.submitFeedback.canAdvance) {
    missionRuntimeStore.closeSubmitFeedback()
    return
  }

  missionRuntimeStore.closeSubmitFeedback()

  if (missionRuntimeStore.submitFeedback.finalChapter) {
    await router.push(`/missions/${routeId.value}/finale`)
    return
  }

  missionStore.advanceFromChapterResult()

  const targetChapter = nextChapter.value || missionStore.currentChapter
  if (!targetChapter) {
    await router.push(`/missions/${routeId.value}/map`)
    return
  }

  await router.push(`/missions/${routeId.value}/chapters/${targetChapter.id}/clue`)
}

onMounted(() => {
  void ensureMissionReady()
})
</script>

<template>
  <div class="space-y-4">
    <ClientCard v-if="missionStore.currentPuzzle" class="overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="space-y-2">
          <p v-if="puzzleLabel" class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{{ puzzleLabel }}</p>
          <h2 class="font-display text-3xl leading-tight text-foreground">{{ missionStore.currentPuzzle.prompt }}</h2>
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
          <p class="mt-2 text-sm leading-6 text-muted-foreground">可以返回章节地图，或者直接查看章节结果。</p>
        </div>

        <div v-if="missionStore.currentHintText" class="rounded-[1rem] bg-background/70 p-4">
          <p class="text-sm font-semibold text-foreground">提示</p>
          <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ missionStore.currentHintText }}</p>
        </div>

        <div class="space-y-3">
          <ClientButton variant="outline" class="w-full" :disabled="!canUseHint" @click="useHint()">查看提示</ClientButton>
          <ClientButton class="w-full" :disabled="!canSubmit" @click="submitAnswer()">
            {{ missionStore.currentChapterSolved ? "已完成" : missionStore.gameplayPending ? "提交中..." : "提交答案" }}
          </ClientButton>
          <p v-if="missionStore.gameplayError" class="text-sm leading-6 text-destructive">{{ missionStore.gameplayError }}</p>
        </div>
      </div>
    </ClientCard>

    <ClientCard v-else-if="missionStore.gameplayPending || missionStore.detailPending">
      <div class="space-y-4 p-5">
        <ClientSkeleton class="h-5 w-24" />
        <ClientSkeleton class="h-10 w-3/4" />
        <ClientSkeleton class="h-56 w-full" />
        <ClientSkeleton class="h-10 w-full" />
        <ClientSkeleton class="h-10 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="当前题目不可用"
      :description="missionStore.gameplayError || missionStore.detailError || '请回到章节地图重新进入。'"
      action-text="返回章节地图"
      @action="router.push(`/missions/${routeId}/map`)"
    />

    <ClientDialog
      :open="missionRuntimeStore.feedbackVisible"
      :title="missionRuntimeStore.submitFeedback.title"
      :description="missionRuntimeStore.submitFeedback.message"
      :confirm-text="missionRuntimeStore.submitFeedback.canAdvance ? (missionRuntimeStore.submitFeedback.finalChapter ? '查看完成结果' : '前往下一章节') : '返回修改'"
      :show-cancel="false"
      content-class="max-w-[28rem]"
      @update:open="(value) => !value && missionRuntimeStore.closeSubmitFeedback()"
      @confirm="nextStep()"
    />
  </div>
</template>
