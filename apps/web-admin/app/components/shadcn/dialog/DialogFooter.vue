<script setup lang="ts">
import { cn } from '@/utils/cn';

const props = withDefaults(defineProps<{
  class?: string;
}>(), {
  class: '',
});
</script>

<template>
  <div
    :class="cn(
      'flex flex-row flex-wrap items-center justify-end gap-3',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
