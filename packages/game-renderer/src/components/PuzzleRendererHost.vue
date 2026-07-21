<script setup lang="ts">
import { computed } from "vue"
import ObserveChoiceRenderer from "./renderers/ObserveChoiceRenderer.vue"
import ImagePuzzleRenderer from "./renderers/ImagePuzzleRenderer.vue"
import type { PuzzleAnswerDraft, PuzzleDefinition } from "../contracts"

interface Props {
  puzzle: PuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  /** 只读展示，禁止作答交互 */
  readonlyMode?: boolean
  /**
   * 兼容旧调用方：不再锁交互。
   * 模拟器应允许本地试玩，仅由宿主禁用提交/下一步。
   */
  previewMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonlyMode: false,
  previewMode: false,
})

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
}>()

const isReadonly = computed(() => Boolean(props.readonlyMode))
</script>

<template>
  <div class="puzzle-renderer-host" :class="{ 'is-preview-mode': props.previewMode }">
    <ObserveChoiceRenderer
      v-if="props.puzzle.templateType === 'observe_choice'"
      :puzzle="props.puzzle"
      :model-value="props.modelValue"
      :readonly-mode="isReadonly"
      @update:model-value="emit('update:modelValue', $event)" />
    <ImagePuzzleRenderer
      v-else-if="props.puzzle.templateType === 'image_puzzle'"
      :puzzle="props.puzzle"
      :model-value="props.modelValue"
      :readonly-mode="isReadonly"
      @update:model-value="emit('update:modelValue', $event)" />
  </div>
</template>

<style scoped>
.puzzle-renderer-host {
  min-height: 0;
}
</style>
