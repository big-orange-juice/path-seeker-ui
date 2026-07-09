<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { TabsTrigger, cn } from "@path-seeker/ui"

defineOptions({ inheritAttrs: false })

interface Props {
  value: string
  disabled?: boolean
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
</script>

<template>
  <TabsTrigger
    :value="props.value"
    :disabled="props.disabled"
    v-bind="$attrs"
    :class="
      cn(
        'min-h-10 rounded-full px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none',
        props.class,
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
