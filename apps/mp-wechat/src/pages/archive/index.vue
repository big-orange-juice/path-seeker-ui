<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import ArchiveTab from "@/components/shell/ArchiveTab.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { requireAuthForTab } from "@/utils/authGuard"
import { MINI_ROUTES, withQuery } from "@/utils/navigation"

const missionStore = useMissionStore()

function openRoute(routeId: string) {
  uni.navigateTo({
    url: withQuery(MINI_ROUTES.taskDetail, { routeId }),
  })
}

onShow(() => {
  requireAuthForTab()
})
</script>

<template>
  <PageScaffold title="我的收获" :show-back="false">
    <ArchiveTab :entries="missionStore.archiveEntries" @open="openRoute" />
  </PageScaffold>
</template>
