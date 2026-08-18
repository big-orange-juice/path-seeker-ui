<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';
import type { ChatToolActivity } from '@/types/chat';

interface Props {
  tools: ChatToolActivity[];
}

const props = defineProps<Props>();
</script>

<template>
  <div v-if="props.tools.length" class="chat-tools">
    <div class="chat-tools__head">
      <span class="chat-tools__pulse" aria-hidden="true" />
      <span class="chat-tools__title">工具执行</span>
    </div>
    <div class="chat-tools__list">
      <span
        v-for="tool in props.tools"
        :key="tool.id || tool.callId"
        class="chat-tool"
        :class="`is-${tool.status}`">
        <AppIcon
          :name="tool.status === 'running' ? 'loader-circle' : tool.status === 'failed' ? 'circle-alert' : 'circle-check'"
          class="h-3 w-3"
          :class="tool.status === 'running' ? 'animate-spin' : ''" />
        {{ tool.label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.chat-tools {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-left: 1.05rem;
  border-radius: 0.75rem;
  border: 1px dashed rgba(209, 178, 111, 0.18);
  background: rgba(209, 178, 111, 0.04);
  padding: 0.5rem 0.65rem;
}

.chat-tools__head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.chat-tools__pulse {
  height: 0.4rem;
  width: 0.4rem;
  border-radius: 999px;
  background: rgba(209, 178, 111, 0.9);
  box-shadow: 0 0 0 3px rgba(209, 178, 111, 0.12);
  animation: chat-tool-pulse 1.4s ease-in-out infinite;
}

.chat-tools__title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(209, 178, 111, 0.7);
}

.chat-tools__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chat-tool {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.18rem 0.5rem;
  font-size: 11px;
}

.chat-tool.is-running {
  border-color: rgba(209, 178, 111, 0.22);
  background: rgba(17, 19, 22, 0.55);
  color: rgba(236, 220, 176, 0.92);
}

.chat-tool.is-done {
  border-color: rgba(52, 211, 153, 0.22);
  background: rgba(16, 185, 129, 0.08);
  color: rgb(110, 231, 183);
}

.chat-tool.is-failed {
  border-color: rgba(248, 113, 113, 0.28);
  background: rgba(239, 68, 68, 0.08);
  color: rgb(252, 165, 165);
}

@keyframes chat-tool-pulse {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(0.92);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-tools__pulse {
    animation: none;
  }
}
</style>
