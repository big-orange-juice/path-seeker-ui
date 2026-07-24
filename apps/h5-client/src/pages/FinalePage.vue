<script setup lang="ts">
import { computed, onMounted, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { ClientBadge, ClientButton, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { formatDurationSec, formatHistoryTime } from "@/adapters/gameplayMissionAdapter"
import { useMissionStore } from "@/stores/useMissionStore"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()

const routeId = computed(() => String(route.params.routeId || ""))

/** 终局仅展示 GET RouteResult，不用本地会话拼成绩 */
const result = computed(() => {
  const remote = missionStore.routeResult
  if (remote && remote.routeId === routeId.value) {
    return remote
  }
  return null
})

const durationLabel = computed(() => formatDurationSec(result.value?.durationSec))
const completedLabel = computed(() => formatHistoryTime(result.value?.completedAt))

const canShow = computed(() => Boolean(result.value))
const loading = computed(
  () => missionStore.routeResultPending && !result.value,
)

async function ensureFinaleData() {
  if (!routeId.value) {
    return
  }

  // 每次进入终局都拉最新结算，避免沿用内存旧值
  await missionStore.loadRouteResult(routeId.value)
}

async function backToHistory() {
  toastStore.info("已进入游玩历史", "完成记录已由服务端同步。")
  await router.push("/shell/archive")
}

async function replayMission() {
  const targetId = result.value?.routeId || routeId.value
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
  const code = result.value?.shareCard?.shareCode
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
  <div class="client-surface">
    <ClientSkeleton v-if="loading" class="h-72 w-full rounded-[1.5rem]" />

    <template v-else-if="canShow && result">
      <div class="client-surface-block space-y-3 text-center">
        <p
          v-if="result.rewardTitle"
          class="text-xs font-semibold uppercase tracking-[0.12em] text-primary"
        >
          {{ result.rewardTitle }}
        </p>
        <p v-else class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          通关
        </p>
        <h2 class="font-display text-3xl leading-tight text-foreground">
          {{ result.routeTitle || "探索完成" }}
        </h2>
        <p v-if="result.theme" class="client-page-copy">{{ result.theme }}</p>
        <p v-if="completedLabel" class="text-xs text-muted-foreground">
          完成于 {{ completedLabel }}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="client-stat-cell">
          <p class="text-xs text-muted-foreground">完成</p>
          <p class="mt-2 text-xl font-semibold text-foreground">
            {{ result.solvedCount }}/{{ result.puzzleCount || "—" }}
          </p>
        </div>
        <div class="client-stat-cell">
          <p class="text-xs text-muted-foreground">积分</p>
          <p class="mt-2 text-xl font-semibold text-foreground">
            {{ result.totalScore }}
          </p>
        </div>
        <div class="client-stat-cell">
          <p class="text-xs text-muted-foreground">用时</p>
          <p class="mt-2 text-xl font-semibold text-foreground">
            {{ durationLabel || "—" }}
          </p>
        </div>
        <div class="client-stat-cell">
          <p class="text-xs text-muted-foreground">线索</p>
          <p class="mt-2 text-xl font-semibold text-foreground">
            {{ result.usedClueCount }}
          </p>
        </div>
      </div>

      <div
        v-if="result.noCluePerfect"
        class="rounded-[1rem] border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm text-primary"
      >
        无线索完美通关
      </div>

      <div v-if="result.badges.length" class="client-surface-block space-y-3">
        <p class="text-sm font-semibold text-foreground">获得徽章</p>
        <div class="flex flex-wrap gap-2">
          <ClientBadge
            v-for="badge in result.badges"
            :key="badge.id"
            class="max-w-full"
          >
            {{ badge.name }}
          </ClientBadge>
        </div>
        <p
          v-for="badge in result.badges.filter((item) => item.description)"
          :key="`${badge.id}-desc`"
          class="text-xs text-muted-foreground"
        >
          {{ badge.name }}：{{ badge.description }}
        </p>
      </div>

      <div v-if="result.collectibles.length" class="client-surface-block space-y-3">
        <p class="text-sm font-semibold text-foreground">收集品</p>
        <div class="flex flex-wrap gap-2">
          <ClientBadge
            v-for="item in result.collectibles"
            :key="item.id"
            variant="muted"
          >
            {{ item.name }}
          </ClientBadge>
        </div>
      </div>

      <div
        v-if="result.shareCard?.shareCode || result.shareCard?.routeTitle"
        class="client-surface-block space-y-2"
      >
        <p class="text-xs text-muted-foreground">分享</p>
        <p v-if="result.shareCard?.shareCode" class="font-mono text-sm text-foreground">
          {{ result.shareCard.shareCode }}
        </p>
        <p v-else-if="result.shareCard?.routeTitle" class="text-sm text-foreground">
          {{ result.shareCard.routeTitle }}
        </p>
        <ClientButton
          v-if="result.shareCard?.shareCode"
          variant="outline"
          class="w-full"
          @click="copyShareCode()"
        >
          复制分享码
        </ClientButton>
      </div>

      <div class="space-y-3 pt-1">
        <ClientButton variant="outline" class="w-full" @click="backToHistory()">
          查看游玩历史
        </ClientButton>
        <ClientButton class="w-full" @click="replayMission()">重新开始</ClientButton>
      </div>
    </template>

    <ClientEmptyState
      v-else
      title="终局数据不可用"
      :description="missionStore.routeResultError || '请先完成当前路线，再查看终局结果。'"
      action-text="返回章节地图"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>
