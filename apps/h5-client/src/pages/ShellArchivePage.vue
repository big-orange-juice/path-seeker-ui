<script setup lang="ts">
import { useRouter } from "vue-router"
import { ClientCard, ClientEmptyState } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"

const missionStore = useMissionStore()
const router = useRouter()
</script>

<template>
  <div class="space-y-4">
    <ClientCard v-for="entry in missionStore.archiveEntries" :key="entry.routeId">
      <div class="space-y-3 p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-2xl font-display text-foreground">{{ entry.routeTitle }}</h2>
            <p class="client-page-copy">{{ entry.rewardTitle }} · {{ entry.difficultyLabel }}</p>
          </div>
          <div class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {{ entry.totalScore }} 分
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="rounded-[0.9rem] bg-background/70 p-3">
            <div class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">章节</div>
            <div class="mt-2 text-foreground">{{ entry.solvedCount }}/{{ entry.puzzleCount }}</div>
          </div>
          <div class="rounded-[0.9rem] bg-background/70 p-3">
            <div class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">提示</div>
            <div class="mt-2 text-foreground">{{ entry.usedHintCount }} 次</div>
          </div>
          <div class="rounded-[0.9rem] bg-background/70 p-3">
            <div class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">状态</div>
            <div class="mt-2 text-foreground">已完成</div>
          </div>
        </div>
      </div>
    </ClientCard>

    <ClientEmptyState
      v-if="!missionStore.archiveEntries.length"
      title="还没有完成归档"
      description="当前还没有已完成的远程路线。完成一条任务后，这里会沉淀真实归档记录。"
      action-text="去任务大厅"
      @action="router.push('/shell/hall')"
    />
  </div>
</template>
