<script setup lang="ts">
import { computed, nextTick, watch } from "vue"
import { gsap } from "gsap"
import { useRendererMotion } from "../../composables/useRendererMotion"
import type { ObserveChoicePuzzleDefinition, PuzzleAnswerDraft } from "../../contracts"

interface Props {
  puzzle: ObserveChoicePuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  readonlyMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonlyMode: false,
})

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
}>()

const { root, animateSelector } = useRendererMotion(() => {
  gsap.from(".choice-card, .answer-field", {
    autoAlpha: 0,
    y: 18,
    duration: 0.42,
    ease: "power2.out",
    stagger: 0.06,
  })
})

const options = computed(() => props.puzzle.questionPayload?.options ?? [])
/** 无选项时走自由文本（线性答题）；有选项时为观察选择 */
const isFreeText = computed(() => options.value.length === 0)

const textValue = computed(() =>
  typeof props.modelValue?.value === "string" ? props.modelValue.value : "",
)

function selectOption(optionId: string) {
  if (props.readonlyMode) {
    return
  }

  emit("update:modelValue", {
    templateType: "observe_choice",
    value: optionId,
  })
}

function handleTextInput(event: Event) {
  if (props.readonlyMode) {
    return
  }

  const target = event.target as HTMLTextAreaElement | null
  emit("update:modelValue", {
    templateType: "observe_choice",
    value: String(target?.value ?? ""),
  })
}

watch(
  () => props.modelValue?.value,
  async (value) => {
    if (isFreeText.value || typeof value !== "string") {
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
  <div ref="root" class="choice-list" :class="{ 'is-readonly': readonlyMode }">
    <template v-if="isFreeText">
      <label class="answer-field">
        <span class="answer-label">你的答案</span>
        <textarea
          class="answer-textarea"
          rows="4"
          :value="textValue"
          :readonly="readonlyMode"
          :disabled="readonlyMode"
          placeholder="在这里写下你的答案…"
          autocomplete="off"
          enterkeyhint="done"
          @input="handleTextInput"
        />
      </label>
    </template>

    <template v-else>
      <button
        v-for="(option, index) in options"
        :key="option.id"
        type="button"
        class="choice-card"
        :class="{ 'is-active': modelValue?.value === option.id }"
        :disabled="readonlyMode"
        @click="selectOption(option.id)"
      >
        <span class="choice-index">{{ index + 1 }}</span>
        <span class="choice-title">{{ option.label }}</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.choice-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.answer-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.answer-label {
  color: rgba(247, 239, 221, 0.62);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.answer-textarea {
  display: block;
  width: 100%;
  min-height: 7.5rem;
  resize: vertical;
  border: 1px solid rgba(247, 239, 221, 0.12);
  border-radius: 18px;
  padding: 14px 16px;
  background: rgba(8, 9, 12, 0.72);
  color: #fff8ea;
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.55;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  -webkit-appearance: none;
  appearance: none;
}

.answer-textarea::placeholder {
  color: rgba(247, 239, 221, 0.38);
  font-weight: 500;
}

.answer-textarea:focus {
  border-color: rgba(209, 178, 111, 0.55);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 0 0 3px rgba(209, 178, 111, 0.14);
}

.answer-textarea:disabled,
.answer-textarea[readonly] {
  cursor: default;
  opacity: 0.72;
}

.choice-card {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 86px;
  padding: 16px;
  border: 0;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.045);
  text-align: left;
  cursor: pointer;
}

.choice-card:disabled {
  cursor: default;
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

@media (max-width: 420px) {
  .choice-title {
    font-size: 18px;
  }

  .choice-index {
    width: 38px;
    height: 38px;
    font-size: 16px;
  }

  .choice-card {
    min-height: 64px;
    gap: 12px;
    padding: 12px;
  }
}
</style>
