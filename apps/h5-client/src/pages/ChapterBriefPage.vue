<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { FindScanRenderer, PuzzleRendererHost } from "@path-seeker/game-renderer"
import { createPuzzleDraft } from "@path-seeker/game-runtime"
import { useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { isPlayableMediaUrl, isPrimaryPuzzleTemplate } from "@/adapters/gameplayMissionAdapter"
import { useMissionChapterReady } from "@/composables/useMissionChapterReady"
import { useCinemaStore } from "@/stores/useCinemaStore"
import { getPuzzleTypeLabel } from "@/utils/puzzleLabels"
import type { MissionAnswerDraft } from "@/types/mission"
import defaultMovieUrl from "@/assets/styles/movie.mp4"

type StagePhase = "locate" | "video" | "puzzle"

const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()
const cinemaStore = useCinemaStore()
const { missionStore, ensureMissionChapter } = useMissionChapterReady()

const routeId = computed(() => String(route.params.routeId || ""))
const chapterId = computed(() => String(route.params.chapterId || ""))
const ready = shallowRef(false)
const phase = shallowRef<StagePhase>("locate")

// —— 扫一扫 ——
const scanning = shallowRef(false)
const locked = shallowRef(false)
const previewUrl = shallowRef<string | null>(null)
const scanStatus = shallowRef<"idle" | "scanning" | "success" | "failed">("idle")

// —— 短片 ——
const finishingVideo = shallowRef(false)
const progressPct = shallowRef(0)
const statusText = shallowRef("即将播放")
const videoRef = useTemplateRef<HTMLVideoElement>("videoEl")

// —— 闯关 ——
const draft = shallowRef<MissionAnswerDraft | null>(null)

const chapter = computed(() => missionStore.currentChapter)
const artifact = computed(() => missionStore.currentArtifact)
const interactionType = computed(() =>
  Number(chapter.value?.interactionType ?? chapter.value?.puzzle?.interactionType ?? 0),
)

const riddle = computed(() => {
  return (
    chapter.value?.objective
    || artifact.value?.detailCallout
    || "到展柜前仔细观察，再继续下一步。"
  )
})

const place = computed(() => {
  return chapter.value?.targetLocation || artifact.value?.location || ""
})

const tips = computed(() => {
  if (!artifact.value) {
    return [] as string[]
  }

  const fromChecklist = artifact.value.checklist.filter(Boolean).slice(0, 3)
  if (fromChecklist.length) {
    return fromChecklist
  }

  return [artifact.value.observationPoint, artifact.value.detailCallout].filter(Boolean) as string[]
})

const exhibitLabel = computed(() => artifact.value?.title || chapter.value?.title || "展品")
const placeLabel = computed(() => place.value)
const clueText = computed(() => chapter.value?.objective || chapter.value?.puzzle?.introText || riddle.value)

const videoSrc = computed(() => {
  const remote = chapter.value?.videoUrl
  return isPlayableMediaUrl(remote) ? String(remote).trim() : defaultMovieUrl
})
const usingDefaultVideo = computed(() => videoSrc.value === defaultMovieUrl)

const puzzleLabel = computed(() => {
  if (!missionStore.currentPuzzle) {
    return ""
  }
  return getPuzzleTypeLabel(
    missionStore.currentPuzzle.templateType,
    missionStore.currentPuzzle.interactionType,
  )
})

const isPrimaryTemplate = computed(() => {
  const puzzle = missionStore.currentPuzzle
  return puzzle ? isPrimaryPuzzleTemplate(puzzle.templateType) : false
})

const canUseHint = computed(
  () => !missionStore.currentChapterSolved && !missionStore.currentHintText && !missionStore.gameplayPending,
)

const canSubmit = computed(() => {
  const puzzle = missionStore.currentPuzzle
  if (!puzzle || missionStore.currentChapterSolved || missionStore.gameplayPending) {
    return false
  }

  const value = draft.value?.value

  if (puzzle.templateType === "observe_choice") {
    // 有选项：选中 id；无选项：自由文本
    const options = puzzle.questionPayload?.options
    if (!options?.length) {
      return Boolean(String(value ?? "").trim())
    }
    return Boolean(value)
  }

  if (puzzle.templateType === "story_branch") {
    return Boolean(value)
  }

  if (puzzle.templateType === "select") {
    return Array.isArray(value) && value.length > 0
  }

  if (puzzle.templateType === "code_break") {
    return Boolean(String(value ?? "").trim())
  }

  return true
})

const phaseKicker = computed(() => {
  if (phase.value === "locate") {
    return "线索 · 找一找"
  }
  if (phase.value === "video") {
    return "观展短片"
  }
  return "闯关"
})

function resolvePhaseFromGate(): StagePhase {
  const gate = missionStore.getChapterProgress(chapterId.value)
  if (!gate.recognized) {
    return "locate"
  }
  if (!gate.videoWatched) {
    return "video"
  }
  return "puzzle"
}

function syncPuzzleDraft() {
  const puzzle = missionStore.currentPuzzle
  if (!puzzle || interactionType.value === 10) {
    draft.value = null
    return
  }
  draft.value = missionStore.getMissionDraft(puzzle.id) || createPuzzleDraft(puzzle)
}

async function enterPhase(next: StagePhase) {
  phase.value = next
  if (next === "video") {
    finishingVideo.value = false
    progressPct.value = 0
    statusText.value = "即将播放"
    await nextTick()
    await tryAutoplay()
  }
  if (next === "puzzle") {
    cinemaStore.setVideoPlaying(false)
    videoRef.value?.pause()
    syncPuzzleDraft()
  }
}

async function bootstrap() {
  ready.value = false
  const ok = await ensureMissionChapter(routeId.value, chapterId.value)
  if (!ok) {
    ready.value = true
    return
  }

  // 11 解说：独立页（听讲 + 可选语音）
  if (interactionType.value === 11) {
    await router.replace(`/missions/${routeId.value}/chapters/${chapterId.value}/narration`)
    return
  }

  const gate = missionStore.getChapterProgress(chapterId.value)
  if (gate.solved || missionStore.currentChapterSolved) {
    await router.replace(`/missions/${routeId.value}/map`)
    return
  }

  // type 10 播片已完成但未落库：回到 map，避免卡在闯关
  if (interactionType.value === 10 && gate.videoWatched) {
    await router.replace(`/missions/${routeId.value}/map`)
    return
  }

  ready.value = true
  await enterPhase(resolvePhaseFromGate())
}

/** 扫一扫成功 → 同页进入短片 */
async function advanceFromScan() {
  missionStore.markChapterRecognized(chapterId.value)
  locked.value = true
  scanStatus.value = "success"
  await enterPhase("video")
}

async function skipRecognition() {
  if (scanning.value || locked.value) {
    return
  }
  toastStore.info("已跳过识别", "识别接口待定，先进入观展短片。")
  await advanceFromScan()
}

async function tryLocalPreview(file: File | null) {
  if (!file || scanning.value || locked.value) {
    return
  }

  scanning.value = true
  scanStatus.value = "scanning"
  previewUrl.value = URL.createObjectURL(file)
  await new Promise((resolve) => window.setTimeout(resolve, 900))
  scanning.value = false
  scanStatus.value = "success"
  toastStore.info("已选择照片", "识别接口待定，将跳过识别进入短片。")
  await advanceFromScan()
}

function unlockVideo() {
  missionStore.markChapterVideoWatched(chapterId.value)
}

async function afterVideo() {
  if (finishingVideo.value) {
    return
  }
  finishingVideo.value = true
  cinemaStore.setVideoPlaying(false)
  unlockVideo()

  // type 10：扫一扫 + 播片即本站完成
  if (interactionType.value === 10) {
    const result = await missionStore.completeFindScanStage()
    if (!result.isCorrect) {
      finishingVideo.value = false
      toastStore.warning("提交失败", result.message || "请稍后重试")
      return
    }
    await router.push(`/missions/${routeId.value}/chapters/${chapterId.value}/result`)
    return
  }

  // 1~9：同页进入闯关
  await enterPhase("puzzle")
  finishingVideo.value = false
}

async function skipVideo() {
  toastStore.info("已跳过短片", "可继续当前站点流程。")
  await afterVideo()
}

async function tryAutoplay() {
  const video = videoRef.value
  if (!video) {
    return
  }

  try {
    video.muted = false
    await video.play()
    statusText.value = "播放中"
    cinemaStore.setVideoPlaying(true)
    return
  } catch {
    /* fallthrough */
  }

  try {
    video.muted = true
    await video.play()
    statusText.value = "播放中 · 轻触开声"
    cinemaStore.setVideoPlaying(true)
  } catch {
    statusText.value = "轻触播放"
    cinemaStore.setVideoPlaying(false)
  }
}

function onTimeUpdate() {
  const video = videoRef.value
  if (!video?.duration) {
    return
  }
  const pct = (video.currentTime / video.duration) * 100
  progressPct.value = pct
  if (pct >= 55) {
    unlockVideo()
    statusText.value = interactionType.value === 10 ? "可以完成了" : "可以闯关了"
  }
}

async function onEnded() {
  unlockVideo()
  statusText.value = "看完了"
  await afterVideo()
}

function onPlayClick() {
  const video = videoRef.value
  if (!video) {
    return
  }
  video.muted = false
  void video.play().then(() => {
    statusText.value = "播放中"
    cinemaStore.setVideoPlaying(true)
  }).catch(() => {
    toastStore.warning("无法自动播放", "请点一下画面再试。")
  })
}

function togglePlay() {
  const video = videoRef.value
  if (!video) {
    return
  }
  if (video.paused) {
    video.muted = false
    void video.play()
    statusText.value = "播放中"
    cinemaStore.setVideoPlaying(true)
  } else {
    video.pause()
    statusText.value = "已暂停"
    cinemaStore.setVideoPlaying(false)
  }
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
  if (!draft.value || missionStore.currentChapterSolved) {
    return
  }

  const result = await missionStore.submitCurrentDraft(draft.value)

  if (!result.isCorrect) {
    toastStore.warning("再想想", result.message || "答案还差一点。")
    return
  }

  toastStore.success(
    result.snapshot?.finalChapter ? "本路线已完成" : "章节解锁成功",
    result.message || "可以继续探索。",
  )

  if (result.snapshot?.finalChapter) {
    await router.push(`/missions/${routeId.value}/finale`)
    return
  }

  await router.push(`/missions/${routeId.value}/chapters/${chapterId.value}/result`)
}

watch(
  () => missionStore.currentPuzzle?.id,
  () => {
    if (phase.value === "puzzle") {
      syncPuzzleDraft()
    }
  },
)

onMounted(() => {
  void bootstrap()
})

onUnmounted(() => {
  cinemaStore.setVideoPlaying(false)
  videoRef.value?.pause()
})
</script>

<template>
  <div class="space-y-4">
    <template v-if="ready && chapter">
      <!-- 线索 + 扫一扫 -->
      <ClientCard v-if="phase === 'locate'" class="overflow-hidden">
        <div class="space-y-5 p-5">
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              第 {{ chapter.stageNo }} 站 · {{ phaseKicker }}
            </p>
            <h2 class="font-display text-3xl leading-tight text-foreground">{{ chapter.title }}</h2>
            <p class="client-page-copy">{{ riddle }}</p>
          </div>

          <div v-if="place" class="flex items-start gap-3 rounded-[1rem] bg-background/70 p-4">
            <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
            <div class="min-w-0">
              <p class="text-xs text-muted-foreground">位置</p>
              <p class="mt-1 text-sm font-medium text-foreground">{{ place }}</p>
            </div>
          </div>

          <div v-if="tips.length" class="space-y-3">
            <p class="text-sm font-semibold text-foreground">观察提示</p>
            <div
              v-for="(tip, index) in tips"
              :key="`${index}-${tip}`"
              class="flex gap-3 rounded-[1rem] bg-background/70 p-4 text-sm leading-6 text-muted-foreground"
            >
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {{ index + 1 }}
              </span>
              <p>{{ tip }}</p>
            </div>
          </div>

          <div class="space-y-3">
            <p class="text-sm font-semibold text-foreground">找一找</p>
            <div class="overflow-hidden rounded-[1rem] border border-border/50 bg-[#0c0d10] p-3">
              <FindScanRenderer
                :title="exhibitLabel"
                :location="placeLabel"
                :clue-text="clueText"
                :preview-url="previewUrl"
                :status="scanStatus"
                :disabled="scanning || locked"
                allow-skip
                @skip="skipRecognition"
                @file-selected="tryLocalPreview"
              />
            </div>
          </div>

          <ClientButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">
            返回路线
          </ClientButton>
        </div>
      </ClientCard>

      <!-- 观展短片 -->
      <div v-else-if="phase === 'video'" class="film-stage-shell space-y-4">
        <div class="flex items-start justify-between gap-3 px-1">
          <div class="min-w-0 space-y-1">
            <p class="client-top-kicker">第 {{ chapter.stageNo }} 站 · {{ phaseKicker }}</p>
            <h2 class="font-display text-2xl leading-tight text-foreground">{{ chapter.title }}</h2>
          </div>
          <ClientButton variant="outline" class="shrink-0" @click="skipVideo()">跳过</ClientButton>
        </div>

        <div class="film-soft-edge relative overflow-hidden">
          <video
            ref="videoEl"
            class="aspect-video w-full object-cover"
            playsinline
            preload="auto"
            :src="videoSrc"
            @timeupdate="onTimeUpdate"
            @ended="onEnded"
            @click="togglePlay"
          />
          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/10">
            <div class="h-full bg-primary transition-[width]" :style="{ width: `${progressPct}%` }" />
          </div>
        </div>

        <p class="text-center text-sm text-muted-foreground">{{ statusText }}</p>

        <div class="grid gap-3">
          <ClientButton class="w-full" @click="onPlayClick()">播放</ClientButton>
          <ClientButton variant="outline" class="w-full" @click="skipVideo()">
            {{ interactionType === 10 ? "跳过短片，完成本站" : "跳过短片，去闯关" }}
          </ClientButton>
          <ClientButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">
            返回路线
          </ClientButton>
        </div>

        <p class="text-center text-xs text-muted-foreground">
          {{
            usingDefaultVideo
              ? "暂无展品短视频，使用默认片；可跳过"
              : "正在播放本站关联短视频；可跳过"
          }}
        </p>
      </div>

      <!-- 闯关（1~9） -->
      <ClientCard v-else-if="phase === 'puzzle' && missionStore.currentPuzzle" class="overflow-hidden">
        <div class="space-y-5 p-5">
          <div class="flex items-center justify-between gap-3">
            <span v-if="puzzleLabel" class="client-tag is-gold">
              {{ puzzleLabel }}
            </span>
            <span class="text-sm text-muted-foreground">
              {{ missionStore.activeSession?.totalScore ?? 0 }} 分
            </span>
          </div>

          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              第 {{ chapter.stageNo }} 站 · {{ phaseKicker }}
            </p>
            <h2 class="font-display text-2xl leading-tight text-foreground">
              {{ missionStore.currentPuzzle.prompt || missionStore.currentPuzzle.title }}
            </h2>
            <p v-if="!isPrimaryTemplate" class="text-xs text-muted-foreground">
              本站为扩展题型，主路径为选择与拼图
            </p>
          </div>

          <div class="rounded-[1rem] bg-background/70 p-4">
            <!-- h5 作答：不传 previewMode / readonlyMode，保持可交互 -->
            <PuzzleRendererHost
              v-if="draft"
              :puzzle="missionStore.currentPuzzle"
              :model-value="draft"
              :readonly-mode="false"
              :preview-mode="false"
              @update:model-value="draft = $event"
            />
          </div>

          <div v-if="missionStore.currentChapterSolved" class="rounded-[1rem] bg-background/70 p-4">
            <p class="text-sm font-semibold text-foreground">此章节已完成</p>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">可返回路线或查看本站结果。</p>
          </div>

          <div v-if="missionStore.currentHintText" class="rounded-[1rem] bg-primary/10 p-4">
            <p class="text-sm font-semibold text-foreground">提示</p>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ missionStore.currentHintText }}</p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <ClientButton variant="outline" class="w-full" :disabled="!canUseHint" @click="useHint()">
              {{ missionStore.currentHintText ? "已用提示" : "提示" }}
            </ClientButton>
            <ClientButton class="w-full" :disabled="!canSubmit" @click="submitAnswer()">
              {{ missionStore.currentChapterSolved ? "已通过" : missionStore.gameplayPending ? "提交中..." : "提交" }}
            </ClientButton>
          </div>

          <ClientButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">
            返回路线
          </ClientButton>

          <p v-if="missionStore.gameplayError" class="text-sm leading-6 text-destructive">
            {{ missionStore.gameplayError }}
          </p>
        </div>
      </ClientCard>

      <ClientEmptyState
        v-else
        title="当前阶段不可用"
        description="请回到路线重新进入本站。"
        action-text="返回路线"
        @action="router.push(`/missions/${routeId}/map`)"
      />
    </template>

    <ClientCard v-else-if="!ready || missionStore.gameplayPending || missionStore.detailPending">
      <div class="space-y-4 p-5">
        <ClientSkeleton class="h-6 w-28" />
        <ClientSkeleton class="h-10 w-2/3" />
        <ClientSkeleton class="h-20 w-full" />
        <ClientSkeleton class="h-64 w-full" />
        <ClientSkeleton class="h-10 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="这一站暂时打不开"
      :description="missionStore.gameplayError || missionStore.detailError || '请回到路线重新进入。'"
      action-text="返回路线"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>

<style scoped>
.film-soft-edge {
  border-radius: 1.25rem;
  border: 1px solid rgba(209, 178, 111, 0.22);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35),
    0 24px 60px rgba(0, 0, 0, 0.45),
    inset 0 0 40px rgba(209, 178, 111, 0.06);
  background: rgba(0, 0, 0, 0.45);
}

.film-soft-edge video {
  display: block;
}
</style>
