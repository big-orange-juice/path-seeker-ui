<script setup lang="ts">
import ObserveChoiceRenderer from "@/components/puzzle/renderers/ObserveChoiceRenderer.vue"
import ClueFindRenderer from "@/components/puzzle/renderers/ClueFindRenderer.vue"
import SortRenderer from "@/components/puzzle/renderers/SortRenderer.vue"
import MatchRenderer from "@/components/puzzle/renderers/MatchRenderer.vue"
import CodeBreakRenderer from "@/components/puzzle/renderers/CodeBreakRenderer.vue"
import type { MissionAnswerDraft, MissionPuzzle } from "@/types/mission"

interface Props {
  puzzle: MissionPuzzle
  modelValue: MissionAnswerDraft | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:modelValue": [value: MissionAnswerDraft]
}>()
</script>

<template>
  <ObserveChoiceRenderer
    v-if="props.puzzle.templateType === 'observe_choice'"
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <ClueFindRenderer
    v-else-if="props.puzzle.templateType === 'clue_find'"
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <SortRenderer
    v-else-if="props.puzzle.templateType === 'sort'"
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <MatchRenderer
    v-else-if="props.puzzle.templateType === 'match'"
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <CodeBreakRenderer
    v-else
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
