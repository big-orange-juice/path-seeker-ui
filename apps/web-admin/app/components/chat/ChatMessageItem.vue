<script setup lang="ts">
import { computed } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { ChatUiMessage } from '@/types/chat';

interface Props {
  message: ChatUiMessage;
  showRetry?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showRetry: false,
});

const emit = defineEmits<{
  retry: [];
}>();

const isUser = computed(() => props.message.role === 'user');
const isStreaming = computed(() => props.message.status === 'streaming' || props.message.status === 'pending');
const isFailed = computed(() => props.message.status === 'failed');
</script>

<template>
  <div class="flex gap-2.5" :class="isUser ? 'flex-row-reverse' : 'flex-row'">
    <div
      class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70"
      :class="isUser ? 'bg-muted/40 text-muted-foreground' : 'bg-muted/50 text-muted-foreground'">
      <AppIcon :name="isUser ? 'user-round' : 'bot'" class="h-4 w-4" />
    </div>

    <div class="min-w-0 max-w-[82%] space-y-1.5" :class="isUser ? 'items-end' : 'items-start'">
      <div
        class="rounded-xl px-3 py-2 text-sm leading-6"
        :class="isUser
          ? 'border border-primary/20 bg-primary/12 text-foreground'
          : isFailed
            ? 'border border-destructive/30 bg-destructive/10 text-destructive'
            : 'border border-border/70 bg-card text-foreground'">
        <p v-if="message.content" class="whitespace-pre-wrap break-words">
          {{ message.content }}
        </p>
        <p v-else-if="isStreaming" class="text-muted-foreground">
          正在思考…
        </p>
        <p v-else-if="isFailed && message.errorMessage" class="whitespace-pre-wrap break-words">
          {{ message.errorMessage }}
        </p>
        <p v-else class="text-muted-foreground">
          —
        </p>
      </div>

      <div v-if="isFailed && showRetry" class="flex justify-start">
        <Button variant="outline" size="sm" type="button" @click="emit('retry')">
          <AppIcon name="refresh-cw" class="h-3.5 w-3.5" />
          重试
        </Button>
      </div>
    </div>
  </div>
</template>
