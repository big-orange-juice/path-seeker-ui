<script setup lang="ts">
import { useRouter } from "vue-router"
import { ClientEmptyState } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"

const missionStore = useMissionStore()
const router = useRouter()
</script>

<template>
  <div class="client-surface">
    <article
      v-for="entry in missionStore.archiveEntries"
      :key="entry.routeId"
      class="client-surface-block space-y-3"
    >
      <div class="space-y-1.5">
        <span class="client-tag is-gold">徽章</span>
        <h2 class="text-2xl font-display text-foreground">{{ entry.routeTitle }}</h2>
        <p v-if="entry.rewardTitle" class="client-page-copy">{{ entry.rewardTitle }}</p>
      </div>

      <div class="grid grid-cols-3 gap-3 text-sm">
        <div class="client-stat-cell">
          <div class="text-base font-semibold text-foreground">{{ entry.solvedCount }}/{{ entry.puzzleCount }}</div>
          <div class="mt-1 text-[11px] text-muted-foreground">站</div>
        </div>
        <div class="client-stat-cell">
          <div class="text-base font-semibold text-foreground">{{ entry.usedHintCount }}</div>
          <div class="mt-1 text-[11px] text-muted-foreground">提示</div>
        </div>
        <div class="client-stat-cell">
          <div class="text-base font-semibold text-foreground">✓</div>
          <div class="mt-1 text-[11px] text-muted-foreground">完成</div>
        </div>
      </div>
    </article>

    <ClientEmptyState
      v-if="!missionStore.archiveEntries.length"
      title="还没有收藏"
      description="完成一条路线后，徽章与记录会出现在这里。"
      action-text="去闯关"
      @action="router.push('/shell/hall')"
    />
  </div>
</template>
