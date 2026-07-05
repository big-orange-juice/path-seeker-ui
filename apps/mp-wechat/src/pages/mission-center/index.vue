<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app"
import PageScaffold from "@/components/layout/PageScaffold.vue"
import PlayTab from "@/components/shell/PlayTab.vue"
import { useMissionStore } from "@/stores/useMissionStore"
import { requireAuthForTab } from "@/utils/authGuard"
import { MINI_ROUTES, withQuery } from "@/utils/navigation"

const missionStore = useMissionStore()

function openRoute(routeId: string) {
  uni.navigateTo({
    url: withQuery(MINI_ROUTES.taskDetail, { routeId }),
  })
}

function continueMission(index?: number) {
  const session = missionStore.activeSession

  if (!session) {
    return
  }

  if (typeof index === "number") {
    if (!missionStore.selectChapter(index)) {
      return
    }

    uni.navigateTo({ url: MINI_ROUTES.artifactClue })
    return
  }

  if (session.latestChapterResult) {
    const path = session.latestChapterResult.finalChapter ? MINI_ROUTES.finale : MINI_ROUTES.chapterResult
    uni.navigateTo({ url: path })
    return
  }

  const path = session.status === "completed" ? MINI_ROUTES.finale : MINI_ROUTES.chapterMap
  uni.navigateTo({ url: path })
}

async function replayMission(routeId: string) {
  const session = await missionStore.replayMission(routeId)

  if (!session) {
    return
  }

  uni.navigateTo({ url: MINI_ROUTES.prologue })
}

onShow(() => {
  requireAuthForTab()
  void missionStore.restoreActiveMission()
})
</script>

<template>
  <PageScaffold title="继续任务" :subtitle="missionStore.activeMission?.title || ''" :show-back="false">
    <PlayTab
      :mission="missionStore.activeMission"
      :session="missionStore.activeSession"
      :progress-percent="missionStore.progressPercent"
      :unlocked-clues="missionStore.unlockedClueTitles"
      @continue="continueMission"
      @replay="replayMission"
      @open="openRoute" />
  </PageScaffold>
</template>
