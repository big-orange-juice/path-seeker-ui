<script setup lang="ts">
interface Props {
  filter: 'all' | 'published' | 'draft' | 'review';
  search: string;
}

interface Emits {
  'update:filter': [value: Props['filter']];
  'update:search': [value: string];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const tabs = [
  { label: '全部', value: 'all' },
  { label: '已发布', value: 'published' },
  { label: '待审核', value: 'review' },
  { label: '未上架', value: 'draft' },
] as const;
</script>

<template>
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div class="flex flex-wrap gap-2">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        class="rounded-lg border px-3 py-1.5 text-xs transition-colors"
        :class="
          props.filter === tab.value
            ? 'border-primary/50 bg-secondary text-foreground'
            : 'border-border bg-card text-muted-foreground hover:text-foreground'
        "
        @click="emit('update:filter', tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <UiInput
      :model-value="props.search"
      placeholder="搜索路线、年龄层或主题"
      class="w-full md:w-72"
      @update:model-value="emit('update:search', $event)"
    />
  </div>
</template>
