<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/utils/cn';

interface Props {
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  class: '',
});

const tableClass = computed(() => cn('w-full caption-bottom text-sm', props.class));
</script>

<template>
  <div class="relative w-full overflow-x-auto">
    <table :class="tableClass">
      <slot />
    </table>
  </div>
</template>
