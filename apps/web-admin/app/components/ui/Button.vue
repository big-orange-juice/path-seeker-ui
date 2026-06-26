<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/utils/cn';

type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'outline';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

interface Props {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
  type: 'button',
  disabled: false,
});

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/92',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
  ghost: 'bg-transparent text-foreground/78 hover:bg-accent hover:text-foreground',
  outline: 'border border-border bg-background text-foreground hover:bg-accent/80',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-9 px-4 text-sm',
  sm: 'h-7 rounded-md px-2.5 text-xs',
  lg: 'h-10 rounded-md px-4 text-sm',
  icon: 'h-9 w-9 rounded-md p-0',
};

const buttonClass = computed(() =>
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
    variantClasses[props.variant],
    sizeClasses[props.size],
  ),
);
</script>

<template>
  <button :type="props.type" :disabled="props.disabled" :class="buttonClass">
    <slot />
  </button>
</template>
