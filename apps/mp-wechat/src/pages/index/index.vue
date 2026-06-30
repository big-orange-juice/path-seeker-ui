<script setup lang="ts">
import PageScaffold from "@/components/layout/PageScaffold.vue"
import HallTab from "@/components/shell/HallTab.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES, withQuery } from "@/utils/navigation"

const missionStore = useMissionStore()

function openRoute(routeId: string) {
  uni.navigateTo({
    url: withQuery(MINI_ROUTES.taskDetail, { routeId }),
  })
}
</script>

<template>
  <PageScaffold title="秘径寻踪" :show-back="false" overlay-nav>
    <HallTab
      :routes="missionStore.filteredRoutes"
      :active-route-id="missionStore.activeSession?.routeId || ''"
      :completed-route-ids="missionStore.archiveEntries.map((item) => item.routeId)"
      :filters="missionStore.filters"
      :coverage="missionStore.coverageSummary"
      @open="openRoute"
      @filter-age-band="missionStore.setFilters({ ageBand: $event })"
      @filter-difficulty="missionStore.setFilters({ difficulty: $event })"
      @filter-task-kind="missionStore.setFilters({ taskKind: $event })" />
  </PageScaffold>
</template>
