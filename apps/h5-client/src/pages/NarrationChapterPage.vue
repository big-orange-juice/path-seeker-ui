<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import { NARRATION_AUDIO_STATUS } from "@path-seeker/game-renderer"
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
const durationLabel = computed(() => {
  const ms = detail.value?.durationMs
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) {
    return ""
  }

  const totalSec = Math.round(ms / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}″`
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

const audioActionLabel = computed(() => {
  if (generatingAudio.value || audioStatus.value === NARRATION_AUDIO_STATUS.Queued) {
    return "排队生成中…"
  }

  if (audioStatus.value === NARRATION_AUDIO_STATUS.Generating) {
    return "语音生成中…"
  }

  if (audioStatus.value === NARRATION_AUDIO_STATUS.Failed) {
    return "生成失败，重试"
  }

  if (audioStatus.value === NARRATION_AUDIO_STATUS.Stale) {
    return "重新生成语音"
  }

  return "生成语音"
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

  if (String(item.audioUrl || "").trim()) {
    return false
  }

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
  }, 2000)
}

async function handleGenerateAudio() {
  if (!chapterId.value || audioBusy.value || !narrationText.value) {
    return
  }

  generatingAudio.value = true
  try {
    await generateNarrationAudio(chapterId.value)
    await loadDetail(true)
    pollAudio()
  } catch (error) {
    generatingAudio.value = false
    toastStore.warning("语音生成失败", error instanceof Error ? error.message : "请稍后重试")
  }
}

async function completeNarration() {
  if (finishing.value || !missionStore.activeSession || !chapter.value) {
    return
  }

  finishing.value = true
  try {
    const result = await missionStore.completeNarrationStage()
    if (!result.success) {
      toastStore.warning("提交失败", result.message || "请稍后重试")
      return
    }

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

onBeforeUnmount(() => {
  clearAudioPoll()
})
</script>

<template>
  <div class="space-y-4">
    <ClientCard v-if="ready && chapter" class="overflow-hidden border-border/50 bg-[#0c0d10]">
      <div class="space-y-5 p-5">
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            第 {{ chapter.stageNo }} 站 · 解说导览
          </p>
          <h2 class="font-display text-2xl leading-tight text-foreground">
            {{ chapter.artifact?.title || chapter.title }}
          </h2>
          <p v-if="guideLabel" class="text-sm text-muted-foreground">
            {{ guideLabel }}
          </p>
        </div>

        <div class="rounded-[1.1rem] border border-primary/20 bg-black/30 p-4 space-y-3">
          <template v-if="audioUrl">
            <audio class="w-full" controls :src="audioUrl" preload="metadata" />
            <p v-if="durationLabel" class="text-xs text-muted-foreground">
              时长 {{ durationLabel }}
            </p>
            <ClientButton
              v-if="audioStatus === NARRATION_AUDIO_STATUS.Stale || audioStatus === NARRATION_AUDIO_STATUS.Failed"
              variant="outline"
              class="w-full"
              :disabled="audioBusy || !narrationText"
              @click="handleGenerateAudio">
              {{ audioActionLabel }}
            </ClientButton>
          </template>
          <template v-else>
            <div class="flex h-12 items-end justify-center gap-1 px-2" aria-hidden="true">
              <span
                v-for="bar in 16"
                :key="bar"
                class="w-1.5 rounded-full bg-primary/50"
                :style="{ height: `${30 + ((bar * 13) % 55)}%` }"
              />
            </div>
            <ClientButton
              class="w-full"
              :disabled="audioBusy || !narrationText || loading"
              @click="handleGenerateAudio">
              {{ audioActionLabel }}
            </ClientButton>
            <p class="text-xs leading-5 text-muted-foreground">
              暂无语音时点击生成；生成完成后可在线收听。
            </p>
          </template>
        </div>

        <div v-if="loading" class="space-y-2">
          <ClientSkeleton class="h-4 w-24" />
          <ClientSkeleton class="h-20 w-full" />
        </div>
        <div
          v-else-if="loadError"
          class="rounded-[1rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {{ loadError }}
        </div>
        <div
          v-else-if="narrationText"
          class="rounded-[1rem] border border-border/60 bg-background/50 px-4 py-3 text-sm leading-7 text-foreground/90 whitespace-pre-wrap">
          {{ narrationText }}
        </div>
        <p v-else class="text-sm text-muted-foreground">
          暂无解说词，请稍后重试或联系工作人员。
        </p>

        <div class="grid gap-3">
          <ClientButton class="w-full" :disabled="finishing || loading" @click="completeNarration">
            {{ finishing ? "提交中…" : "听完了，继续" }}
          </ClientButton>
          <ClientButton variant="outline" class="w-full" @click="router.push(`/missions/${routeId}/map`)">
            返回路线
          </ClientButton>
        </div>
      </div>
    </ClientCard>

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
