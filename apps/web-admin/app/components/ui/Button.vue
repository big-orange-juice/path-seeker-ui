<script setup lang="ts">
import ShadcnButton from '@/components/shadcn/button/Button.vue';
import { cn } from '@/utils/cn';

type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'outline';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

interface Props {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
  type: 'button',
  disabled: false,
  class: '',
});
</script>

<template>
  <ShadcnButton
    :variant="props.variant"
    :size="props.size"
    :type="props.type"
    :disabled="props.disabled"
    :class="cn(props.class)"
    v-bind="$attrs">
    <slot />
  </ShadcnButton>
</template>
