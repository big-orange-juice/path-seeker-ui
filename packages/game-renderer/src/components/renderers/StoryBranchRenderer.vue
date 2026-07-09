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
  <div ref="root" class="branch-stack">
    <div v-if="puzzle.questionPayload.sceneIntro" class="branch-scene">
      <span class="scene-label">剧情分歧</span>
      <span class="scene-copy">{{ puzzle.questionPayload.sceneIntro }}</span>
    </div>

    <button
      v-for="option in puzzle.questionPayload.options"
      :key="option.id"
      class="branch-card"
      :class="{ 'is-active': modelValue?.value === option.id }"
      :disabled="readonlyMode"
      @click="selectOption(option.id)"
    >
      <div class="branch-head">
        <span class="branch-title">{{ option.label }}</span>
        <span class="branch-arrow">{{ modelValue?.value === option.id ? "已选" : "选择" }}</span>
      </div>
      <span v-if="option.summary" class="branch-summary">{{ option.summary }}</span>
      <div v-if="modelValue?.value === option.id && option.outcomeTitle" class="branch-outcome">
        <span class="outcome-title">{{ option.outcomeTitle }}</span>
        <span v-if="option.outcomeText" class="outcome-copy">{{ option.outcomeText }}</span>
      </div>
    </button>
  </div>
</template>

<style scoped>
.branch-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.branch-scene,
.branch-card {
  padding: 18px;
  border-radius: 24px;
}

.branch-scene {
  border: 1px solid rgba(209, 178, 111, 0.24);
  background: rgba(209, 178, 111, 0.08);
}

.scene-label {
  color: #d1b26f;
  font-size: 20px;
  font-weight: 900;
}

.scene-copy {
  display: block;
  margin-top: 8px;
  color: rgba(247, 239, 221, 0.82);
  font-size: 24px;
  line-height: 1.42;
}

.branch-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  gap: 12px;
}

.branch-title {
  flex: 1;
  color: #fff8ea;
  font-size: 28px;
  font-weight: 900;
  line-height: 1.3;
}

.branch-arrow {
  color: #d1b26f;
  font-size: 20px;
  font-weight: 900;
}

.branch-summary,
.outcome-copy {
  color: rgba(247, 239, 221, 0.62);
  font-size: 22px;
  line-height: 1.42;
}

.branch-outcome {
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.outcome-title {
  color: #fff8ea;
  font-size: 22px;
  font-weight: 900;
}
</style>
