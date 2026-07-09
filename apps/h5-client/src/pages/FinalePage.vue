<script setup lang="ts">
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientCard, ClientEmptyState } from "@/components/ui"
import { useMissionStore } from "@/stores/useMissionStore"
import { getDifficultyLabel } from "@/utils/puzzleLabels"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()

const routeId = computed(() => String(route.params.routeId || ""))

async function backToArchive() {
  toastStore.info("已进入归档", "这条路线的完成记录已经沉淀在你的归档里。")
  await router.push("/shell/archive")
}

async function replayMission() {
  if (!missionStore.activeMission) {
    return
  }

  const session = await missionStore.replayMission(missionStore.activeMission.id)
  if (!session) {
    toastStore.error("重新开始失败", missionStore.gameplayError || "请稍后重试。")
    return
  }

  toastStore.success("已重新开始路线", "新的任务会话已经创建。")
  await router.push(`/missions/${missionStore.activeMission.id}/map`)
}
</script>

<template>
  <div class="space-y-4">
    <ClientCard v-if="missionStore.activeMission && missionStore.activeSession" class="overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="space-y-2">
          <p v-if="missionStore.activeMission.rewardTitle" class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            {{ missionStore.activeMission.rewardTitle }}
          </p>
          <h2 class="font-display text-3xl leading-tight text-foreground">{{ missionStore.activeMission.title }}</h2>
          <p v-if="missionStore.activeMission.summary" class="client-page-copy">{{ missionStore.activeMission.summary }}</p>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-[1rem] bg-background/70 p-4 text-center">
            <p class="text-xs text-muted-foreground">总分</p>
            <p class="mt-2 text-2xl font-semibold text-foreground">{{ missionStore.activeSession.totalScore }}</p>
          </div>
          <div class="rounded-[1rem] bg-background/70 p-4 text-center">
            <p class="text-xs text-muted-foreground">完成</p>
            <p class="mt-2 text-2xl font-semibold text-foreground">
              {{ missionStore.activeSession.solvedChapterIds.length }}/{{ missionStore.activeMission.chapterCount }}
            </p>
          </div>
          <div class="rounded-[1rem] bg-background/70 p-4 text-center">
            <p class="text-xs text-muted-foreground">难度</p>
            <p class="mt-2 text-2xl font-semibold text-foreground">{{ getDifficultyLabel(missionStore.activeMission.difficultyLevel) }}</p>
          </div>
        </div>

        <div class="space-y-3">
          <ClientButton variant="outline" class="w-full" @click="backToArchive()">查看归档</ClientButton>
          <ClientButton class="w-full" @click="replayMission()">重新开始</ClientButton>
        </div>
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="终局数据不可用"
      description="请先完成当前路线，再查看终局结果。"
      action-text="返回章节地图"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>
