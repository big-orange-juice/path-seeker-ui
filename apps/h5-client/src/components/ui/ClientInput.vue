<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { Input, cn } from "@path-seeker/ui"

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: "" })

interface Props {
  type?: string
  placeholder?: string
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  type: "text",
  placeholder: "",
  class: undefined,
})
</script>

<template>
  <Input
    v-model="model"
    :type="props.type"
    :placeholder="props.placeholder"
    :class="
      cn(
        'h-10 bg-background px-3 py-2 text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        props.class,
      )
    "
    v-bind="$attrs"
  />
</template>
