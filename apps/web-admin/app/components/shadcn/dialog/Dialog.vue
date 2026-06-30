<script setup lang="ts">
import { provide, watch } from 'vue';
import { createDialogIds, dialogContextKey } from './context';

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const { titleId, descriptionId } = createDialogIds();

const setOpen = (value: boolean) => {
  open.value = value;
};

watch(open, (value) => {
  emit('update:open', value);
  document.body.style.overflow = value ? 'hidden' : '';
});

provide(dialogContextKey, {
  open,
  setOpen,
  titleId,
  descriptionId,
});
</script>

<template>
  <slot />
</template>
