<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import PuzzleRendererHost from "@/components/puzzle/PuzzleRendererHost.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"
import { getPuzzleTypeLabel } from "@/utils/puzzleLabels"
import type { MissionAnswerDraft, MissionPuzzle } from "@/types/mission"

const missionStore = useMissionStore()
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

const canUseHint = computed(() => !missionStore.currentHintText && !missionStore.gameplayPending)

const canSubmit = computed(() => {
  const puzzle = missionStore.currentPuzzle
  if (!puzzle || missionStore.gameplayPending) {
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
    return puzzle.questionPayload.hotspots.length > 0
  }

  if (puzzle.templateType === "multi_step_reasoning") {
    return puzzle.questionPayload.evidence.length > 0 && puzzle.questionPayload.conclusions.length > 0
  }

  if (puzzle.templateType === "story_branch") {
    return puzzle.questionPayload.options.length > 0
  }

  return true
})

async function useHint() {
  await missionStore.requestHint()
}

async function submitAnswer() {
  if (!draft.value) {
    return
  }

  const result = await missionStore.submitCurrentDraft(draft.value)
  feedbackMessage.value = result.message
  feedbackVisible.value = true
  feedbackCanAdvance.value = result.isCorrect
  feedbackFinal.value = Boolean(result.snapshot?.finalChapter)
}

function nextStep() {
  if (!feedbackCanAdvance.value) {
    feedbackVisible.value = false
    return
  }

  uni.redirectTo({ url: feedbackFinal.value ? MINI_ROUTES.finale : MINI_ROUTES.chapterResult })
}
</script>

<template>
  <PageScaffold title="游玩任务">
    <view v-if="missionStore.currentPuzzle" class="content-stack bottom-safe">
      <view class="puzzle-card">
        <text v-if="puzzleLabel" class="eyebrow">{{ puzzleLabel }}</text>
        <text class="display-title puzzle-title">{{ missionStore.currentPuzzle.prompt }}</text>
      </view>

      <view class="renderer-panel panel">
        <PuzzleRendererHost v-if="draft" :puzzle="missionStore.currentPuzzle" :model-value="draft" @update:model-value="draft = $event" />
      </view>

      <view v-if="missionStore.currentHintText" class="panel hint-card">
        <text class="section-title">提示</text>
        <text class="body-copy hint-text">{{ missionStore.currentHintText }}</text>
      </view>

      <view class="panel action-dock">
        <button class="secondary-button" :disabled="!canUseHint" @click="useHint">看提示</button>
        <button class="primary-button" :disabled="!canSubmit" @click="submitAnswer">
          {{ missionStore.gameplayPending ? '提交中...' : '提交答案' }}
        </button>
        <text v-if="missionStore.gameplayError" class="muted-copy">{{ missionStore.gameplayError }}</text>
      </view>
    </view>

    <transition name="pop-in">
      <view v-if="feedbackVisible" class="feedback-mask">
        <view class="panel feedback-card">
          <text class="section-title">{{ feedbackCanAdvance ? '已通过' : '未通过' }}</text>
          <text v-if="feedbackMessage" class="body-copy">{{ feedbackMessage }}</text>
          <button class="primary-button feedback-button" @click="nextStep">
            {{ feedbackCanAdvance ? (feedbackFinal ? '查看完成结果' : '继续') : '返回修改' }}
          </button>
        </view>
      </view>
    </transition>
  </PageScaffold>
</template>

<style scoped lang="scss">
.puzzle-card {
  padding: 28rpx;
  border: 1px solid rgba(209, 178, 111, 0.26);
  border-radius: 30rpx;
  background: linear-gradient(180deg, rgba(38, 34, 27, 0.98), rgba(14, 16, 20, 0.98));
}

.puzzle-title {
  display: block;
  margin-top: 12rpx;
  font-size: 36rpx;
  line-height: 1.25;
}

.renderer-panel,
.hint-card,
.action-dock,
.feedback-card {
  padding: 24rpx;
}

.hint-card,
.action-dock,
.feedback-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.feedback-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28rpx;
  background: rgba(0, 0, 0, 0.58);
}

.feedback-card {
  width: 100%;
}
</style>



