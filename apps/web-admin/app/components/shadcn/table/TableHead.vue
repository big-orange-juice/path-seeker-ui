<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/utils/cn';

interface Props {
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  class: '',
});

const headClass = computed(() => cn('h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground', props.class));
</script>

<template>
  <th :class="headClass">
    <slot />
  </th>
</template>
