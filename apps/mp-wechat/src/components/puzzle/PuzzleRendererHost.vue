<script setup lang="ts">
import { PuzzleRendererHost as SharedPuzzleRendererHost } from "@path-seeker/game-renderer"
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
  <SharedPuzzleRendererHost
    :puzzle="props.puzzle"
    :model-value="props.modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
