<script setup lang="ts">
import type { HTMLAttributes, TextareaHTMLAttributes } from "vue"
import { cn } from "@path-seeker/ui"

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: "" })

interface Props {
  placeholder?: string
  rows?: number
  disabled?: boolean
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "",
  rows: 4,
  disabled: false,
  class: undefined,
})

function handleInput(event: Event) {
  model.value = (event.target as HTMLTextAreaElement).value
}
</script>

<template>
  <textarea
    :value="model"
    :rows="props.rows"
    :disabled="props.disabled"
    :placeholder="props.placeholder"
    :class="
      cn(
        'flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
    v-bind="$attrs as TextareaHTMLAttributes"
    @input="handleInput"
  />
</template>
