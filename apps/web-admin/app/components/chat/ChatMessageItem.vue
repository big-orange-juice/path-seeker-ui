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
const isAssistant = computed(() => props.message.role === 'assistant');
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
        <Comark
          v-if="isAssistant && message.content"
          :markdown="message.content"
          :streaming="isStreaming"
          class="chat-md break-words" />
        <p v-else-if="message.content" class="whitespace-pre-wrap break-words">
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

<style scoped>
.chat-md :deep(:first-child) {
  margin-top: 0;
}

.chat-md :deep(:last-child) {
  margin-bottom: 0;
}

.chat-md :deep(p) {
  margin: 0.4em 0;
}

.chat-md :deep(h1),
.chat-md :deep(h2),
.chat-md :deep(h3),
.chat-md :deep(h4) {
  margin: 0.75em 0 0.35em;
  font-weight: 600;
  line-height: 1.35;
  color: hsl(var(--foreground));
}

.chat-md :deep(h1) {
  font-size: 1.125rem;
}

.chat-md :deep(h2) {
  font-size: 1.05rem;
}

.chat-md :deep(h3),
.chat-md :deep(h4) {
  font-size: 1rem;
}

.chat-md :deep(ul),
.chat-md :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.25rem;
}

.chat-md :deep(ul) {
  list-style: disc;
}

.chat-md :deep(ol) {
  list-style: decimal;
}

.chat-md :deep(li) {
  margin: 0.15em 0;
}

.chat-md :deep(li > p) {
  margin: 0.15em 0;
}

.chat-md :deep(blockquote) {
  margin: 0.5em 0;
  border-left: 3px solid hsl(var(--border));
  padding-left: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.chat-md :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
}

.chat-md :deep(code) {
  border-radius: 0.25rem;
  background: hsl(var(--muted) / 0.7);
  padding: 0.1em 0.35em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85em;
}

.chat-md :deep(pre) {
  margin: 0.55em 0;
  overflow-x: auto;
  border-radius: 0.5rem;
  border: 1px solid hsl(var(--border) / 0.7);
  background: hsl(var(--muted) / 0.45);
  padding: 0.65rem 0.75rem;
}

.chat-md :deep(pre code) {
  display: block;
  padding: 0;
  background: transparent;
  font-size: 0.8em;
  line-height: 1.55;
  white-space: pre;
}

.chat-md :deep(hr) {
  margin: 0.75em 0;
  border: 0;
  border-top: 1px solid hsl(var(--border) / 0.8);
}

.chat-md :deep(table) {
  width: 100%;
  margin: 0.55em 0;
  border-collapse: collapse;
  font-size: 0.9em;
}

.chat-md :deep(th),
.chat-md :deep(td) {
  border: 1px solid hsl(var(--border) / 0.8);
  padding: 0.35rem 0.5rem;
  text-align: left;
}

.chat-md :deep(th) {
  background: hsl(var(--muted) / 0.45);
  font-weight: 600;
}

.chat-md :deep(strong) {
  font-weight: 600;
}
</style>
