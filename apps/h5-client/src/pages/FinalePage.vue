<script setup lang="ts">
import { computed, onMounted, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { ClientBadge, ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { formatDurationSec } from "@/adapters/gameplayMissionAdapter"
import { useMissionStore } from "@/stores/useMissionStore"
import { getDifficultyLabel } from "@/utils/puzzleLabels"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()

const routeId = computed(() => String(route.params.routeId || ""))

const result = computed(() => {
  const remote = missionStore.routeResult
  if (remote && remote.routeId === routeId.value) {
    return remote
  }
  return null
})

const mission = computed(() => {
  if (missionStore.activeMission?.id === routeId.value) {
    return missionStore.activeMission
  }
  return missionStore.getMission(routeId.value)
})

const session = computed(() => {
  if (missionStore.activeSession?.routeId === routeId.value) {
    return missionStore.activeSession
  }
  return null
})

/** 展示优先 RouteResult，缺字段时用本地会话兜底（不编造叙事） */
const display = computed(() => {
  const remote = result.value
  const localMission = mission.value
  const localSession = session.value

  const totalScore = remote?.totalScore ?? localSession?.totalScore ?? 0
  const solvedCount = remote?.solvedCount ?? localSession?.solvedChapterIds.length ?? 0
  const puzzleCount = remote?.puzzleCount || localMission?.chapterCount || 0
  const title = remote?.routeTitle || localMission?.title || ""
  const rewardTitle = remote?.rewardTitle || localMission?.rewardTitle
  const theme = remote?.theme || localMission?.theme
  const difficultyLabel = localMission ? getDifficultyLabel(localMission.difficultyLevel) : ""
  const durationLabel = formatDurationSec(remote?.durationSec)
  const shareLine = remote?.shareCard?.shareCode
    ? `分享码 ${remote.shareCard.shareCode}`
    : remote?.shareCard?.routeTitle || ""

  return {
    title,
    rewardTitle,
    theme,
    totalScore,
    solvedCount,
    puzzleCount,
    difficultyLabel,
    durationLabel,
    noCluePerfect: remote?.noCluePerfect ?? false,
    usedClueCount: remote?.usedClueCount,
    badges: remote?.badges || [],
    collectibles: remote?.collectibles || [],
    shareLine,
    shareCard: remote?.shareCard || null,
    hasRemote: Boolean(remote),
  }
})

const canShow = computed(() => Boolean(display.value.title || result.value || session.value))

async function ensureFinaleData() {
  if (!routeId.value) {
    return
  }

  // 无 mission 缓存时尽量恢复会话（带 MyRouteProgress）
  if (missionStore.activeSession?.routeId === routeId.value && !missionStore.activeMission) {
    await missionStore.restoreActiveMission()
  }

  const hasResult = missionStore.routeResult?.routeId === routeId.value
  if (!hasResult) {
    await missionStore.loadRouteResult(routeId.value)
  }
}

async function backToArchive() {
  toastStore.info("已进入归档", "这条路线的完成记录已经沉淀在你的归档里。")
  await router.push("/shell/archive")
}

async function replayMission() {
  const targetId = mission.value?.id || routeId.value
  if (!targetId) {
    return
  }

  missionStore.clearRouteResult()
  const nextSession = await missionStore.replayMission(targetId)
  if (!nextSession) {
    toastStore.error("重新开始失败", missionStore.gameplayError || "请稍后重试。")
    return
  }

  toastStore.success("已重新开始路线", "新的任务会话已经创建。")
  await router.push(`/missions/${targetId}/map`)
}

async function copyShareCode() {
  const code = display.value.shareCard?.shareCode
  if (!code) {
    return
  }

  try {
    await navigator.clipboard.writeText(code)
    toastStore.success("已复制分享码", code)
  } catch {
    toastStore.info("分享码", code)
  }
}

onMounted(() => {
  void ensureFinaleData()
})

watch(routeId, () => {
  void ensureFinaleData()
})
</script>

<template>
  <div class="space-y-4">
    <ClientSkeleton v-if="missionStore.routeResultPending && !canShow" class="h-72 w-full rounded-[1.5rem]" />

    <ClientCard v-else-if="canShow" class="overflow-hidden">
      <div class="space-y-5 p-5">
        <div class="space-y-3 text-center">
          <p
            v-if="display.rewardTitle"
            class="text-xs font-semibold uppercase tracking-[0.12em] text-primary"
          >
            {{ display.rewardTitle }}
          </p>
          <p v-else class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            通关
          </p>
          <h2 class="font-display text-3xl leading-tight text-foreground">
            {{ display.title || "探索完成" }}
          </h2>
          <p v-if="display.theme" class="client-page-copy">{{ display.theme }}</p>
          <div class="pt-1">
            <p class="text-4xl font-semibold tabular-nums text-primary">{{ display.totalScore }}</p>
            <p class="mt-1 text-xs text-muted-foreground">总分</p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-[1rem] bg-background/70 p-4 text-center">
            <p class="text-xs text-muted-foreground">完成</p>
            <p class="mt-2 text-xl font-semibold text-foreground">
              {{ display.solvedCount }}/{{ display.puzzleCount || "—" }}
            </p>
          </div>
          <div class="rounded-[1rem] bg-background/70 p-4 text-center">
            <p class="text-xs text-muted-foreground">难度</p>
            <p class="mt-2 text-xl font-semibold text-foreground">
              {{ display.difficultyLabel || "—" }}
            </p>
          </div>
          <div class="rounded-[1rem] bg-background/70 p-4 text-center">
            <p class="text-xs text-muted-foreground">
              {{ display.durationLabel ? "用时" : "线索" }}
            </p>
            <p class="mt-2 text-xl font-semibold text-foreground">
              <template v-if="display.durationLabel">{{ display.durationLabel }}</template>
              <template v-else-if="display.usedClueCount != null">{{ display.usedClueCount }}</template>
              <template v-else>—</template>
            </p>
          </div>
        </div>

        <div
          v-if="display.noCluePerfect"
          class="rounded-[1rem] border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm text-primary"
        >
          无线索完美通关
        </div>

        <div v-if="display.badges.length" class="space-y-3">
          <p class="text-sm font-semibold text-foreground">获得徽章</p>
          <div class="flex flex-wrap gap-2">
            <ClientBadge
              v-for="badge in display.badges"
              :key="badge.id"
              class="max-w-full"
            >
              {{ badge.name }}
            </ClientBadge>
          </div>
          <p
            v-for="badge in display.badges.filter((item) => item.description)"
            :key="`${badge.id}-desc`"
            class="text-xs text-muted-foreground"
          >
            {{ badge.name }}：{{ badge.description }}
          </p>
        </div>

        <div v-if="display.collectibles.length" class="space-y-3">
          <p class="text-sm font-semibold text-foreground">收集品</p>
          <div class="flex flex-wrap gap-2">
            <ClientBadge
              v-for="item in display.collectibles"
              :key="item.id"
              variant="muted"
            >
              {{ item.name }}
            </ClientBadge>
          </div>
        </div>

        <div
          v-if="display.shareCard?.shareCode || display.shareLine"
          class="rounded-[1rem] bg-background/70 p-4"
        >
          <p class="text-xs text-muted-foreground">分享</p>
          <p v-if="display.shareCard?.shareCode" class="mt-1 font-mono text-sm text-foreground">
            {{ display.shareCard.shareCode }}
          </p>
          <p v-else-if="display.shareLine" class="mt-1 text-sm text-foreground">{{ display.shareLine }}</p>
          <ClientButton
            v-if="display.shareCard?.shareCode"
            variant="outline"
            class="mt-3 w-full"
            @click="copyShareCode()"
          >
            复制分享码
          </ClientButton>
        </div>

        <p
          v-if="missionStore.routeResultError && !display.hasRemote"
          class="text-center text-xs text-muted-foreground"
        >
          {{ missionStore.routeResultError }}（已展示本地成绩）
        </p>

        <div class="space-y-3">
          <ClientButton variant="outline" class="w-full" @click="backToArchive()">查看归档</ClientButton>
          <ClientButton class="w-full" @click="replayMission()">重新开始</ClientButton>
        </div>
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="终局数据不可用"
      :description="missionStore.routeResultError || '请先完成当前路线，再查看终局结果。'"
      action-text="返回章节地图"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>
