<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { SheetFooter, cn } from "@path-seeker/ui"

interface Props {
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
</script>

<template>
  <SheetFooter :class="cn('mt-5 gap-3', props.class)">
    <slot />
  </SheetFooter>
</template>
