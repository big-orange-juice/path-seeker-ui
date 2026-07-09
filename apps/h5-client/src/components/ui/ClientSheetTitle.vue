<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { SheetTitle, cn } from "@path-seeker/ui"

interface Props {
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
</script>

<template>
  <SheetTitle :class="cn('font-display text-xl text-foreground', props.class)">
    <slot />
  </SheetTitle>
</template>
