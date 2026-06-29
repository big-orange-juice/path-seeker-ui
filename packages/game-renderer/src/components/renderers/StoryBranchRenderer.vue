<script setup lang="ts">
import { nextTick, watch } from "vue"
import { gsap } from "gsap"
import { useRendererMotion } from "../../composables/useRendererMotion"
import type { PuzzleAnswerDraft, StoryBranchPuzzleDefinition } from "../../contracts"

interface Props {
  puzzle: StoryBranchPuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  readonlyMode?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
}>()

const { root, animateSelector } = useRendererMotion(() => {
  const tl = gsap.timeline({ defaults: { ease: "power2.out" } })

  tl.from(".branch-scene", {
    autoAlpha: 0,
    y: 12,
    duration: 0.3,
  }).from(
    ".branch-card",
    {
      autoAlpha: 0,
      x: -22,
      duration: 0.34,
      stagger: 0.06,
    },
    "-=0.12",
  )
})

function selectOption(optionId: string) {
  emit("update:modelValue", {
    templateType: "story_branch",
    value: optionId,
  })
}

watch(
  () => props.modelValue?.value,
  async (value) => {
    if (typeof value !== "string") {
      return
    }

    await nextTick()
    animateSelector(
      ".branch-card.is-active",
      { x: 18, scale: 0.96 },
      { x: 0, scale: 1, duration: 0.36, ease: "back.out(1.6)" },
    )
  },
)
</script>

<template>
  <view ref="root" class="branch-stack">
    <view v-if="puzzle.questionPayload.sceneIntro" class="branch-scene">
      <text class="scene-label">剧情分歧</text>
      <text class="scene-copy">{{ puzzle.questionPayload.sceneIntro }}</text>
    </view>

    <button
      v-for="option in puzzle.questionPayload.options"
      :key="option.id"
      class="branch-card"
      :class="{ 'is-active': modelValue?.value === option.id }"
      :disabled="readonlyMode"
      @click="selectOption(option.id)"
    >
      <view class="branch-head">
        <text class="branch-title">{{ option.label }}</text>
        <text class="branch-arrow">{{ modelValue?.value === option.id ? "已选" : "选择" }}</text>
      </view>
      <text v-if="option.summary" class="branch-summary">{{ option.summary }}</text>
      <view v-if="modelValue?.value === option.id && option.outcomeTitle" class="branch-outcome">
        <text class="outcome-title">{{ option.outcomeTitle }}</text>
        <text v-if="option.outcomeText" class="outcome-copy">{{ option.outcomeText }}</text>
      </view>
    </button>
  </view>
</template>

<style scoped>
.branch-stack {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.branch-scene,
.branch-card {
  padding: 18rpx;
  border-radius: 24rpx;
}

.branch-scene {
  border: 1px solid rgba(209, 178, 111, 0.24);
  background: rgba(209, 178, 111, 0.08);
}

.scene-label {
  color: #d1b26f;
  font-size: 20rpx;
  font-weight: 900;
}

.scene-copy {
  display: block;
  margin-top: 8rpx;
  color: rgba(247, 239, 221, 0.82);
  font-size: 24rpx;
  line-height: 1.42;
}

.branch-card {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  background: rgba(255, 255, 255, 0.045);
  text-align: left;
}

.branch-card.is-active {
  box-shadow: inset 0 0 0 1px rgba(209, 178, 111, 0.42);
  background: rgba(209, 178, 111, 0.12);
}

.branch-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
}

.branch-title {
  flex: 1;
  color: #fff8ea;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.3;
}

.branch-arrow {
  color: #d1b26f;
  font-size: 20rpx;
  font-weight: 900;
}

.branch-summary,
.outcome-copy {
  color: rgba(247, 239, 221, 0.62);
  font-size: 22rpx;
  line-height: 1.42;
}

.branch-outcome {
  margin-top: 2rpx;
  padding-top: 10rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.outcome-title {
  color: #fff8ea;
  font-size: 22rpx;
  font-weight: 900;
}
</style>
