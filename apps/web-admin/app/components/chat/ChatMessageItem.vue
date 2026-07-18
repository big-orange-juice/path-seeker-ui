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
  <article
    class="chat-turn group relative"
    :class="isUser ? 'chat-turn--user' : 'chat-turn--assistant'">
    <!-- 助手：左侧路径轨 -->
    <div v-if="!isUser" class="chat-turn__rail" aria-hidden="true">
      <span class="chat-turn__node" :class="{ 'is-live': isStreaming }" />
    </div>

    <div class="chat-turn__body" :class="isUser ? 'items-end' : 'items-start'">
      <div
        class="chat-turn__meta"
        :class="isUser ? 'justify-end' : 'justify-start'">
        <span class="chat-turn__role">
          {{ isUser ? '指令' : '助手' }}
        </span>
        <span
          v-if="isStreaming"
          class="chat-turn__live">
          生成中
        </span>
        <span
          v-else-if="isFailed"
          class="chat-turn__fail">
          失败
        </span>
      </div>

      <div
        class="chat-bubble"
        :class="{
          'chat-bubble--user': isUser,
          'chat-bubble--assistant': isAssistant && !isFailed,
          'chat-bubble--failed': isFailed,
          'chat-bubble--streaming': isStreaming && !message.content,
        }">
        <Comark
          v-if="isAssistant && message.content"
          :markdown="message.content"
          :streaming="isStreaming"
          class="chat-md break-words" />
        <p v-else-if="message.content" class="whitespace-pre-wrap break-words">
          {{ message.content }}
        </p>
        <p v-else-if="isStreaming" class="chat-thinking">
          <span class="chat-thinking__dot" />
          <span class="chat-thinking__dot" />
          <span class="chat-thinking__dot" />
          <span class="sr-only">正在思考</span>
        </p>
        <p v-else-if="isFailed && message.errorMessage" class="whitespace-pre-wrap break-words">
          {{ message.errorMessage }}
        </p>
        <p v-else class="text-muted-foreground">
          —
        </p>

        <span
          v-if="isStreaming && message.content"
          class="chat-caret"
          aria-hidden="true" />
      </div>

      <div v-if="isFailed && showRetry" class="pt-1">
        <Button variant="outline" size="sm" type="button" class="h-7 rounded-md px-2.5 text-xs" @click="emit('retry')">
          <AppIcon name="refresh-cw" class="h-3 w-3" />
          重试
        </Button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.chat-turn {
  display: flex;
  gap: 0.65rem;
  width: 100%;
}

.chat-turn--user {
  justify-content: flex-end;
  padding-left: 12%;
}

.chat-turn--assistant {
  padding-right: 4%;
}

.chat-turn__rail {
  position: relative;
  display: flex;
  width: 0.75rem;
  flex-shrink: 0;
  justify-content: center;
  padding-top: 0.45rem;
}

.chat-turn__rail::before {
  content: '';
  position: absolute;
  top: 1rem;
  bottom: -0.85rem;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: linear-gradient(
    180deg,
    rgba(209, 178, 111, 0.45),
    rgba(209, 178, 111, 0.08) 70%,
    transparent
  );
}

.chat-turn:last-child .chat-turn__rail::before {
  bottom: 0.25rem;
  opacity: 0.45;
}

.chat-turn__node {
  position: relative;
  z-index: 1;
  height: 0.55rem;
  width: 0.55rem;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.55);
  background: rgba(17, 19, 22, 0.95);
  box-shadow: 0 0 0 3px rgba(209, 178, 111, 0.08);
}

.chat-turn__node.is-live {
  border-color: rgba(209, 178, 111, 0.9);
  background: rgb(209, 178, 111);
  box-shadow:
    0 0 0 4px rgba(209, 178, 111, 0.14),
    0 0 12px rgba(209, 178, 111, 0.35);
  animation: chat-node-pulse 1.6s ease-in-out infinite;
}

.chat-turn__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.35rem;
}

.chat-turn--user .chat-turn__body {
  flex: 0 1 auto;
  max-width: 100%;
}

.chat-turn__meta {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 1rem;
}

.chat-turn__role {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(209, 178, 111, 0.72);
}

.chat-turn--user .chat-turn__role {
  color: rgba(232, 214, 168, 0.78);
}

.chat-turn__live,
.chat-turn__fail {
  font-size: 10px;
  letter-spacing: 0.04em;
}

.chat-turn__live {
  color: rgba(209, 178, 111, 0.85);
}

.chat-turn__fail {
  color: hsl(var(--destructive));
}

.chat-bubble {
  position: relative;
  max-width: 100%;
  border-radius: 0.85rem;
  padding: 0.7rem 0.85rem;
  font-size: 0.875rem;
  line-height: 1.65;
}

.chat-bubble--assistant {
  border: 1px solid rgba(255, 255, 255, 0.05);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.03), transparent 42%),
    rgba(22, 24, 28, 0.92);
  color: hsl(var(--foreground));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 8px 22px rgba(0, 0, 0, 0.14);
}

.chat-bubble--user {
  border: 1px solid rgba(209, 178, 111, 0.28);
  background:
    linear-gradient(135deg, rgba(209, 178, 111, 0.22), rgba(209, 178, 111, 0.08)),
    rgba(28, 24, 16, 0.72);
  color: #fff6e4;
  box-shadow:
    inset 0 1px 0 rgba(255, 245, 220, 0.08),
    0 10px 24px rgba(209, 178, 111, 0.08);
  border-bottom-right-radius: 0.35rem;
}

.chat-bubble--failed {
  border: 1px solid rgba(239, 68, 68, 0.28);
  background: rgba(239, 68, 68, 0.08);
  color: hsl(var(--destructive));
}

.chat-bubble--streaming {
  min-height: 2.6rem;
  display: flex;
  align-items: center;
}

.chat-thinking {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  color: hsl(var(--muted-foreground));
}

.chat-thinking__dot {
  height: 0.28rem;
  width: 0.28rem;
  border-radius: 999px;
  background: rgba(209, 178, 111, 0.75);
  animation: chat-dot 1.1s ease-in-out infinite;
}

.chat-thinking__dot:nth-child(2) {
  animation-delay: 0.15s;
}

.chat-thinking__dot:nth-child(3) {
  animation-delay: 0.3s;
}

.chat-caret {
  display: inline-block;
  width: 0.12rem;
  height: 0.95em;
  margin-left: 0.12rem;
  vertical-align: -0.12em;
  background: rgba(209, 178, 111, 0.9);
  animation: chat-caret 0.9s steps(1) infinite;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes chat-node-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 4px rgba(209, 178, 111, 0.12),
      0 0 10px rgba(209, 178, 111, 0.28);
  }
  50% {
    box-shadow:
      0 0 0 6px rgba(209, 178, 111, 0.08),
      0 0 16px rgba(209, 178, 111, 0.42);
  }
}

@keyframes chat-dot {
  0%,
  80%,
  100% {
    opacity: 0.28;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-1px);
  }
}

@keyframes chat-caret {
  0%,
  45% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-turn__node.is-live,
  .chat-thinking__dot,
  .chat-caret {
    animation: none;
  }
}

.chat-md :deep(:first-child) {
  margin-top: 0;
}

.chat-md :deep(:last-child) {
  margin-bottom: 0;
}

.chat-md :deep(p) {
  margin: 0.35em 0;
}

.chat-md :deep(h1),
.chat-md :deep(h2),
.chat-md :deep(h3),
.chat-md :deep(h4) {
  margin: 0.7em 0 0.3em;
  font-weight: 600;
  line-height: 1.35;
  color: hsl(var(--foreground));
}

.chat-md :deep(h1) {
  font-size: 1.05rem;
}

.chat-md :deep(h2) {
  font-size: 1rem;
}

.chat-md :deep(h3),
.chat-md :deep(h4) {
  font-size: 0.95rem;
}

.chat-md :deep(ul),
.chat-md :deep(ol) {
  margin: 0.35em 0;
  padding-left: 1.15rem;
}

.chat-md :deep(ul) {
  list-style: disc;
}

.chat-md :deep(ol) {
  list-style: decimal;
}

.chat-md :deep(li) {
  margin: 0.12em 0;
}

.chat-md :deep(li > p) {
  margin: 0.12em 0;
}

.chat-md :deep(blockquote) {
  margin: 0.45em 0;
  border-left: 2px solid rgba(209, 178, 111, 0.35);
  padding-left: 0.7rem;
  color: hsl(var(--muted-foreground));
}

.chat-md :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
}

.chat-md :deep(code) {
  border-radius: 0.3rem;
  background: rgba(209, 178, 111, 0.1);
  padding: 0.08em 0.32em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.84em;
  color: #f0e2bc;
}

.chat-md :deep(pre) {
  margin: 0.5em 0;
  overflow-x: auto;
  border-radius: 0.55rem;
  border: 1px solid rgba(209, 178, 111, 0.12);
  background: rgba(8, 9, 11, 0.72);
  padding: 0.6rem 0.7rem;
}

.chat-md :deep(pre code) {
  display: block;
  padding: 0;
  background: transparent;
  font-size: 0.78em;
  line-height: 1.55;
  white-space: pre;
}

.chat-md :deep(hr) {
  margin: 0.7em 0;
  border: 0;
  border-top: 1px solid rgba(209, 178, 111, 0.14);
}

.chat-md :deep(table) {
  width: 100%;
  margin: 0.5em 0;
  border-collapse: collapse;
  font-size: 0.88em;
}

.chat-md :deep(th),
.chat-md :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.3rem 0.45rem;
  text-align: left;
}

.chat-md :deep(th) {
  background: rgba(209, 178, 111, 0.08);
  font-weight: 600;
}

.chat-md :deep(strong) {
  font-weight: 600;
  color: #f4e7c4;
}
</style>
