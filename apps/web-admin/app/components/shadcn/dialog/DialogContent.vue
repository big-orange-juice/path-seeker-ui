<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted } from 'vue';
import { dialogContextKey } from './context';
import { cn } from '@/utils/cn';

const props = withDefaults(defineProps<{
  class?: string;
}>(), {
  class: '',
});

const dialog = inject(dialogContextKey);
if (!dialog) {
  throw new Error('DialogContent must be used inside Dialog');
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    dialog.setOpen(false);
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleEscape);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape);
  document.body.style.overflow = '';
});

/** 调用方已写 max-w 时不再套默认 1360，避免确认框被撑满 */
const contentClass = computed(() => {
  const extra = props.class || '';
  const hasMaxWidth = /\bmax-w-/.test(extra);

  return cn(
    'warm-panel warm-outline relative w-full rounded-[0.95rem] border border-border/80 bg-[#111316]',
    !hasMaxWidth && 'max-w-[1360px]',
    extra,
  );
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="dialog.open.value"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm"
      >
        <div
          role="dialog"
          aria-modal="true"
          :aria-labelledby="dialog.titleId.value"
          :aria-describedby="dialog.descriptionId.value"
          :class="contentClass"
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
