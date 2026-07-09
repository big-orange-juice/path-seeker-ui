<script setup lang="ts">
import { Tabs } from "@path-seeker/ui"

defineOptions({ inheritAttrs: false })

const model = defineModel<string>()
</script>

<template>
  <Tabs v-model="model" v-bind="$attrs">
    <slot />
  </Tabs>
</template>
