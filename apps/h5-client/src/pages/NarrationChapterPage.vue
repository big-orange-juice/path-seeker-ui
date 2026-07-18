<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import {
  NARRATION_AUDIO_STATUS,
  NarrationRenderer,
} from "@path-seeker/game-renderer"
import { useToastStore } from "@path-seeker/client-state"
import { ClientButton, ClientCard, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { useMissionChapterReady } from "@/composables/useMissionChapterReady"
import {
  fetchNarrationDetail,
  generateNarrationAudio,
  type NarrationDetailResponse,
} from "@/services/gameplay"

const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()
const { missionStore, ensureMissionChapter } = useMissionChapterReady()

const routeId = computed(() => String(route.params.routeId || ""))
const chapterId = computed(() => String(route.params.chapterId || ""))
const ready = shallowRef(false)
const loading = shallowRef(false)
const generatingAudio = shallowRef(false)
const finishing = shallowRef(false)
const detail = shallowRef<NarrationDetailResponse | null>(null)
const loadError = shallowRef("")

let audioPollTimer: ReturnType<typeof setTimeout> | null = null

const chapter = computed(() => missionStore.currentChapter)
const interactionType = computed(() =>
  Number(chapter.value?.interactionType ?? chapter.value?.puzzle?.interactionType ?? 0),
)

const narrationText = computed(() => String(detail.value?.narrationText || "").trim())
const audioUrl = computed(() => String(detail.value?.audioUrl || "").trim())
const audioStatus = computed(() => {
  const status = detail.value?.audioStatus
  return typeof status === "number" && Number.isFinite(status) ? status : NARRATION_AUDIO_STATUS.NotGenerated
})

const audioBusy = computed(() => {
  if (generatingAudio.value) {
    return true
  }

  return (
    audioStatus.value === NARRATION_AUDIO_STATUS.Queued
    || audioStatus.value === NARRATION_AUDIO_STATUS.Generating
  )
})

const guideLabel = computed(() => {
  const name = String(detail.value?.guideName || "").trim()
  if (name) {
    return name
  }

  const id = String(detail.value?.guideId || "").trim()
  return id ? `讲解 ${id}` : ""
})

function clearAudioPoll() {
  if (audioPollTimer) {
    clearTimeout(audioPollTimer)
    audioPollTimer = null
  }
}

function isAudioStillGenerating(item: NarrationDetailResponse | null) {
  if (!item) {
    return false
  }

  // 重新生成时旧 audioUrl 可能仍在，以 status 为准
  const status = Number(item.audioStatus ?? 0)
  return status === NARRATION_AUDIO_STATUS.Queued || status === NARRATION_AUDIO_STATUS.Generating
}

async function loadDetail(silent = false) {
  const stageId = chapterId.value
  if (!stageId) {
    return null
  }

  if (!silent) {
    loading.value = true
    loadError.value = ""
  }

  try {
    const next = await fetchNarrationDetail(stageId)
    detail.value = next

    if (!isAudioStillGenerating(next)) {
      generatingAudio.value = false
      clearAudioPoll()
    }

    return next
  } catch (error) {
    if (!silent) {
      loadError.value = error instanceof Error ? error.message : "解说加载失败"
      detail.value = null
    }

    generatingAudio.value = false
    clearAudioPoll()
    return null
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

function pollAudio(attempt = 0) {
  clearAudioPoll()
  if (attempt >= 20) {
    generatingAudio.value = false
    return
  }

  audioPollTimer = setTimeout(async () => {
    audioPollTimer = null
    const next = await loadDetail(true)
    if (isAudioStillGenerating(next)) {
      pollAudio(attempt + 1)
      return
    }

    generatingAudio.value = false
    if (String(next?.audioUrl || "").trim()) {
      toastStore.info("语音已就绪", "可点击播放试听。")
    }
  }, 2000)
}

async function handleGenerateAudio() {
  if (!chapterId.value || audioBusy.value || !narrationText.value || finishing.value) {
    return
  }

  generatingAudio.value = true
  try {
    await generateNarrationAudio(chapterId.value)
    const next = await loadDetail(true)
    if (isAudioStillGenerating(next)) {
      pollAudio()
      return
    }
    // 已就绪或仍有旧链但状态已结束：再拉一次确保 URL 更新
    generatingAudio.value = false
    if (String(next?.audioUrl || "").trim()) {
      toastStore.info("语音已更新", "可点击播放试听。")
    }
  } catch (error) {
    generatingAudio.value = false
    toastStore.warning("语音生成失败", error instanceof Error ? error.message : "请稍后重试")
  }
}

/**
 * 完成本站解说。
 * 有无音频均可：跳过收听 / 跳过生成，直接提交进度。
 */
async function completeNarration(options: { skipped?: boolean } = {}) {
  if (finishing.value || !missionStore.activeSession || !chapter.value) {
    return
  }

  finishing.value = true
  clearAudioPoll()
  generatingAudio.value = false

  try {
    const result = await missionStore.completeNarrationStage({
      skipped: Boolean(options.skipped),
    })
    if (!result.isCorrect) {
      toastStore.warning("提交失败", result.message || "请稍后重试")
      return
    }

    if (options.skipped) {
      toastStore.info("已跳过解说", "本站已记为完成。")
    }

    await router.push(`/missions/${routeId.value}/chapters/${chapterId.value}/result`)
  } catch (error) {
    toastStore.warning("提交失败", error instanceof Error ? error.message : "请稍后重试")
  } finally {
    finishing.value = false
  }
}

async function skipNarration() {
  await completeNarration({ skipped: true })
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

onBeforeUnmount(() => {
  clearAudioPoll()
})
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="ready && chapter"
      class="space-y-4 rounded-xl border border-border/40 bg-[#0c0d10] px-4 py-4">
      <p class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        第 {{ chapter.stageNo }} 站 · 解说导览
      </p>

      <NarrationRenderer
        mode="play"
        :title="chapter.artifact?.title || chapter.title"
        :exhibit-name="chapter.artifact?.title || chapter.title"
        :guide-name="guideLabel"
        :narration-text="narrationText"
        :audio-url="audioUrl"
        :audio-status="audioStatus"
        :duration-ms="detail?.durationMs"
        :status="loading ? 'loading' : loadError ? 'error' : 'ready'"
        :error-message="loadError"
        :generating-audio="generatingAudio"
        :completing="finishing"
        :show-play-actions="true"
        @generate-audio="handleGenerateAudio"
        @complete="completeNarration()"
        @skip="skipNarration">
        <template #footer>
          <ClientButton
            variant="outline"
            class="w-full"
            :disabled="finishing"
            @click="router.push(`/missions/${routeId}/map`)">
            返回路线
          </ClientButton>
        </template>
      </NarrationRenderer>
    </div>

    <ClientCard v-else-if="!ready || missionStore.gameplayPending || missionStore.detailPending">
      <div class="space-y-4 p-5">
        <ClientSkeleton class="h-6 w-24" />
        <ClientSkeleton class="h-10 w-2/3" />
        <ClientSkeleton class="h-40 w-full" />
      </div>
    </ClientCard>

    <ClientEmptyState
      v-else
      title="当前站点不可用"
      :description="missionStore.gameplayError || missionStore.detailError || '请回到路线重新进入。'"
      action-text="返回路线"
      @action="router.push(`/missions/${routeId}/map`)"
    />
  </div>
</template>
