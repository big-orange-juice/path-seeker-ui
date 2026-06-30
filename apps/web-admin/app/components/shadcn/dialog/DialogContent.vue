<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted } from 'vue';
import { dialogContextKey } from './context';

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
          class="warm-panel warm-outline relative w-full max-w-[1440px] rounded-[1.1rem] border border-border/80 bg-[#111316]"
          :class="props.class"
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>