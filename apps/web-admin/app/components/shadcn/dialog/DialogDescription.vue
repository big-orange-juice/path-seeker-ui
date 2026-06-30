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
  throw new Error('DialogDescription must be used inside Dialog');
}
</script>

<template>
  <p :id="dialog.descriptionId.value" :class="props.class">
    <slot />
  </p>
</template>
