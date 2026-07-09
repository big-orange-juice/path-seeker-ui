<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { SheetContent, cn } from "@path-seeker/ui"

defineOptions({ inheritAttrs: false })

interface Props {
  side?: "top" | "bottom" | "left" | "right"
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  side: "bottom",
  class: undefined,
})
</script>

<template>
  <SheetContent
    :side="props.side"
    v-bind="$attrs"
    :class="
      cn(
        props.side === 'bottom' && 'rounded-t-[1.4rem] border-border bg-card px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5',
        props.side !== 'bottom' && 'bg-card',
        props.class,
      )
    "
  >
    <slot />
  </SheetContent>
</template>
