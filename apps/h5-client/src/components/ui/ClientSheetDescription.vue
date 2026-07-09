<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { SheetDescription, cn } from "@path-seeker/ui"

interface Props {
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
</script>

<template>
  <SheetDescription :class="cn('client-page-copy', props.class)">
    <slot />
  </SheetDescription>
</template>
