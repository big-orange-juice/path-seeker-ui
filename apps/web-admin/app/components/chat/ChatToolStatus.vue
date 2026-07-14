<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';
import type { ChatToolActivity } from '@/types/chat';

interface Props {
  tools: ChatToolActivity[];
}

const props = defineProps<Props>();
</script>

<template>
  <div v-if="props.tools.length" class="flex flex-wrap gap-2">
    <span
      v-for="tool in props.tools"
      :key="tool.id || tool.callId"
      class="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
      :class="tool.status === 'running'
        ? 'border-border/70 bg-muted/40 text-muted-foreground'
        : 'border-emerald-400/45 bg-emerald-400/12 text-emerald-500'">
      <AppIcon
        :name="tool.status === 'running' ? 'loader-circle' : 'circle-check'"
        class="h-3.5 w-3.5"
        :class="tool.status === 'running' ? 'animate-spin text-primary' : 'text-emerald-400'" />
      {{ tool.label }}
    </span>
  </div>
</template>
