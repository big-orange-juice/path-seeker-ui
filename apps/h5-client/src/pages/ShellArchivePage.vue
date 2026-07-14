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
          <div class="space-y-1.5">
            <span class="client-tag is-gold">徽章</span>
            <h2 class="text-2xl font-display text-foreground">{{ entry.routeTitle }}</h2>
            <p v-if="entry.rewardTitle" class="client-page-copy">{{ entry.rewardTitle }}</p>
          </div>
          <div class="text-2xl font-semibold tabular-nums text-primary">
            {{ entry.totalScore }}
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="rounded-[0.9rem] bg-background/70 p-3 text-center">
            <div class="text-base font-semibold text-foreground">{{ entry.solvedCount }}/{{ entry.puzzleCount }}</div>
            <div class="mt-1 text-[11px] text-muted-foreground">站</div>
          </div>
          <div class="rounded-[0.9rem] bg-background/70 p-3 text-center">
            <div class="text-base font-semibold text-foreground">{{ entry.usedHintCount }}</div>
            <div class="mt-1 text-[11px] text-muted-foreground">提示</div>
          </div>
          <div class="rounded-[0.9rem] bg-background/70 p-3 text-center">
            <div class="text-base font-semibold text-foreground">✓</div>
            <div class="mt-1 text-[11px] text-muted-foreground">完成</div>
          </div>
        </div>
      </div>
    </ClientCard>

    <ClientEmptyState
      v-if="!missionStore.archiveEntries.length"
      title="还没有收藏"
      description="完成一条路线后，徽章与成绩会出现在这里。"
      action-text="去闯关"
      @action="router.push('/shell/hall')"
    />
  </div>
</template>
