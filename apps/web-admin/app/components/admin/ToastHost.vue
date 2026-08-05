<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';
import { useToast } from '@/composables/useToast';

const { toasts, remove } = useToast();

const toneClass = (tone: string) => {
  if (tone === 'success') {
    return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100';
  }

  if (tone === 'error') {
    return 'border-destructive/40 bg-destructive/15 text-destructive';
  }

  return 'border-border/70 bg-[#15171b] text-foreground';
};
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-16 z-[12000] flex flex-col items-center gap-2 px-4 sm:top-20"
    aria-live="polite">
    <div
      v-for="item in toasts"
      :key="item.id"
      class="pointer-events-auto flex max-w-[min(92vw,22rem)] items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm shadow-lg backdrop-blur-sm"
      :class="toneClass(item.tone)"
      role="status">
      <span class="min-w-0 flex-1 leading-5">{{ item.message }}</span>
      <button
        type="button"
        class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-70 transition hover:bg-white/10 hover:opacity-100"
        aria-label="关闭"
        title="关闭"
        @click="remove(item.id)">
        <AppIcon name="x" class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>
