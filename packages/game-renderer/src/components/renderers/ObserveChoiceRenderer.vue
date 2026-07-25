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
  gsap.from(".choice-row, .answer-field", {
    autoAlpha: 0,
    y: 8,
    duration: 0.28,
    ease: "power2.out",
    stagger: 0.045,
  })
})
const options = computed(() => props.puzzle.questionPayload?.options ?? [])
const isFreeText = computed(() => options.value.length === 0)
const textValue = computed(() => typeof props.modelValue?.value === "string" ? props.modelValue.value : "")

function selectOption(optionId: string) {
  if (!props.readonlyMode) emit("update:modelValue", { templateType: "observe_choice", value: optionId })
}

function handleTextInput(event: Event) {
  if (!props.readonlyMode) {
    emit("update:modelValue", {
      templateType: "observe_choice",
      value: String((event.target as HTMLTextAreaElement | null)?.value ?? ""),
    })
  }
}

watch(() => props.modelValue?.value, async (value) => {
  if (isFreeText.value || typeof value !== "string") return
  await nextTick()
  animateSelector(
    ".choice-row.is-active",
    { scale: 0.985 },
    { scale: 1, duration: 0.22, ease: "power2.out" },
  )
})
</script>

<template>
  <div ref="root" class="choice-list" :class="{ 'is-readonly': readonlyMode }">
    <label v-if="isFreeText" class="answer-field">
      <span class="answer-label">你的答案</span>
      <textarea
        class="answer-textarea"
        rows="3"
        :value="textValue"
        :readonly="readonlyMode"
        :disabled="readonlyMode"
        placeholder="在这里写下你的答案…"
        autocomplete="off"
        enterkeyhint="done"
        @input="handleTextInput"
      />
    </label>

    <button
      v-else
      v-for="(option, index) in options"
      :key="option.id"
      type="button"
      class="choice-row"
      :class="{ 'is-active': modelValue?.value === option.id }"
      :disabled="readonlyMode"
      @click="selectOption(option.id)"
    >
      <span class="choice-index" aria-hidden="true">{{ index + 1 }}</span>
      <span class="choice-title">{{ option.label }}</span>
      <span class="choice-mark" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.choice-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(8, 9, 12, 0.55);
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

/* 展签式选项：细描边 + 序号，选中时金边与右侧圆点 */
.choice-row {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 54px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid rgba(255, 248, 230, 0.1);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255, 248, 230, 0.035), rgba(255, 248, 230, 0.012));
  box-shadow: inset 0 1px 0 rgba(255, 248, 230, 0.04);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.choice-row:hover:not(:disabled):not(.is-active) {
  border-color: rgba(209, 178, 111, 0.28);
  background: rgba(209, 178, 111, 0.06);
}

.choice-row.is-active {
  border-color: rgba(209, 178, 111, 0.55);
  background:
    linear-gradient(135deg, rgba(209, 178, 111, 0.16), rgba(209, 178, 111, 0.06));
  box-shadow:
    inset 0 0 0 1px rgba(209, 178, 111, 0.12),
    0 0 0 1px rgba(209, 178, 111, 0.08);
}

.choice-row:disabled {
  cursor: default;
}

.choice-index {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.7rem;
  height: 1.7rem;
  border: 1px solid rgba(247, 239, 221, 0.12);
  border-radius: 999px;
  background: rgba(10, 9, 8, 0.35);
  color: rgba(209, 178, 111, 0.88);
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.choice-row.is-active .choice-index {
  border-color: rgba(209, 178, 111, 0.45);
  background: rgba(209, 178, 111, 0.18);
  color: #f0dfb0;
}

.choice-title {
  min-width: 0;
  color: rgba(247, 239, 221, 0.9);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.01em;
}

.choice-row.is-active .choice-title {
  color: #fff8ea;
}

.choice-mark {
  flex-shrink: 0;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  border: 1px solid rgba(247, 239, 221, 0.18);
  background: transparent;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.choice-row.is-active .choice-mark {
  border-color: rgba(232, 201, 138, 0.7);
  background: #e8c98a;
  box-shadow: 0 0 10px rgba(209, 178, 111, 0.35);
}
</style>
