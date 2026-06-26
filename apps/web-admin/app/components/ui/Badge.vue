<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/utils/cn';

type BadgeVariant = 'success' | 'draft' | 'archived';

interface Props {
  variant?: BadgeVariant;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'success',
});

const badgeClass = computed(() =>
  cn(
    'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium',
    props.variant === 'success' && 'bg-emerald-500/10 text-emerald-300',
    props.variant === 'draft' && 'bg-amber-400/10 text-amber-300',
    props.variant === 'archived' && 'bg-stone-400/10 text-stone-300',
  ),
);
</script>

<template>
  <span :class="badgeClass">
    <span class="h-1.5 w-1.5 rounded-full bg-current" />
    <slot />
  </span>
</template>
