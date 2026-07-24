<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRouter } from "vue-router"
import { ClientEmptyState, ClientSkeleton } from "@/components/ui"
import HistoryRouteCard from "@/components/shell/HistoryRouteCard.vue"
import { useMissionStore } from "@/stores/useMissionStore"

const router = useRouter()
const missionStore = useMissionStore()

const items = computed(() => missionStore.playingHistory)
const loading = computed(
  () => missionStore.playingHistoryPending && items.value.length === 0,
)
const failed = computed(
  () => Boolean(missionStore.playingHistoryError) && items.value.length === 0,
)

async function refresh(force = true) {
  await missionStore.loadPlayingHistory({ force })
}

onMounted(() => {
  void refresh(true)
})
</script>

<template>
  <div class="client-surface">
    <header class="client-surface-block space-y-1">
      <p class="client-top-kicker">Playing</p>
      <h1 class="client-page-title">探索中</h1>
      <p class="client-page-copy">进行中的路线由服务端同步，点选可继续。</p>
    </header>

    <div v-if="loading" class="space-y-3">
      <ClientSkeleton class="h-20 w-full rounded-[1rem]" />
      <ClientSkeleton class="h-20 w-full rounded-[1rem]" />
    </div>

    <template v-else-if="items.length">
      <p
        v-if="missionStore.playingHistoryError"
        class="text-xs text-muted-foreground"
      >
        刷新失败，仍显示上次结果。
        <button type="button" class="text-primary underline-offset-2 hover:underline" @click="refresh(true)">
          重试
        </button>
      </p>
      <div class="client-surface-block">
        <HistoryRouteCard
          v-for="item in items"
          :key="`${item.routeId}-${item.startedAt || ''}`"
          :item="item"
          mode="map"
        />
      </div>
    </template>

    <ClientEmptyState
      v-else
      :title="failed ? '加载失败' : '暂无进行中的探索'"
      :description="
        failed
          ? missionStore.playingHistoryError || '请检查网络后重试。'
          : '从展厅选择一条路线开始探索。'
      "
      :action-text="failed ? '重新加载' : '去展厅'"
      @action="failed ? refresh(true) : router.push('/shell/hall')"
    />
  </div>
</template>
