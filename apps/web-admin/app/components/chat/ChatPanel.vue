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
}>();

const hasAside = computed(() => Boolean(useSlots().aside));
</script>

<template>
  <div class="flex min-h-0 flex-1 gap-3">
    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-background">
      <ChatMessageList
        :messages="props.messages"
        :tools="props.tools"
        :is-running="props.isRunning"
        :empty-title="props.emptyTitle"
        :empty-description="props.emptyDescription"
        @retry="emit('retry')" />

      <div v-if="props.errorMessage" class="border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
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
      class="hidden min-h-0 w-[300px] shrink-0 overflow-hidden rounded-xl border border-border/70 bg-background md:flex md:flex-col xl:w-[320px]">
      <slot name="aside" />
    </aside>
  </div>
</template>
