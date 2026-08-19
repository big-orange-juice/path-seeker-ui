<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { ChatMessageAttachment } from '@/types/chat';

interface Props {
  attachment: ChatMessageAttachment;
}

defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close');
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown, true);
});
</script>

<template>
  <Teleport to="body">
    <div
      class="chat-lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="`${attachment.label}大图预览`"
      @click.self="emit('close')">
      <button
        type="button"
        class="chat-lightbox__close"
        title="关闭"
        aria-label="关闭图片预览"
        @click="emit('close')">
        <AppIcon name="x" class="h-4 w-4" />
      </button>

      <img
        :src="attachment.imageUrl"
        :alt="attachment.label"
        class="chat-lightbox__image">
    </div>
  </Teleport>
</template>

<style scoped>
.chat-lightbox {
  position: fixed;
  inset: 0;
  z-index: 10020;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.86);
  padding: 1rem;
}

.chat-lightbox__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: inline-flex;
  height: 2.25rem;
  width: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  transition: background 0.15s ease;
}

.chat-lightbox__close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.chat-lightbox__image {
  max-height: 90vh;
  max-width: min(96vw, 1100px);
  border-radius: 0.5rem;
  object-fit: contain;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
}
</style>
