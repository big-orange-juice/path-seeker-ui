<script setup lang="ts">
import { UiAppIcon } from "@path-seeker/ui"
import { ClientBadge, ClientCard } from "@/components/ui"

interface Props {
  missionCount: number
  archiveCount: number
  hasActiveSession: boolean
}

defineProps<Props>()
</script>

<template>
  <ClientCard class="overflow-hidden">
    <div class="space-y-4 p-5">
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-2">
          <ClientBadge>H5 Client</ClientBadge>
          <h2 class="font-display text-2xl text-foreground">真实任务流已接入 H5</h2>
          <p class="client-page-copy">
            当前大厅、详情和章节地图已经基于远程接口运行，接下来继续补齐观察页、题型页和结算闭环。
          </p>
        </div>
        <div class="rounded-full border border-primary/20 bg-primary/10 p-3 text-primary">
          <UiAppIcon name="sparkles" class="h-5 w-5" />
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3 text-left">
        <div class="rounded-[0.9rem] bg-background/70 p-3">
          <div class="text-xs uppercase tracking-[0.12em] text-muted-foreground">路线</div>
          <div class="mt-2 text-xl font-semibold text-foreground">{{ missionCount }}</div>
        </div>
        <div class="rounded-[0.9rem] bg-background/70 p-3">
          <div class="text-xs uppercase tracking-[0.12em] text-muted-foreground">归档</div>
          <div class="mt-2 text-xl font-semibold text-foreground">{{ archiveCount }}</div>
        </div>
        <div class="rounded-[0.9rem] bg-background/70 p-3">
          <div class="text-xs uppercase tracking-[0.12em] text-muted-foreground">继续游玩</div>
          <div class="mt-2 text-xl font-semibold text-foreground">{{ hasActiveSession ? "可恢复" : "暂无" }}</div>
        </div>
      </div>
    </div>
  </ClientCard>
</template>
