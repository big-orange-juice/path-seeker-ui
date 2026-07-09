<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { TabsContent, cn } from "@path-seeker/ui"

defineOptions({ inheritAttrs: false })

interface Props {
  value: string
  forceMount?: boolean
  class?: HTMLAttributes["class"]
}

const props = defineProps<Props>()
</script>

<template>
  <TabsContent
    :value="props.value"
    :force-mount="props.forceMount"
    v-bind="$attrs"
    :class="cn('mt-5', props.class)"
  >
    <slot />
  </TabsContent>
</template>
