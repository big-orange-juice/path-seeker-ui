<script setup lang="ts">
import type { MilestoneStage } from '@/composables/useAdminContent';

interface Props {
  stages: MilestoneStage[];
}

defineProps<Props>();
</script>

<template>
  <div class="grid gap-3 lg:grid-cols-3">
    <div
      v-for="stage in stages"
      :key="stage.title"
      class="rounded-xl border border-border bg-secondary/40 px-4 py-4"
    >
      <p class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{{ stage.title }}</p>
      <h4 class="pt-2 text-sm font-semibold text-foreground">{{ stage.target }}</h4>
      <p class="pt-2 text-xs leading-5 text-muted-foreground">{{ stage.details }}</p>
    </div>
  </div>
</template>
