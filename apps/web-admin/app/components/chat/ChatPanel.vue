<script setup lang="ts">
import { computed, useSlots } from 'vue';
import ChatComposer from '@/components/chat/ChatComposer.vue';
import ChatMessageList from '@/components/chat/ChatMessageList.vue';
import type { ChatToolActivity, ChatUiMessage } from '@/types/chat';

interface Props {
  messages: ChatUiMessage[];
  tools?: ChatToolActivity[];
  isRunning?: boolean;
  disabled?: boolean;
  errorMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  tools: () => [],
  isRunning: false,
  disabled: false,
  errorMessage: '',
  emptyTitle: '开始对话',
  emptyDescription: '用自然语言描述目标，助手会协助搜索资料并推进创建。',
  placeholder: '描述你想创建的主题路线…',
});

const emit = defineEmits<{
  send: [message: string];
  cancel: [];
  retry: [];
  suggestion: [text: string];
}>();

const hasAside = computed(() => Boolean(useSlots().aside));
</script>

<template>
  <div class="flex min-h-0 flex-1 gap-3">
    <div class="chat-shell flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ChatMessageList
        :messages="props.messages"
        :tools="props.tools"
        :is-running="props.isRunning"
        :empty-title="props.emptyTitle"
        :empty-description="props.emptyDescription"
        @retry="emit('retry')"
        @suggestion="emit('suggestion', $event)" />

      <div v-if="props.errorMessage" class="chat-error">
        {{ props.errorMessage }}
      </div>

      <ChatComposer
        :sending="props.isRunning"
        :disabled="props.disabled"
        :placeholder="props.placeholder"
        @send="emit('send', $event)"
        @cancel="emit('cancel')" />
    </div>

    <aside
      v-if="hasAside"
      class="chat-aside hidden min-h-0 w-[300px] shrink-0 overflow-hidden md:flex md:flex-col xl:w-[340px]">
      <slot name="aside" />
    </aside>
  </div>
</template>

<style scoped>
.chat-shell,
.chat-aside {
  border-radius: 0.95rem;
  border: 1px solid rgba(209, 178, 111, 0.12);
  background:
    linear-gradient(180deg, rgba(209, 178, 111, 0.04), transparent 18%),
    rgba(12, 13, 16, 0.94);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.025),
    0 12px 28px rgba(0, 0, 0, 0.16);
}

.chat-error {
  margin: 0 0.75rem;
  border-radius: 0.55rem;
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.08);
  padding: 0.4rem 0.65rem;
  font-size: 12px;
  color: hsl(var(--destructive));
}
</style>
