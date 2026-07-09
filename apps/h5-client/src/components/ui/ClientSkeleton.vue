<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@path-seeker/ui"

interface Props {
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
</script>

<template>
  <div
    :class="
      cn(
        'animate-pulse rounded-[0.9rem] bg-muted/80',
        props.class,
      )
    "
  />
</template>
