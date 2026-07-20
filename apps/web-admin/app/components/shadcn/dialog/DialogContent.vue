<script setup lang="ts">
import { computed, inject, onBeforeUnmount, watch } from 'vue';
import { dialogContextKey } from './context';
import { createDialogLayerHandle } from './layer';
import { cn } from '@/utils/cn';

const props = withDefaults(defineProps<{
  class?: string;
  /**
   * 可选：强制指定 z-index。
   * 默认由全局层级栈按打开顺序自动递增，一般无需传入。
   * 仅在需要压过全局栈（如登录过期提示）时使用。
   */
  zIndex?: number;
}>(), {
  class: '',
  zIndex: undefined,
});

const dialog = inject(dialogContextKey);
if (!dialog) {
  throw new Error('DialogContent must be used inside Dialog');
}

const layer = createDialogLayerHandle();

const overlayZIndex = computed(() => {
  if (typeof props.zIndex === 'number' && Number.isFinite(props.zIndex)) {
    return props.zIndex;
  }
  return layer.zIndex.value;
});

const handleEscape = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    return;
  }
  // 仅最顶层 dialog 响应 Esc，避免一次关掉整条栈
  if (!layer.isTopmost.value) {
    return;
  }
  event.stopPropagation();
  dialog.setOpen(false);
};

const bindEscape = () => {
  window.addEventListener('keydown', handleEscape, true);
};

const unbindEscape = () => {
  window.removeEventListener('keydown', handleEscape, true);
};

watch(
  () => dialog.open.value,
  (open) => {
    if (open) {
      layer.acquire();
      bindEscape();
      return;
    }
    unbindEscape();
    layer.release();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  unbindEscape();
  layer.release();
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
        class="fixed inset-0 flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm"
        :style="{ zIndex: overlayZIndex }"
        data-dialog-overlay
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
