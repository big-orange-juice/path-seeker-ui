<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"

const missionStore = useMissionStore()
const router = useRouter()
const toastStore = useToastStore()

const activeSession = computed(() => missionStore.activeSession)
const hasRestorableSession = computed(() => Boolean(activeSession.value))
const mapPath = computed(() =>
  activeSession.value ? `/missions/${activeSession.value.routeId}/map` : "/shell/hall",
)

async function restoreMission() {
  if (!missionStore.activeSession || missionStore.activeMission) {
    return
  }
  await missionStore.restoreActiveMission()
}

/** 继续探索：统一进 map 选站，不再在探索页维护第二份节点列表 */
async function openRouteMap() {
  if (!activeSession.value) {
    toastStore.warning("当前没有可恢复节点", "先回到任务大厅选择一条路线开始。")
    return
  }

  if (!missionStore.activeMission) {
    await missionStore.restoreActiveMission()
  }

  toastStore.info("继续任务", "请在路线页选择要进入的站点。")
  await router.push(mapPath.value)
}

function clearCurrentSession() {
  missionStore.clearActiveSession()
  toastStore.info("已清空当前会话", "本地恢复记录已移除，但远程任务进度仍保留。")
}

async function replayCurrentMission() {
  if (!activeSession.value) {
    return
  }

  const session = await missionStore.replayMission(activeSession.value.routeId)
  if (!session) {
    toastStore.error("重新开始失败", missionStore.gameplayError || "请稍后再试。")
    return
  }

  toastStore.success("已重建任务会话", "新的任务进度已经就绪。")
  await router.push(`/missions/${session.routeId}/map`)
}

onMounted(() => {
  void restoreMission()
})
</script>

<template>
  <div class="client-surface">
    <template v-if="hasRestorableSession">
      <div class="client-surface-block space-y-3">
        <span class="client-tag is-gold">探索中</span>
        <h2 class="text-2xl font-display text-foreground">{{ activeSession?.routeTitle }}</h2>
        <p class="client-page-copy">
          {{ missionStore.currentChapter?.title || "打开路线选择一站继续" }}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="client-stat-cell">
          <div class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">进度</div>
          <div class="mt-2 text-lg font-semibold text-foreground">{{ missionStore.progressPercent }}%</div>
        </div>
        <div class="client-stat-cell">
          <div class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">已完成</div>
          <div class="mt-2 text-lg font-semibold text-foreground">
            {{ activeSession?.solvedChapterIds.length ?? 0 }}/{{ missionStore.activeMission?.chapterCount ?? 0 }}
          </div>
        </div>
      </div>

      <div class="grid gap-3 pt-1">
        <ClientButton class="w-full" @click="openRouteMap()">
          打开路线选站
        </ClientButton>
        <div class="grid grid-cols-2 gap-3">
          <ClientButton variant="outline" class="w-full" @click="clearCurrentSession()">
            清空
          </ClientButton>
          <ClientButton
            v-if="activeSession?.routeId"
            variant="outline"
            class="w-full"
            @click="replayCurrentMission()"
          >
            重新开始
          </ClientButton>
        </div>
      </div>
    </template>

    <div v-else-if="missionStore.gameplayPending || missionStore.detailPending" class="space-y-4">
      <ClientSkeleton class="h-8 w-36" />
      <div class="grid grid-cols-2 gap-3">
        <ClientSkeleton class="h-20 w-full" />
        <ClientSkeleton class="h-20 w-full" />
      </div>
      <ClientSkeleton class="h-10 w-full" />
      <ClientSkeleton class="h-10 w-full" />
    </div>

    <ClientEmptyState
      v-else
      title="还没有任务"
      description="先去展厅选一条路线开始。"
      action-text="去展厅"
      @action="router.push('/shell/hall')"
    />
  </div>
</template>
