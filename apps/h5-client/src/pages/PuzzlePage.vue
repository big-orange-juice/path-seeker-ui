<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { UiButton, UiCard } from "@path-seeker/ui"
import { PuzzleRendererHost } from "@path-seeker/game-renderer"
import { useMissionStore } from "@/stores/useMissionStore"
import { getPuzzleTypeLabel } from "@/utils/puzzleLabels"
import type { MissionAnswerDraft, MissionPuzzle } from "@/types/mission"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()

const routeId = computed(() => String(route.params.routeId || ""))
const chapterId = computed(() => String(route.params.chapterId || ""))

const draft = shallowRef<MissionAnswerDraft | null>(null)
const feedbackVisible = shallowRef(false)
const feedbackMessage = shallowRef("")
const feedbackFinal = shallowRef(false)
const feedbackCanAdvance = shallowRef(false)

function createDeterministicShuffle(ids: string[], seed: string) {
  const next = [...ids]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const seedCode = seed.charCodeAt(index % seed.length) || index
    const swapIndex = (seedCode + index) % (index + 1)
    const current = next[index]
    next[index] = next[swapIndex]
    next[swapIndex] = current
  }

  return next
}

function createDraft(puzzle: MissionPuzzle): MissionAnswerDraft {
  if (puzzle.templateType === "sort") {
    return {
      templateType: "sort",
      value: createDeterministicShuffle(puzzle.questionPayload.items.map((item) => item.id), puzzle.id),
    }
  }

  if (puzzle.templateType === "match") {
    return { templateType: "match", value: [] }
  }

  if (puzzle.templateType === "select") {
    return { templateType: "select", value: [] }
  }

  if (puzzle.templateType === "image_puzzle") {
    return {
      templateType: "image_puzzle",
      value: createDeterministicShuffle(puzzle.questionPayload.pieces.map((item) => item.id), `${puzzle.id}:image`),
    }
  }

  if (puzzle.templateType === "multi_step_reasoning") {
    return {
      templateType: "multi_step_reasoning",
      value: {
        evidenceOrder: [],
        conclusionId: null,
      },
    }
  }

  return {
    templateType: puzzle.templateType,
    value: "",
  }
}

watch(
  () => missionStore.currentPuzzle,
  (puzzle) => {
    if (!puzzle) {
      draft.value = null
      return
    }

    draft.value = missionStore.getMissionDraft(puzzle.id) || createDraft(puzzle)
    feedbackVisible.value = false
    feedbackMessage.value = ""
    feedbackFinal.value = false
    feedbackCanAdvance.value = false
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
  await missionStore.requestHint()
}

async function submitAnswer() {
  if (!draft.value || missionStore.currentChapterSolved) {
    return
  }

  const result = await missionStore.submitCurrentDraft(draft.value)
  feedbackMessage.value = result.message
  feedbackVisible.value = true
  feedbackCanAdvance.value = result.isCorrect
  feedbackFinal.value = Boolean(result.snapshot?.finalChapter)
}

async function nextStep() {
  if (!feedbackCanAdvance.value) {
    feedbackVisible.value = false
    return
  }

  await router.push(
    feedbackFinal.value
      ? `/missions/${routeId.value}/finale`
      : `/missions/${routeId.value}/chapters/${chapterId.value}/result`,
  )
}

onMounted(() => {
  void ensureMissionReady()
})
</script>

<template>
  <div class="space-y-4">
    <UiCard v-if="missionStore.currentPuzzle" class="client-panel overflow-hidden">
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
          <UiButton variant="outline" class="w-full" :disabled="!canUseHint" @click="useHint()">查看提示</UiButton>
          <UiButton class="w-full" :disabled="!canSubmit" @click="submitAnswer()">
            {{ missionStore.currentChapterSolved ? "已完成" : missionStore.gameplayPending ? "提交中..." : "提交答案" }}
          </UiButton>
          <p v-if="missionStore.gameplayError" class="text-sm leading-6 text-destructive">{{ missionStore.gameplayError }}</p>
        </div>
      </div>
    </UiCard>

    <UiCard v-else-if="missionStore.gameplayPending || missionStore.detailPending" class="client-panel">
      <div class="p-5 text-sm leading-6 text-muted-foreground">正在加载题目...</div>
    </UiCard>

    <UiCard v-else class="client-panel">
      <div class="space-y-4 p-5">
        <div class="space-y-2">
          <h2 class="text-2xl font-display text-foreground">当前题目不可用</h2>
          <p class="client-page-copy">{{ missionStore.gameplayError || missionStore.detailError || "请回到章节地图重新进入。" }}</p>
        </div>

        <UiButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">返回章节地图</UiButton>
      </div>
    </UiCard>

    <div
      v-if="feedbackVisible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
    >
      <UiCard class="client-panel w-full max-w-[28rem]">
        <div class="space-y-4 p-5">
          <div class="space-y-2">
            <h3 class="text-xl font-semibold text-foreground">{{ feedbackCanAdvance ? "已通过" : "未通过" }}</h3>
            <p v-if="feedbackMessage" class="client-page-copy">{{ feedbackMessage }}</p>
          </div>

          <UiButton class="w-full" @click="nextStep()">
            {{ feedbackCanAdvance ? (feedbackFinal ? "查看完成结果" : "继续") : "返回修改" }}
          </UiButton>
        </div>
      </UiCard>
    </div>
  </div>
</template>
