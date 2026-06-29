<script setup lang="ts">
import { computed } from "vue"
import { onShow } from "@dcloudio/uni-app"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import HallTab from "@/components/shell/HallTab.vue"
import PlayTab from "@/components/shell/PlayTab.vue"
import ArchiveTab from "@/components/shell/ArchiveTab.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { MINI_ROUTES, withQuery } from "@/utils/navigation"

const missionStore = useMissionStore()

const shellMeta = computed(() => {
  const tab = missionStore.activeShellTab

  if (tab === "playing") {
    return {
      title: "继续任务",
      subtitle: missionStore.activeMission?.title || "",
    }
  }

  if (tab === "archive") {
    return {
      title: "我的收获",
      subtitle: "",
    }
  }

  return {
    title: "秘径寻踪",
    subtitle: "",
  }
})

function openRoute(routeId: string) {
  uni.navigateTo({
    url: withQuery(MINI_ROUTES.taskDetail, { routeId }),
  })
}

function continueMission() {
  const session = missionStore.activeSession

  if (!session) {
    return
  }

  if (session.latestChapterResult) {
    const path = session.latestChapterResult.finalChapter ? MINI_ROUTES.finale : MINI_ROUTES.chapterResult
    uni.redirectTo({ url: path })
    return
  }

  const path = session.status === "completed" ? MINI_ROUTES.finale : MINI_ROUTES.chapterMap
  uni.redirectTo({ url: path })
}

function replayMission(routeId: string) {
  missionStore.replayMission(routeId)
  uni.redirectTo({ url: MINI_ROUTES.prologue })
}

onShow(() => {
  if (missionStore.activeSession && missionStore.activeSession.status === "in_progress") {
    missionStore.setShellTab("playing")
  }
})
</script>

<template>
  <PageScaffold :title="shellMeta.title" :subtitle="shellMeta.subtitle" :show-back="false">
    <transition name="page-fade" mode="out-in">
      <HallTab
        v-if="missionStore.activeShellTab === 'hall'"
        :routes="missionStore.filteredRoutes"
        :active-route-id="missionStore.activeSession?.routeId || ''"
        :completed-route-ids="missionStore.archiveEntries.map((item) => item.routeId)"
        :filters="missionStore.filters"
        :coverage="missionStore.coverageSummary"
        @open="openRoute"
        @filter-age-band="missionStore.setFilters({ ageBand: $event })"
        @filter-difficulty="missionStore.setFilters({ difficulty: $event })"
        @filter-task-kind="missionStore.setFilters({ taskKind: $event })"
      />

      <PlayTab
        v-else-if="missionStore.activeShellTab === 'playing'"
        :mission="missionStore.activeMission"
        :session="missionStore.activeSession"
        :progress-percent="missionStore.progressPercent"
        :unlocked-clues="missionStore.unlockedClueTitles"
        @continue="continueMission"
        @replay="replayMission"
        @open="openRoute"
      />

      <ArchiveTab v-else :entries="missionStore.archiveEntries" @open="openRoute" />
    </transition>
  </PageScaffold>
</template>
