<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import { MessageCircle } from "lucide-vue-next"
import {
  NARRATION_AUDIO_STATUS,
  StagePlaySurface,
  type GameplayPreviewStage,
} from "@path-seeker/game-renderer"
import { useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionChapterReady } from "@/composables/useMissionChapterReady"
import { fetchNarrationDetail, type NarrationDetailResponse } from "@/services/gameplay"
import { useAskStore } from "@/stores/useAskStore"

const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()
const askStore = useAskStore()
const { missionStore, ensureMissionChapter } = useMissionChapterReady()

const routeId = computed(() => String(route.params.routeId || ""))
const chapterId = computed(() => String(route.params.chapterId || ""))
const ready = shallowRef(false)
const loading = shallowRef(false)
const finishing = shallowRef(false)
const detail = shallowRef<NarrationDetailResponse | null>(null)
const loadError = shallowRef("")

const chapter = computed(() => missionStore.currentChapter)
const interactionType = computed(() =>
  Number(chapter.value?.interactionType ?? chapter.value?.puzzle?.interactionType ?? 0),
)

async function loadDetail() {
  const stageId = chapterId.value
  if (!stageId) return null
  loading.value = true
  loadError.value = ""
  try {
    const next = await fetchNarrationDetail(stageId)
    detail.value = next
    return next
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "解说加载失败"
    detail.value = null
    return null
  } finally {
    loading.value = false
  }
}

const playStage = computed<GameplayPreviewStage | null>(() => {
  const current = chapter.value
  if (!current) return null
  const guideName = String(detail.value?.guideName || "").trim()
  const guideId = String(detail.value?.guideId || "").trim()
  // 配图只来自 c_detail.images，不读 node.config 的 user_style_input / scene_context
  const images = [...(detail.value?.images || [])]
    .map((item) => ({
      id: item.id != null ? String(item.id) : null,
      imageUrl: item.imageUrl != null ? String(item.imageUrl) : null,
      sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 0,
    }))
    .filter((item) => Boolean(item.imageUrl))
    .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
  return {
    stageId: current.id,
    interactionType: 11,
    title: current.artifact?.title || current.title,
    exhibitName: current.artifact?.title || current.title,

    config: {
      guide_id: guideId,
      guide_name: guideName || (guideId ? `讲解 ${guideId}` : ""),
      narration_text: String(detail.value?.narrationText || "").trim(),
      audio_url: String(detail.value?.audioUrl || "").trim(),
    },
    narration: detail.value
      ? {
          narrationText: detail.value.narrationText,
          audioUrl: detail.value.audioUrl,
          guideId: detail.value.guideId,
          guideName: detail.value.guideName,
          durationMs: detail.value.durationMs,
          audioStatus: typeof detail.value.audioStatus === "number"
            ? detail.value.audioStatus
            : NARRATION_AUDIO_STATUS.NotGenerated,
          images,
        }
      : null,
    narrationStatus: loading.value ? "loading" : loadError.value ? "error" : "ready",
    narrationErrorMessage: loadError.value,
  }
})

async function completeNarration(options: { skipped?: boolean } = {}) {
  if (finishing.value || !missionStore.activeSession || !chapter.value) return
  finishing.value = true
  try {
    const result = await missionStore.completeNarrationStage({
      skipped: Boolean(options.skipped),
    })
    if (!result.isCorrect) {
      toastStore.warning("提交失败", result.message || "请稍后重试")
      return
    }
    if (options.skipped) toastStore.info("已跳过解说", "本站已记为完成。")
    await router.push(`/missions/${routeId.value}/chapters/${chapterId.value}/result`)
  } catch (error) {
    toastStore.warning("提交失败", error instanceof Error ? error.message : "请稍后重试")
  } finally {
    finishing.value = false
  }
}

async function bootstrap() {
  ready.value = false
  const ok = await ensureMissionChapter(routeId.value, chapterId.value)
  if (!ok) {
    ready.value = true
    return
  }

  if (interactionType.value !== 11) {
    const path = missionStore.resolveEnterChapterPath(chapterId.value)
    if (path) {
      await router.replace(path)
      return
    }
  }

  // 已完成解说节点允许重复收听，不因 solved 踢回路线页
  ready.value = true
  await loadDetail()
}

function openStageAsk() {
  if (!routeId.value || !chapterId.value) return
  const mission = missionStore.activeMission
  const current = chapter.value
  askStore.openAskWithStageContext({
    routeId: routeId.value,
    stageId: chapterId.value,
    routeTitle:
      mission?.title
      || missionStore.activeSession?.routeTitle
      || "",
    stageTitle:
      current?.title
      || current?.artifact?.title
      || current?.puzzle?.title
      || "",
  })
}

onMounted(() => {
  void bootstrap()
})
</script>

<template>
  <div class="narration-page">
    <button
      v-if="ready && chapter"
      type="button"
      class="stage-ask-fab"
      title="快捷问答"
      aria-label="快捷问答"
      @click="openStageAsk()"
    >
      <MessageCircle class="h-4 w-4" />
      <span>问答</span>
    </button>

    <StagePlaySurface
      v-if="ready && chapter && playStage"
      :stage="playStage"
      :stage-no="chapter.stageNo"
      :can-submit="true"
      @complete-narration="completeNarration()"
      @skip-narration="completeNarration({ skipped: true })">
      <template #actions>
        <ClientButton
          variant="outline"
          class="w-full"
          :disabled="finishing"
          @click="router.push(`/missions/${routeId}/map`)">
          返回路线
        </ClientButton>
      </template>
    </StagePlaySurface>

    <div
      v-else-if="!ready || missionStore.gameplayPending || missionStore.detailPending"
      class="narration-page__skeleton"
    >
      <ClientSkeleton class="h-4 w-20" />
      <ClientSkeleton class="h-8 w-2/3" />
      <ClientSkeleton class="h-[236px] w-full" />
      <ClientSkeleton class="h-12 w-full rounded-full" />
    </div>

    <ClientEmptyState
      v-else
      title="当前站点不可用"
      :description="missionStore.gameplayError || missionStore.detailError || '请回到路线重新进入。'"
      action-text="返回路线"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>

<style scoped>
/* 图/文固定高，内容可超过视口；由 mission main 的 overflow-y-auto 外滚 */
.narration-page {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-height: 0;
  height: auto;
  max-height: none;
  overflow: visible;
  padding-bottom: 0.35rem;
}

.stage-ask-fab {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 12;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid rgba(209, 178, 111, 0.35);
  border-radius: 999px;
  background: rgba(18, 16, 12, 0.78);
  padding: 0.35rem 0.7rem;
  color: #efd391;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
}

.stage-ask-fab:active {
  transform: scale(0.98);
  opacity: 0.92;
}

.narration-page :deep(.stage-play) {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-height: 0;
  height: auto;
  max-height: none;
  overflow: visible;
  background: transparent;
}

.narration-page :deep(.narration-shell) {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-height: 0;
  height: auto;
  max-height: none;
  overflow: visible;
}

.narration-page__skeleton {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 0.85rem;
  padding-top: 0.35rem;
}
</style>
