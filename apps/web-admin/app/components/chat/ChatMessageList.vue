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
  () => [props.messages.length, props.messages.at(-1)?.content, props.tools.length, props.isRunning] as const,
  () => {
    void scrollToBottom();
  },
  { flush: 'post' },
);

const lastMessage = computed(() => props.messages.at(-1) ?? null);
</script>

<template>
  <div ref="scrollerRef" class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
    <ChatEmptyState
      v-if="!props.messages.length"
      :title="props.emptyTitle"
      :description="props.emptyDescription" />

    <div v-else class="space-y-4">
      <ChatMessageItem
        v-for="message in props.messages"
        :key="message.id"
        :message="message"
        :show-retry="message.role === 'assistant' && message.status === 'failed' && message.id === lastMessage?.id"
        @retry="emit('retry')" />

      <ChatToolStatus v-if="props.isRunning || props.tools.length" :tools="props.tools" />
    </div>
  </div>
</template>
