<script setup lang="ts">
import { inject } from 'vue';
import { dialogContextKey } from './context';

const props = withDefaults(defineProps<{
  class?: string;
}>(), {
  class: '',
});

const dialog = inject(dialogContextKey);
if (!dialog) {
  throw new Error('DialogTitle must be used inside Dialog');
}
</script>

<template>
  <h2 :id="dialog.titleId.value" :class="props.class">
    <slot />
  </h2>
</template>
