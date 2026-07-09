<script setup lang="ts">
import { nextTick, watch } from "vue"
import { gsap } from "gsap"
import { useRendererMotion } from "../../composables/useRendererMotion"
import type { ObserveChoicePuzzleDefinition, PuzzleAnswerDraft } from "../../contracts"

interface Props {
  puzzle: ObserveChoicePuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  readonlyMode?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
}>()

const { root, animateSelector } = useRendererMotion(() => {
  gsap.from(".choice-card", {
    autoAlpha: 0,
    y: 18,
    duration: 0.42,
    ease: "power2.out",
    stagger: 0.06,
  })
})

function selectOption(optionId: string) {
  emit("update:modelValue", {
    templateType: "observe_choice",
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
      ".choice-card.is-active",
      { scale: 0.94, y: 6 },
      { scale: 1, y: 0, duration: 0.34, ease: "back.out(1.8)" },
    )
  },
)
</script>

<template>
  <div ref="root" class="choice-list">
    <button
      v-for="(option, index) in puzzle.questionPayload.options"
      :key="option.id"
      class="choice-card"
      :class="{ 'is-active': modelValue?.value === option.id }"
      :disabled="readonlyMode"
      @click="selectOption(option.id)"
    >
      <span class="choice-index">{{ index + 1 }}</span>
      <span class="choice-title">{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.choice-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.choice-card {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 86px;
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.045);
  text-align: left;
}

.choice-card.is-active {
  background: rgba(209, 178, 111, 0.16);
  box-shadow: inset 0 0 0 1px rgba(209, 178, 111, 0.44);
}

.choice-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 999px;
  background: rgba(247, 239, 221, 0.08);
  color: #d1b26f;
  font-size: 22px;
  font-weight: 900;
}

.choice-title {
  flex: 1;
  color: #fff8ea;
  font-size: 28px;
  font-weight: 800;
  line-height: 1.28;
}
</style>
