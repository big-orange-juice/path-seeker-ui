<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { Share2 } from "lucide-vue-next"
import { useRoute, useRouter } from "vue-router"
import { useToastStore } from "@path-seeker/client-state"
import { ClientBadge, ClientButton, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import ShareCardDialog from "@/components/finale/ShareCardDialog.vue"
import { formatDurationSec, formatHistoryTime } from "@/adapters/gameplayMissionAdapter"
import { useMissionStore } from "@/stores/useMissionStore"

const route = useRoute()
const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()
const shareCardOpen = shallowRef(false)

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
const coverImageUrl = computed(() => {
  const mission = missionStore.getMission(routeId.value)
  const card = missionStore.routeCards.find((item) => item.id === routeId.value)
  return mission?.coverImageUrl || card?.coverImageUrl || ""
})

async function ensureFinaleData() {
  if (!routeId.value) {
    return
  }

  // 每次进入终局都拉最新结算，避免沿用内存旧值
  await missionStore.loadRouteResult(routeId.value)
}

async function backToHistory() {
  await router.push("/shell/archive")
}

async function replayMission() {
  const targetId = result.value?.routeId || routeId.value
  if (!targetId) {
    return
  }

  // 再走一遍 = 重新 Join 该路线，进度从零计；无额外「特殊操作」
  missionStore.clearRouteResult()
  const nextSession = await missionStore.replayMission(targetId)
  if (!nextSession) {
    toastStore.error("无法再走一遍", missionStore.gameplayError || "请稍后重试。")
    return
  }

  toastStore.success("已从头开始", "可再走一遍这条路线。")
  await router.push(`/missions/${targetId}/map`)
}

async function openShareCard() {
  if (!result.value?.shareCard) {
    return
  }

  if (!coverImageUrl.value) {
    await missionStore.loadMissionDetail(routeId.value)
  }
  shareCardOpen.value = true
}

watch(routeId, () => void ensureFinaleData(), { immediate: true })

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
          完成
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
          <p class="text-xs text-muted-foreground">用时</p>
          <p class="mt-2 text-xl font-semibold text-foreground">
            {{ durationLabel || "—" }}
          </p>
        </div>
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
      <ClientButton v-if="result.shareCard" variant="outline" class="w-full" @click="openShareCard()">
        <Share2 :size="17" aria-hidden="true" />
        分享
      </ClientButton>

      <div class="space-y-3 pt-1">
        <ClientButton variant="outline" class="w-full" @click="backToHistory()">
          查看探索记录
        </ClientButton>
        <ClientButton class="w-full" @click="replayMission()">再走一遍</ClientButton>
      </div>

      <ShareCardDialog
        v-model:open="shareCardOpen"
        :card="result.shareCard"
        :cover-image-url="coverImageUrl"
        @exported="toastStore.success('分享卡已保存', '可发送给朋友或保存到相册。')"
        @export-error="toastStore.error('截图生成失败', '请确认图片资源可访问后重试。')"
      />
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
