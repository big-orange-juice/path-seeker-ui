<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { TabsList, cn } from "@path-seeker/ui"

defineOptions({ inheritAttrs: false })

interface Props {
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
</script>

<template>
  <TabsList
    v-bind="$attrs"
    :class="
      cn(
        'grid h-auto w-full grid-cols-2 gap-2 rounded-full bg-background/70 p-1',
        props.class,
      )
    "
  >
    <slot />
  </TabsList>
</template>
