<script setup lang="ts">
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
  readonlyMode?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft]
}>()
</script>

<template>
  <ObserveChoiceRenderer
    v-if="props.puzzle.templateType === 'observe_choice'"
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    :readonly-mode="props.readonlyMode"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <SelectRenderer
    v-else-if="props.puzzle.templateType === 'select'"
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    :readonly-mode="props.readonlyMode"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <ClueFindRenderer
    v-else-if="props.puzzle.templateType === 'clue_find'"
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    :readonly-mode="props.readonlyMode"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <SortRenderer
    v-else-if="props.puzzle.templateType === 'sort'"
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    :readonly-mode="props.readonlyMode"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <MatchRenderer
    v-else-if="props.puzzle.templateType === 'match'"
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    :readonly-mode="props.readonlyMode"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <ImagePuzzleRenderer
    v-else-if="props.puzzle.templateType === 'image_puzzle'"
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    :readonly-mode="props.readonlyMode"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <StoryBranchRenderer
    v-else-if="props.puzzle.templateType === 'story_branch'"
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    :readonly-mode="props.readonlyMode"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <MultiStepReasoningRenderer
    v-else-if="props.puzzle.templateType === 'multi_step_reasoning'"
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    :readonly-mode="props.readonlyMode"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <CodeBreakRenderer
    v-else
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    :readonly-mode="props.readonlyMode"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
