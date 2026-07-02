<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/utils/cn';

interface Props {
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  class: '',
});

const cellClass = computed(() => cn('p-3 align-middle text-sm text-foreground', props.class));
</script>

<template>
  <td :class="cellClass">
    <slot />
  </td>
</template>
