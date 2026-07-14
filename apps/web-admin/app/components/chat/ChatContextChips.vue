<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';

export interface ChatContextChip {
  kind: 'route' | 'stage';
  id: string;
  label: string;
  removable: boolean;
}

interface Props {
  chips: ChatContextChip[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  remove: [chip: ChatContextChip];
}>();
</script>

<template>
  <div v-if="props.chips.length" class="flex flex-wrap gap-1.5 border-t border-border/70 px-4 py-3">
    <span
      v-for="chip in props.chips"
      :key="`${chip.kind}-${chip.id}`"
      class="inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
      :class="chip.kind === 'route'
        ? 'border-primary/25 bg-primary/10 text-foreground'
        : 'border-border/70 bg-muted/40 text-muted-foreground'">
      <AppIcon
        :name="chip.kind === 'route' ? 'lock' : 'puzzle'"
        class="h-3 w-3 shrink-0"
        :class="chip.kind === 'route' ? 'text-primary' : 'text-muted-foreground'" />
      <span class="min-w-0 truncate">
        <span class="text-muted-foreground">{{ chip.kind === 'route' ? '路线' : '节点' }} · </span>
        {{ chip.label }}
      </span>
      <button
        v-if="chip.removable"
        type="button"
        class="ml-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
        title="移除节点上下文"
        @click="emit('remove', chip)">
        <AppIcon name="x" class="h-3 w-3" />
      </button>
    </span>
  </div>
</template>
