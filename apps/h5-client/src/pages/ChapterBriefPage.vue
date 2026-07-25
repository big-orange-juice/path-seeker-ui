<script setup lang="ts">
/**
 * 关卡 brief 页：1/6 直接题面，10 扫+播。
 * 题面 UI 与 B 端模拟器共用 StagePlaySurface，本页只负责会话/提交/路由。
 */
import { computed, onMounted, onUnmounted, shallowRef, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import {
  StagePlaySurface,
  type GameplayPreviewStage,
  type PuzzleAnswerDraft,
} from "@path-seeker/game-renderer"
import { createPuzzleDraft } from "@path-seeker/game-runtime"
import { useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { isPlayableMediaUrl } from "@/adapters/gameplayMissionAdapter"
import { useMissionChapterReady } from "@/composables/useMissionChapterReady"
import { useCinemaStore } from "@/stores/useCinemaStore"
import type { MissionAnswerDraft } from "@/types/mission"

const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()
const cinemaStore = useCinemaStore()
const { missionStore, ensureMissionChapter } = useMissionChapterReady()

const routeId = computed(() => String(route.params.routeId || ""))
const chapterId = computed(() => String(route.params.chapterId || ""))
const ready = shallowRef(false)
const finishing = shallowRef(false)
const draft = shallowRef<MissionAnswerDraft | null>(null)
const findPhase = shallowRef<"scan" | "video">("scan")

const chapter = computed(() => missionStore.currentChapter)
const artifact = computed(() => missionStore.currentArtifact)
const interactionType = computed(() =>
  Number(chapter.value?.interactionType ?? chapter.value?.puzzle?.interactionType ?? 0),
)

const tips = computed(() => {
  if (!artifact.value) return [] as string[]
  const fromChecklist = artifact.value.checklist.filter(Boolean).slice(0, 3)
  if (fromChecklist.length) return fromChecklist
  return [artifact.value.observationPoint, artifact.value.detailCallout].filter(Boolean) as string[]
})

const canUseHint = computed(
  () => !missionStore.currentHintText && !missionStore.gameplayPending,
)

const canSubmitPuzzle = computed(() => {
  const puzzle = missionStore.currentPuzzle
  if (!puzzle || missionStore.gameplayPending) return false
  const value = draft.value?.value
  if (puzzle.templateType === "observe_choice") {
    const options = puzzle.questionPayload?.options
    if (!options?.length) return Boolean(String(value ?? "").trim())
    return Boolean(value)
  }
  return true
})

function syncPuzzleDraft() {
  const puzzle = missionStore.currentPuzzle
  if (!puzzle || interactionType.value === 10) {
    draft.value = null
    return
  }
  draft.value = missionStore.getMissionDraft(puzzle.id) || createPuzzleDraft(puzzle)
}

const playStage = computed<GameplayPreviewStage | null>(() => {
  const current = chapter.value
  if (!current) return null

  const puzzle = missionStore.currentPuzzle
  const config: Record<string, unknown> = {
    content: puzzle?.prompt || puzzle?.questionPayload?.prompt || current.objective || "",
    prompt: puzzle?.prompt || "",
    clue_text: current.objective || puzzle?.introText || "",
    location: current.targetLocation || artifact.value?.location || "",
    // 与 PC 模拟器一致：仅使用节点/展品真实视频，无则留空（FindScan 展示「暂无短片」）
    video_url: isPlayableMediaUrl(current.videoUrl) ? String(current.videoUrl).trim() : "",
  }

  if (puzzle?.templateType === "observe_choice") {
    const payload = puzzle.questionPayload
    config.options = payload.options
    config.correct_option_id = payload.correctOptionId
    config.content = payload.prompt || puzzle.prompt
  }
  if (puzzle?.templateType === "image_puzzle") {
    const payload = puzzle.questionPayload
    config.content = payload.prompt || puzzle.prompt
    config.base_image_url = payload.imageUrl
    config.image_url = payload.imageUrl
    config.grid_rows = payload.gridRows
    config.grid_cols = payload.gridCols
    config.pieces = payload.pieces
    config.correct_order = payload.correctOrder
  }
  if (puzzle?.hintPayload) {
    config.hints = [
      puzzle.hintPayload.observe && { content: puzzle.hintPayload.observe },
      puzzle.hintPayload.relation && { content: puzzle.hintPayload.relation },
      puzzle.hintPayload.direct && { content: puzzle.hintPayload.direct },
    ].filter(Boolean)
  }

  return {
    stageId: current.id,
    interactionType: current.interactionType,
    title: current.title,
    exhibitName: artifact.value?.title || current.title,
    galleryName: current.targetLocation || artifact.value?.location || "",
    config,
  }
})

async function bootstrap() {
  ready.value = false
  const ok = await ensureMissionChapter(routeId.value, chapterId.value)
  if (!ok) {
    ready.value = true
    return
  }

  if (interactionType.value === 11) {
    await router.replace(`/missions/${routeId.value}/chapters/${chapterId.value}/narration`)
    return
  }

  // 已完成节点允许重复游玩：不再因 solved 踢回路线页
  const gate = missionStore.getChapterProgress(chapterId.value)
  const alreadySolved = gate.solved || missionStore.currentChapterSolved

  if (interactionType.value === 1 || interactionType.value === 6) {
    syncPuzzleDraft()
    ready.value = true
    return
  }

  if (interactionType.value !== 10) {
    toastStore.warning("暂不支持的节点", "该路线节点不属于当前正式玩法范围。")
    await router.replace(`/missions/${routeId.value}/map`)
    return
  }

  // 重玩时从扫码阶段重开；未完成则沿用本地闸门相位
  if (alreadySolved) {
    findPhase.value = "scan"
  } else if (gate.videoWatched && !gate.solved) {
    findPhase.value = "video"
  } else if (gate.recognized) {
    findPhase.value = "video"
  } else {
    findPhase.value = "scan"
  }
  ready.value = true
}

function handleFindPhase(phase: "scan" | "video") {
  findPhase.value = phase
  if (phase === "video") {
    missionStore.markChapterRecognized(chapterId.value)
    cinemaStore.setVideoPlaying(true)
    return
  }
  cinemaStore.setVideoPlaying(false)
}

async function forceSkipStage() {
  if (missionStore.gameplayPending || finishing.value) return
  finishing.value = true
  cinemaStore.setVideoPlaying(false)
  try {
    const result = await missionStore.forceSkipCurrentStage()
    if (!result.isCorrect) {
      toastStore.warning("跳过失败", result.message || "请稍后重试")
      finishing.value = false
      return
    }
    toastStore.info("已跳过本站", "进度已更新。")
    await router.push(`/missions/${routeId.value}/chapters/${chapterId.value}/result`)
  } catch (error) {
    toastStore.warning("跳过失败", error instanceof Error ? error.message : "请稍后重试")
    finishing.value = false
  }
}

async function completeFind(options: { skipped?: boolean } = {}) {
  if (finishing.value) return
  finishing.value = true
  cinemaStore.setVideoPlaying(false)
  missionStore.markChapterVideoWatched(chapterId.value)

  const result = options.skipped
    ? await missionStore.forceSkipCurrentStage()
    : await missionStore.completeFindScanStage({ skipped: false })

  if (!result.isCorrect) {
    finishing.value = false
    toastStore.warning("提交失败", result.message || "请稍后重试")
    return
  }
  if (options.skipped) toastStore.info("已跳过本站", "进度已更新。")
  // 末站也不自动进终局，统一走本站结果再回选站
  await router.push(`/missions/${routeId.value}/chapters/${chapterId.value}/result`)
}

async function useHint() {
  const nextLevel = await missionStore.requestHint()
  if (!nextLevel) {
    toastStore.warning("当前没有更多提示", missionStore.gameplayError || "先自己再观察一轮。")
    return
  }
  toastStore.info("已解锁提示", missionStore.currentHintText || "新提示已加入。")
}

async function submitAnswer() {
  if (!draft.value) return
  const result = await missionStore.submitCurrentDraft(draft.value)
  if (!result.isCorrect) {
    toastStore.warning("再想想", result.message || "答案还差一点。")
    return
  }
  toastStore.success(
    result.snapshot?.finalChapter ? "本路线已完成" : "章节解锁成功",
    result.message || "可以继续探索。",
  )
  // 末站也不自动进终局，统一走本站结果再回选站
  await router.push(`/missions/${routeId.value}/chapters/${chapterId.value}/result`)
}

function handleDraftUpdate(value: PuzzleAnswerDraft | null) {
  draft.value = value as MissionAnswerDraft | null
}

watch(
  () => missionStore.currentPuzzle?.id,
  () => {
    if (interactionType.value === 1 || interactionType.value === 6) syncPuzzleDraft()
  },
)

onMounted(() => {
  void bootstrap()
})

onUnmounted(() => {
  cinemaStore.setVideoPlaying(false)
})
</script>

<template>
  <div class="space-y-4">
    <template v-if="ready && chapter && playStage">
      <StagePlaySurface
        :stage="playStage"
        :puzzle="missionStore.currentPuzzle"
        :model-value="draft"
        :stage-no="chapter.stageNo"
        :tips="tips"
        :initial-find-phase="findPhase"
        :can-submit="false"
        @update:model-value="handleDraftUpdate"
        @update:find-phase="handleFindPhase"
        @complete-find="completeFind()"
        @skip-find="completeFind({ skipped: true })">
        <template #actions>
          <template v-if="interactionType === 1 || interactionType === 6">
            <div v-if="missionStore.currentChapterSolved" class="rounded-[1rem] bg-background/70 p-4">
              <p class="text-sm font-semibold text-foreground">此站已完成，可再玩一次</p>
              <p class="mt-2 text-sm leading-6 text-muted-foreground">重新作答或返回路线继续其他站点。</p>
            </div>

            <div v-if="missionStore.currentHintText" class="rounded-[1rem] bg-primary/10 p-4">
              <p class="text-sm font-semibold text-foreground">提示</p>
              <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ missionStore.currentHintText }}</p>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <ClientButton variant="outline" class="w-full" :disabled="!canUseHint" @click="useHint()">
                {{ missionStore.currentHintText ? "已用提示" : "提示" }}
              </ClientButton>
              <ClientButton class="w-full" :disabled="!canSubmitPuzzle" @click="submitAnswer()">
                {{ missionStore.gameplayPending ? "提交中..." : "提交" }}
              </ClientButton>
            </div>

            <ClientButton
              variant="outline"
              class="w-full"
              :disabled="missionStore.gameplayPending"
              @click="forceSkipStage()">
              {{ missionStore.gameplayPending ? "处理中…" : "跳过本站" }}
            </ClientButton>
            <ClientButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">
              返回路线
            </ClientButton>
            <p v-if="missionStore.gameplayError" class="text-sm leading-6 text-destructive">
              {{ missionStore.gameplayError }}
            </p>
          </template>

          <template v-else-if="interactionType === 10">
            <ClientButton
              variant="outline"
              class="w-full"
              :disabled="missionStore.gameplayPending || finishing"
              @click="forceSkipStage()">
              {{ missionStore.gameplayPending || finishing ? "处理中…" : "跳过本站" }}
            </ClientButton>
            <ClientButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">
              返回路线
            </ClientButton>
          </template>
        </template>
      </StagePlaySurface>
    </template>

    <div v-else-if="!ready || missionStore.gameplayPending || missionStore.detailPending" class="space-y-4 pt-1">
      <ClientSkeleton class="h-6 w-28" />
      <ClientSkeleton class="h-10 w-2/3" />
      <ClientSkeleton class="h-20 w-full" />
      <ClientSkeleton class="h-64 w-full" />
      <ClientSkeleton class="h-10 w-full" />
    </div>

    <ClientEmptyState
      v-else
      title="这一站暂时打不开"
      :description="missionStore.gameplayError || missionStore.detailError || '请回到路线重新进入。'"
      action-text="返回路线"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>
