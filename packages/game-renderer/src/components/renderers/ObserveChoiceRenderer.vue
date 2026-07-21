<script setup lang="ts">
import { computed, nextTick, watch } from "vue"
import { gsap } from "gsap"
import { useRendererMotion } from "../../composables/useRendererMotion"
import type { ObserveChoicePuzzleDefinition, PuzzleAnswerDraft } from "../../contracts"

const props = withDefaults(defineProps<{
  puzzle: ObserveChoicePuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  readonlyMode?: boolean
}>(), { readonlyMode: false })

const emit = defineEmits<{ "update:modelValue": [value: PuzzleAnswerDraft] }>()
const { root, animateSelector } = useRendererMotion(() => {
  gsap.from(".choice-card, .answer-field", { autoAlpha: 0, y: 10, duration: 0.32, ease: "power2.out", stagger: 0.04 })
})
const options = computed(() => props.puzzle.questionPayload?.options ?? [])
const isFreeText = computed(() => options.value.length === 0)
const textValue = computed(() => typeof props.modelValue?.value === "string" ? props.modelValue.value : "")
function selectOption(optionId: string) {
  if (!props.readonlyMode) emit("update:modelValue", { templateType: "observe_choice", value: optionId })
}
function handleTextInput(event: Event) {
  if (!props.readonlyMode) emit("update:modelValue", { templateType: "observe_choice", value: String((event.target as HTMLTextAreaElement | null)?.value ?? "") })
}
watch(() => props.modelValue?.value, async (value) => {
  if (isFreeText.value || typeof value !== "string") return
  await nextTick()
  animateSelector(".choice-card.is-active", { scale: 0.96, y: 4 }, { scale: 1, y: 0, duration: 0.28, ease: "back.out(1.6)" })
})
</script>

<template>
  <div ref="root" class="choice-list" :class="{ 'is-readonly': readonlyMode }">
    <label v-if="isFreeText" class="answer-field">
      <span class="answer-label">你的答案</span>
      <textarea class="answer-textarea" rows="3" :value="textValue" :readonly="readonlyMode" :disabled="readonlyMode" placeholder="在这里写下你的答案…" autocomplete="off" enterkeyhint="done" @input="handleTextInput" />
    </label>
    <div v-else v-for="(option, index) in options" :key="option.id" class="choice-card" :class="{ 'is-active': modelValue?.value === option.id }">
      <button type="button" class="choice-hit" :disabled="readonlyMode" @click="selectOption(option.id)">
        <span class="choice-index">{{ index + 1 }}</span><span class="choice-title">{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.choice-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.answer-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.answer-label {
  color: rgba(247, 239, 221, 0.62);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.answer-textarea {
  display: block;
  width: 100%;
  min-height: 5.5rem;
  resize: vertical;
  border: 1px solid rgba(247, 239, 221, 0.12);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(8, 9, 12, 0.72);
  color: #fff8ea;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  outline: none;
}

.answer-textarea::placeholder {
  color: rgba(247, 239, 221, 0.38);
  font-weight: 500;
}

.answer-textarea:focus {
  border-color: rgba(209, 178, 111, 0.55);
}

.answer-textarea:disabled,
.answer-textarea[readonly] {
  cursor: default;
  opacity: 0.72;
}

.choice-card {
  display: flex;
  align-items: center;
  min-height: 48px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.045);
  overflow: hidden;
}

.choice-card.is-active {
  background: rgba(209, 178, 111, 0.14);
  box-shadow: inset 0 0 0 1px rgba(209, 178, 111, 0.4);
}

.choice-hit {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  margin: 0;
  padding: 10px 12px;
  border: 0;
  background: transparent;
  text-align: left;
  color: inherit;
  cursor: pointer;
}

.choice-hit:disabled {
  cursor: default;
}

.choice-index {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-left: 10px;
  border-radius: 999px;
  background: rgba(247, 239, 221, 0.08);
  color: #d1b26f;
  font-size: 13px;
  font-weight: 700;
}

.choice-hit .choice-index {
  margin-left: 0;
}

.choice-title {
  flex: 1;
  color: #fff8ea;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.choice-studio {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: end;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
}

.choice-studio .choice-index {
  margin: 0 0 2px;
}

.choice-studio-field {
  min-width: 0;
}
</style>
