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
      :key="tool.callId"
      class="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
      <AppIcon
        :name="tool.status === 'running' ? 'loader-circle' : 'sparkles'"
        class="h-3.5 w-3.5"
        :class="tool.status === 'running' ? 'animate-spin text-primary' : 'text-primary'" />
      {{ tool.label }}
    </span>
  </div>
</template>
