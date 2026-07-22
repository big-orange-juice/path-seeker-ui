<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import {
  NARRATION_AUDIO_STATUS,
  StagePlaySurface,
  type GameplayPreviewStage,
} from "@path-seeker/game-renderer"
import { useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionChapterReady } from "@/composables/useMissionChapterReady"
import { fetchNarrationDetail, type NarrationDetailResponse } from "@/services/gameplay"

const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()
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
    score: missionStore.activeSession?.totalScore ?? 0,
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

  const gate = missionStore.getChapterProgress(chapterId.value)
  if (gate.solved) {
    await router.replace(`/missions/${routeId.value}/map`)
    return
  }

  ready.value = true
  await loadDetail()
}

onMounted(() => {
  void bootstrap()
})
</script>

<template>
  <div class="narration-page">
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
.narration-page {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  /* 吃满 main 剩余高度，让底部按钮贴底 */
  height: 100%;
  min-height: 100%;
}

.narration-page :deep(.stage-play) {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  background: transparent;
}

.narration-page :deep(.narration-shell) {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}

.narration-page__skeleton {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.85rem;
  padding-top: 0.35rem;
}
</style>
