<script setup lang="ts">
import type { VenueDraft } from '@/types/map-management';

interface Props {
  venues: VenueDraft[];
  mapImage?: string;
}

defineProps<Props>();

defineEmits<{
  'update:venues': [value: VenueDraft[]];
}>();
</script>

<template>
  <section class="space-y-3 rounded-[1.25rem] bg-[#0f1114] p-4">
    <h3 class="text-sm font-semibold text-foreground">旧版展厅编辑器</h3>
    <p class="text-xs text-muted-foreground">
      当前页面已切换到新的 `MapVenueListEditor`，这里仅保留兼容壳，避免旧文件阻塞类型检查。
    </p>
  </section>
</template>
