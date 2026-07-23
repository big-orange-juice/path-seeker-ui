<script setup lang="ts">
import type { InfoRow } from '@/composables/useAdminContent';

interface Props {
  items: InfoRow[];
}

defineProps<Props>();
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="item in items"
      :key="item.name"
      class="rounded-xl border border-border bg-secondary/40 px-4 py-3"
    >
      <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div class="space-y-1">
          <p class="text-sm font-medium">{{ item.name }}</p>
          <p class="text-xs leading-5 text-muted-foreground">{{ item.description }}</p>
        </div>
        <p v-if="item.value" class="max-w-xs text-xs leading-5 text-primary md:text-right">{{ item.value }}</p>
      </div>
    </div>
  </div>
</template>
