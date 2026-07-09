<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { SheetHeader, cn } from "@path-seeker/ui"

interface Props {
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
</script>

<template>
  <SheetHeader :class="cn('space-y-2 text-left', props.class)">
    <slot />
  </SheetHeader>
</template>
