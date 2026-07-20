<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import ChatEmptyState from '@/components/chat/ChatEmptyState.vue';
import ChatMessageItem from '@/components/chat/ChatMessageItem.vue';
import ChatToolStatus from '@/components/chat/ChatToolStatus.vue';
import type { ChatToolActivity, ChatUiMessage } from '@/types/chat';

interface Props {
  messages: ChatUiMessage[];
  tools?: ChatToolActivity[];
  emptyTitle?: string;
  emptyDescription?: string;
  isRunning?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  tools: () => [],
  emptyTitle: '开始对话',
  emptyDescription: '用自然语言描述目标，助手会协助搜索资料并推进创建。',
  isRunning: false,
});

const emit = defineEmits<{
  retry: [];
  suggestion: [text: string];
}>();

const scrollerRef = ref<HTMLElement | null>(null);

const scrollToBottom = async () => {
  await nextTick();
  const el = scrollerRef.value;

  if (!el) {
    return;
  }

  el.scrollTop = el.scrollHeight;
};

watch(
  () => [
    props.messages.length,
    props.messages.at(-1)?.content,
    props.messages.at(-1)?.suggestions?.length,
    props.tools.length,
    props.isRunning,
  ] as const,
  () => {
    void scrollToBottom();
  },
  { flush: 'post' },
);

const lastMessage = computed(() => props.messages.at(-1) ?? null);
</script>

<template>
  <div ref="scrollerRef" class="chat-stream min-h-0 flex-1 overflow-y-auto">
    <ChatEmptyState
      v-if="!props.messages.length"
      :title="props.emptyTitle"
      :description="props.emptyDescription" />

    <div v-else class="chat-stream__list">
      <ChatMessageItem
        v-for="message in props.messages"
        :key="message.id"
        :message="message"
        :show-retry="message.role === 'assistant' && message.status === 'failed' && message.id === lastMessage?.id"
        :suggestions-disabled="props.isRunning"
        @retry="emit('retry')"
        @suggestion="emit('suggestion', $event)" />

      <ChatToolStatus
        v-if="props.isRunning || props.tools.length"
        :tools="props.tools" />
    </div>
  </div>
</template>

<style scoped>
.chat-stream {
  position: relative;
  background:
    radial-gradient(120% 70% at 12% 0%, rgba(209, 178, 111, 0.07), transparent 42%),
    radial-gradient(90% 50% at 100% 100%, rgba(209, 178, 111, 0.04), transparent 48%);
}

.chat-stream__list {
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
  padding: 0.9rem 0.85rem 1rem;
}
</style>
