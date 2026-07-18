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
  <div v-if="props.chips.length" class="chat-chips">
    <div class="chat-chips__list">
      <span
        v-for="chip in props.chips"
        :key="`${chip.kind}-${chip.id}`"
        class="chat-chip"
        :class="
          chip.kind === 'route' ? 'chat-chip--route' : 'chat-chip--stage'
        ">
        <AppIcon
          :name="chip.kind === 'route' ? 'route' : 'puzzle'"
          class="h-3 w-3 shrink-0 opacity-80" />
        <span class="min-w-0 truncate">
          <span class="chat-chip__kind">
            {{ chip.kind === 'route' ? '路线' : '节点' }}
          </span>
          {{ chip.label }}
        </span>
        <button
          v-if="chip.removable"
          type="button"
          class="chat-chip__remove"
          title="移除节点上下文"
          @click="emit('remove', chip)">
          <AppIcon name="x" class="h-3 w-3" />
        </button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.chat-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.55rem;
  padding: 0.45rem 0.85rem 0.15rem;
}

.chat-chips__label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(209, 178, 111, 0.55);
}

.chat-chips__list {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chat-chip {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.35rem;
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.22rem 0.5rem 0.22rem 0.45rem;
  font-size: 11px;
  line-height: 1.2;
}

.chat-chip--route {
  border-color: rgba(209, 178, 111, 0.28);
  background: linear-gradient(
    135deg,
    rgba(209, 178, 111, 0.16),
    rgba(209, 178, 111, 0.05)
  );
  color: #f3e7c8;
}

.chat-chip--stage {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: hsl(var(--muted-foreground));
}

.chat-chip__kind {
  margin-right: 0.15rem;
  opacity: 0.65;
}

.chat-chip__remove {
  display: inline-flex;
  height: 1rem;
  width: 1rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: inherit;
  opacity: 0.7;
  transition:
    opacity 0.15s ease,
    background 0.15s ease;
}

.chat-chip__remove:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08);
}
</style>
