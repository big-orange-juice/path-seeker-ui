<script setup lang="ts">
import type { ThemeRoute } from '@/composables/useAdminContent';

interface Props {
  route: ThemeRoute;
}

const props = defineProps<Props>();

const statusMap = {
  published: { label: '已发布', className: 'bg-emerald-500/10 text-emerald-300' },
  review: { label: '待审核', className: 'bg-amber-500/10 text-amber-300' },
  draft: { label: '草稿', className: 'bg-slate-500/10 text-slate-300' },
} as const;
</script>

<template>
  <UiCard class="p-4">
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-foreground">{{ props.route.title }}</h3>
          <span
            class="rounded-full px-2 py-0.5 text-[11px]"
            :class="statusMap[props.route.status].className"
          >
            {{ statusMap[props.route.status].label }}
          </span>
        </div>
        <p class="text-xs text-muted-foreground">
          {{ props.route.type }} · {{ props.route.ageGroup }} · {{ props.route.duration }}
        </p>
        <p class="text-sm leading-6 text-muted-foreground">{{ props.route.summary }}</p>
      </div>
      <UiButton variant="ghost" size="sm">查看</UiButton>
    </div>

    <div class="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-[1fr_180px]">
      <div>
        <p class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">章节结构</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <span
            v-for="step in props.route.structure"
            :key="step"
            class="rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs text-foreground/90"
          >
            {{ step }}
          </span>
        </div>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">结案奖励</p>
        <p class="mt-2 text-sm text-foreground">{{ props.route.reward }}</p>
      </div>
    </div>
  </UiCard>
</template>
