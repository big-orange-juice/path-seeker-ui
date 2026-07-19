<script setup lang="ts">
import { computed } from "vue"
import ObserveChoiceRenderer from "./renderers/ObserveChoiceRenderer.vue"
import SelectRenderer from "./renderers/SelectRenderer.vue"
import ClueFindRenderer from "./renderers/ClueFindRenderer.vue"
import SortRenderer from "./renderers/SortRenderer.vue"
import MatchRenderer from "./renderers/MatchRenderer.vue"
import ImagePuzzleRenderer from "./renderers/ImagePuzzleRenderer.vue"
import StoryBranchRenderer from "./renderers/StoryBranchRenderer.vue"
import MultiStepReasoningRenderer from "./renderers/MultiStepReasoningRenderer.vue"
import CodeBreakRenderer from "./renderers/CodeBreakRenderer.vue"
import type { PuzzleAnswerDraft, PuzzleDefinition } from "../contracts"

interface Props {
  puzzle: PuzzleDefinition
  modelValue: PuzzleAnswerDraft | null
  /** 只读：禁用作答交互（后台预览用） */
  readonlyMode?: boolean
  /**
   * 预览模式：强制只读 + 屏蔽指针事件。
   * web-admin 预览传 true；h5-client 不要传（保持可作答）。
   */
  previewMode?: boolean
  /**
   * studio：B 端预览微调（可编辑字段、可试玩交互）。
   * 与 previewMode 互斥：studio 时不屏蔽指针。
   */
  studioMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonlyMode: false,
  previewMode: false,
  studioMode: false,
})

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
  "update:content": [payload: { title?: string; prompt?: string; options?: Array<{ id: string; label: string }> }]
}>()

/** studio 可试玩；preview 强制只读 */
const isReadonly = computed(() => {
  if (props.studioMode) {
    return false
  }
  return Boolean(props.readonlyMode || props.previewMode)
})

const blockPointer = computed(() => props.previewMode && !props.studioMode)
</script>

<template>
  <div
    class="puzzle-renderer-host"
    :class="{ 'is-preview-mode': blockPointer, 'is-studio': studioMode }"
  >
    <ObserveChoiceRenderer
      v-if="props.puzzle.templateType === 'observe_choice'"
      :puzzle="props.puzzle"
      :model-value="props.modelValue"
      :readonly-mode="isReadonly"
      :studio-mode="studioMode"
      @update:model-value="emit('update:modelValue', $event)"
      @update:content="emit('update:content', $event)"
    />
    <SelectRenderer
      v-else-if="props.puzzle.templateType === 'select'"
      :puzzle="props.puzzle"
      :model-value="props.modelValue"
      :readonly-mode="isReadonly"
      :studio-mode="studioMode"
      @update:model-value="emit('update:modelValue', $event)"
      @update:content="emit('update:content', $event)"
    />
    <ClueFindRenderer
      v-else-if="props.puzzle.templateType === 'clue_find'"
      :puzzle="props.puzzle"
      :model-value="props.modelValue"
      :readonly-mode="isReadonly"
      :studio-mode="studioMode"
      @update:model-value="emit('update:modelValue', $event)"
      @update:content="emit('update:content', $event)"
    />
    <SortRenderer
      v-else-if="props.puzzle.templateType === 'sort'"
      :puzzle="props.puzzle"
      :model-value="props.modelValue"
      :readonly-mode="isReadonly"
      :studio-mode="studioMode"
      @update:model-value="emit('update:modelValue', $event)"
      @update:content="emit('update:content', $event)"
    />
    <MatchRenderer
      v-else-if="props.puzzle.templateType === 'match'"
      :puzzle="props.puzzle"
      :model-value="props.modelValue"
      :readonly-mode="isReadonly"
      :studio-mode="studioMode"
      @update:model-value="emit('update:modelValue', $event)"
      @update:content="emit('update:content', $event)"
    />
    <ImagePuzzleRenderer
      v-else-if="props.puzzle.templateType === 'image_puzzle'"
      :puzzle="props.puzzle"
      :model-value="props.modelValue"
      :readonly-mode="isReadonly"
      :studio-mode="studioMode"
      @update:model-value="emit('update:modelValue', $event)"
      @update:content="emit('update:content', $event)"
    />
    <StoryBranchRenderer
      v-else-if="props.puzzle.templateType === 'story_branch'"
      :puzzle="props.puzzle"
      :model-value="props.modelValue"
      :readonly-mode="isReadonly"
      :studio-mode="studioMode"
      @update:model-value="emit('update:modelValue', $event)"
      @update:content="emit('update:content', $event)"
    />
    <MultiStepReasoningRenderer
      v-else-if="props.puzzle.templateType === 'multi_step_reasoning'"
      :puzzle="props.puzzle"
      :model-value="props.modelValue"
      :readonly-mode="isReadonly"
      :studio-mode="studioMode"
      @update:model-value="emit('update:modelValue', $event)"
      @update:content="emit('update:content', $event)"
    />
    <CodeBreakRenderer
      v-else
      :puzzle="props.puzzle"
      :model-value="props.modelValue"
      :readonly-mode="isReadonly"
      :studio-mode="studioMode"
      @update:model-value="emit('update:modelValue', $event)"
      @update:content="emit('update:content', $event)"
    />
  </div>
</template>

<style scoped>
.puzzle-renderer-host.is-preview-mode {
  pointer-events: none;
  user-select: none;
}
</style>
