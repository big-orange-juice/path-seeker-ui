<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import PuzzleRendererHost from "@/components/puzzle/PuzzleRendererHost.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES } from "@/utils/navigation"
import { getPuzzleTypeAction, getPuzzleTypeGlyph, getPuzzleTypeLabel } from "@/utils/puzzleLabels"
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
      value: createDeterministicShuffle(
        puzzle.questionPayload.items.map((item) => item.id),
        puzzle.id,
      ),
    }
  }

  if (puzzle.templateType === "match") {
    return {
      templateType: "match",
      value: [],
    }
  }

  if (puzzle.templateType === "image_puzzle") {
    return {
      templateType: "image_puzzle",
      value: createDeterministicShuffle(
        puzzle.questionPayload.pieces.map((item) => item.id),
        `${puzzle.id}:image`,
      ),
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

  return getPuzzleTypeLabel(missionStore.currentPuzzle.templateType)
})

const puzzleAction = computed(() => {
  if (!missionStore.currentPuzzle) {
    return ""
  }

  return getPuzzleTypeAction(missionStore.currentPuzzle.templateType)
})

const puzzleGlyph = computed(() => {
  if (!missionStore.currentPuzzle) {
    return ""
  }

  return getPuzzleTypeGlyph(missionStore.currentPuzzle.templateType)
})

const hintCaption = computed(() => {
  if (!missionStore.currentHintLevel) {
    return "卡住时再看提示。"
  }

  return "按提示回到展品上再看一眼。"
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

function skipAnswer() {
  const snapshot = missionStore.skipCurrentPuzzle()

  if (!snapshot) {
    return
  }

  feedbackMessage.value = snapshot.narrative
  feedbackVisible.value = true
  feedbackCanAdvance.value = true
  feedbackFinal.value = snapshot.finalChapter
}

function nextStep() {
  if (!feedbackCanAdvance.value) {
    feedbackVisible.value = false
    return
  }

  const path = feedbackFinal.value ? MINI_ROUTES.finale : MINI_ROUTES.chapterResult
  uni.redirectTo({ url: path })
}
</script>

<template>
  <PageScaffold title="解谜">
    <view v-if="missionStore.currentPuzzle" class="content-stack bottom-safe">
      <view class="puzzle-card">
        <view class="puzzle-badge">
          <text class="badge-glyph">{{ puzzleGlyph }}</text>
          <view>
            <text class="eyebrow">{{ puzzleLabel }}</text>
            <text class="badge-action">{{ puzzleAction }}</text>
          </view>
        </view>
        <text class="display-title puzzle-title">{{ missionStore.currentPuzzle.prompt }}</text>
      </view>

      <view class="renderer-panel panel">
        <view class="renderer-head">
          <text class="section-title">互动操作台</text>
          <text class="muted-copy">先动手，再看提示，最后提交。</text>
        </view>
        <PuzzleRendererHost v-if="draft" :puzzle="missionStore.currentPuzzle" :model-value="draft" @update:model-value="draft = $event" />
      </view>

      <view class="support-grid">
        <view class="hint-card panel-soft">
          <view class="hint-head">
            <text class="section-title">提示</text>
            <text class="muted-copy">{{ hintCaption }}</text>
          </view>
          <text v-if="missionStore.currentHintText" class="body-copy hint-text">{{ missionStore.currentHintText }}</text>
        </view>

        <view class="panel action-dock">
          <text class="section-title">本轮操作</text>
          <view class="button-row">
            <button class="secondary-button" :disabled="missionStore.gameplayPending" @click="useHint">看提示</button>
            <button class="ghost-button" @click="skipAnswer">跳过</button>
          </view>
          <button class="primary-button" :disabled="missionStore.gameplayPending" @click="submitAnswer">
            {{ missionStore.gameplayPending ? '提交中...' : '提交答案' }}
          </button>
          <text v-if="missionStore.gameplayError" class="muted-copy">{{ missionStore.gameplayError }}</text>
        </view>
      </view>
    </view>

    <transition name="pop-in">
      <view v-if="feedbackVisible" class="feedback-mask">
        <view class="panel feedback-card">
          <text class="section-title">{{ feedbackCanAdvance ? '找到了' : '再试一次' }}</text>
          <text class="body-copy">{{ feedbackMessage }}</text>
          <button class="primary-button feedback-button" @click="nextStep">
            {{ feedbackCanAdvance ? (feedbackFinal ? '查看结局' : '收下线索') : '回去观察' }}
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
  border-radius: 34rpx;
  background:
    radial-gradient(circle at 88% 12%, rgba(209, 178, 111, 0.22), transparent 26%),
    linear-gradient(180deg, rgba(38, 34, 27, 0.98), rgba(14, 16, 20, 0.98));
}

.puzzle-badge {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.badge-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 62rpx;
  height: 62rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #d1b26f, #f1d89c);
  color: #171310;
  font-size: 24rpx;
  font-weight: 900;
}

.badge-action {
  display: block;
  margin-top: 4rpx;
  color: rgba(247, 239, 221, 0.58);
  font-size: 22rpx;
  font-weight: 700;
}

.puzzle-title {
  display: block;
  margin-top: 24rpx;
  font-size: 36rpx;
  line-height: 1.22;
}

.renderer-panel,
.hint-card,
.feedback-card {
  padding: 24rpx;
}

.renderer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 18rpx;
}

.hint-card {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.support-grid {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.hint-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.hint-text {
  margin-top: 2rpx;
}

.action-dock {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 24rpx;
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
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.feedback-button {
  margin-top: 2rpx;
}
</style>
