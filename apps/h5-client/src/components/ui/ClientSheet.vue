<script setup lang="ts">
import { Sheet } from "@path-seeker/ui"

defineOptions({ inheritAttrs: false })

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <Sheet v-model:open="model" v-bind="$attrs">
    <slot />
  </Sheet>
</template>
