<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue"
import { useRouter } from "vue-router"
import { ClientEmptyState, ClientSkeleton, ClientTabs, ClientTabsContent, ClientTabsList, ClientTabsTrigger } from "@/components/ui"
import HistoryRouteCard from "@/components/shell/HistoryRouteCard.vue"
import { useMissionStore } from "@/stores/useMissionStore"

const router = useRouter()
const missionStore = useMissionStore()
const tab = shallowRef<"completed" | "footprints">("completed")

const completed = computed(() => missionStore.completedHistory)
const footprints = computed(() => missionStore.footprintHistory)
const loading = computed(
  () =>
    missionStore.playHistoryPending
    && completed.value.length === 0
    && footprints.value.length === 0,
)
const failed = computed(
  () =>
    Boolean(missionStore.playHistoryError)
    && completed.value.length === 0
    && footprints.value.length === 0,
)

async function refresh(force = true) {
  await missionStore.loadPlayHistory({ force })
}

onMounted(() => {
  void refresh(true)
})
</script>

<template>
  <div class="client-surface">
    <header class="client-surface-block space-y-1">
      <p class="client-top-kicker">History</p>
      <h1 class="client-page-title">游玩历史</h1>
      <p class="client-page-copy">已完成路线与足迹由服务端同步，可回看结算。</p>
    </header>

    <div v-if="loading" class="space-y-3">
      <ClientSkeleton class="h-20 w-full rounded-[1rem]" />
      <ClientSkeleton class="h-20 w-full rounded-[1rem]" />
    </div>

    <template v-else-if="!failed">
      <p
        v-if="missionStore.playHistoryError"
        class="text-xs text-muted-foreground"
      >
        刷新失败，仍显示上次结果。
        <button type="button" class="text-primary underline-offset-2 hover:underline" @click="refresh(true)">
          重试
        </button>
      </p>

      <ClientTabs v-model="tab">
        <ClientTabsList class="grid w-full grid-cols-2">
          <ClientTabsTrigger value="completed">
            已完成 {{ completed.length ? `(${completed.length})` : "" }}
          </ClientTabsTrigger>
          <ClientTabsTrigger value="footprints">
            足迹 {{ footprints.length ? `(${footprints.length})` : "" }}
          </ClientTabsTrigger>
        </ClientTabsList>

        <ClientTabsContent value="completed">
          <div v-if="completed.length" class="client-surface-block">
            <HistoryRouteCard
              v-for="item in completed"
              :key="`c-${item.routeId}-${item.completedAt || item.startedAt || ''}`"
              :item="item"
              mode="finale"
            />
          </div>
          <ClientEmptyState
            v-else
            title="暂无已完成路线"
            description="通关后会出现在这里，可回看终局结算。"
            action-text="去展厅"
            @action="router.push('/shell/hall')"
          />
        </ClientTabsContent>

        <ClientTabsContent value="footprints">
          <div v-if="footprints.length" class="client-surface-block">
            <HistoryRouteCard
              v-for="item in footprints"
              :key="`f-${item.routeId}-${item.footprintNo ?? ''}-${item.completedAt || ''}`"
              :item="item"
              mode="finale"
            />
          </div>
          <ClientEmptyState
            v-else
            title="暂无足迹"
            description="完成路线后会留下足迹记录。"
            action-text="去展厅"
            @action="router.push('/shell/hall')"
          />
        </ClientTabsContent>
      </ClientTabs>
    </template>

    <ClientEmptyState
      v-else
      title="游玩历史加载失败"
      :description="missionStore.playHistoryError || '请检查网络后重试。'"
      action-text="重新加载"
      @action="refresh(true)"
    />
  </div>
</template>
