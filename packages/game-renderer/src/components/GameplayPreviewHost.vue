<script setup lang="ts">
/**
 * 后台路线预览宿主。
 *
 * 1–9：adaptStageToPuzzle → PuzzleRendererHost(previewMode)，与 C 端同源题面
 * 10：FindScanRenderer 预览
 * 11：解说导览（含 B 端生成语音工具）
 */
import { computed, ref, watch } from "vue"
import {
  adaptStageToPuzzle,
  isPuzzleInteraction,
} from "../adaptStage"
import {
  getInteractionTypeMeta,
  NARRATION_AUDIO_STATUS,
  type GameplayPreviewStage,
  type PuzzleAnswerDraft,
  type PuzzleDefinition,
} from "../contracts"
import FindScanRenderer from "./renderers/FindScanRenderer.vue"
import PuzzleRendererHost from "./PuzzleRendererHost.vue"

const props = defineProps<{
  stage: GameplayPreviewStage | null
  /** 是否正在请求生成语音 */
  narrationAudioGenerating?: boolean
}>()

const emit = defineEmits<{
  "generate-audio": [stageId: string]
}>()

interface HintItem {
  hint_id?: string
  clueId?: string
  level?: number
  type?: string
  content?: string | null
  penalty_score?: number
}

const config = computed(() => props.stage?.config ?? {})
const meta = computed(
  () => getInteractionTypeMeta(props.stage?.interactionType) ?? { label: "未知玩法", className: "unknown" },
)

const interactionType = computed(() => Number(props.stage?.interactionType || 0))
const useSharedPuzzle = computed(() => isPuzzleInteraction(interactionType.value))

const adaptedPuzzle = computed<PuzzleDefinition | null>(() => {
  if (!props.stage || !useSharedPuzzle.value) {
    return null
  }

  return adaptStageToPuzzle({
    stageId: props.stage.stageId,
    title: props.stage.title,
    subtitle: props.stage.subtitle,
    interactionType: props.stage.interactionType,
    config: props.stage.config,
  })
})

const previewDraft = ref<PuzzleAnswerDraft | null>(null)

watch(
  adaptedPuzzle,
  (puzzle) => {
    previewDraft.value = puzzle
      ? { templateType: puzzle.templateType, value: null }
      : null
  },
  { immediate: true },
)

function readString(key: string) {
  const value = config.value[key]
  return typeof value === "string" ? value.trim() : ""
}

function readNumber(key: string) {
  const value = config.value[key]
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

const narrationFromApi = computed(() => props.stage?.narration ?? null)
const narrationStatus = computed(() => props.stage?.narrationStatus ?? "idle")
const narrationErrorMessage = computed(() => String(props.stage?.narrationErrorMessage || "").trim())

const narrationGuideId = computed(() => {
  const fromApi = String(narrationFromApi.value?.guideId ?? "").trim()
  if (fromApi) {
    return fromApi
  }

  const numeric = readNumber("guide_id")
  if (numeric) {
    return String(numeric)
  }

  return readString("guide_id")
})
const narrationGuideName = computed(() => String(narrationFromApi.value?.guideName ?? "").trim())
const narrationStyle = computed(
  () => String(narrationFromApi.value?.resolvedStyle ?? "").trim() || readString("user_style_input"),
)
const narrationScene = computed(() => readString("scene_context"))
const narrationDurationSec = computed(() => {
  const fromApiMs = narrationFromApi.value?.durationMs
  if (typeof fromApiMs === "number" && Number.isFinite(fromApiMs) && fromApiMs > 0) {
    return Math.round(fromApiMs / 1000)
  }

  const seconds = readNumber("target_duration_seconds")
  return seconds > 0 ? seconds : 90
})
const narrationDurationLabel = computed(() => {
  const total = narrationDurationSec.value
  const minutes = Math.floor(total / 60)
  const seconds = total % 60

  if (minutes <= 0) {
    return `约 ${seconds} 秒`
  }

  if (seconds === 0) {
    return `约 ${minutes} 分钟`
  }

  return `约 ${minutes} 分 ${seconds} 秒`
})
const narrationText = computed(
  () =>
    String(narrationFromApi.value?.narrationText ?? "").trim()
    || readString("narration_text"),
)
const narrationAudioUrl = computed(
  () =>
    String(narrationFromApi.value?.audioUrl ?? "").trim()
    || readString("audio_url"),
)
const narrationAudioStatus = computed(() => {
  const status = narrationFromApi.value?.audioStatus
  return typeof status === "number" && Number.isFinite(status) ? status : NARRATION_AUDIO_STATUS.NotGenerated
})
const narrationDurationMs = computed(() => {
  const ms = narrationFromApi.value?.durationMs
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : null
})
const narrationDurationMsLabel = computed(() => {
  if (!narrationDurationMs.value) {
    return ""
  }

  const totalSec = Math.round(narrationDurationMs.value / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}″`
})
const hasNarrationAudio = computed(() => Boolean(narrationAudioUrl.value))
const narrationAudioBusy = computed(() => {
  if (props.narrationAudioGenerating) {
    return true
  }

  return (
    narrationAudioStatus.value === NARRATION_AUDIO_STATUS.Queued
    || narrationAudioStatus.value === NARRATION_AUDIO_STATUS.Generating
  )
})
const narrationAudioActionLabel = computed(() => {
  if (props.narrationAudioGenerating || narrationAudioStatus.value === NARRATION_AUDIO_STATUS.Queued) {
    return "排队生成中…"
  }

  if (narrationAudioStatus.value === NARRATION_AUDIO_STATUS.Generating) {
    return "语音生成中…"
  }

  if (narrationAudioStatus.value === NARRATION_AUDIO_STATUS.Failed) {
    return "生成失败，重试"
  }

  if (narrationAudioStatus.value === NARRATION_AUDIO_STATUS.Stale) {
    return "重新生成语音"
  }

  return "生成语音"
})
const narrationTextError = computed(() => String(narrationFromApi.value?.textError ?? "").trim())

function requestGenerateAudio() {
  const stageId = String(props.stage?.stageId || "").trim()
  if (!stageId || narrationAudioBusy.value) {
    return
  }

  emit("generate-audio", stageId)
}

const findScanTitle = computed(
  () =>
    props.stage?.exhibitName
    || readString("target_exhibit_name")
    || props.stage?.title
    || "目标展品",
)
const findScanLocation = computed(
  () =>
    props.stage?.galleryName
    || readString("location")
    || readString("gallery_name")
    || readString("scene_context")
    || "",
)
const findScanClue = computed(
  () =>
    readString("clue_text")
    || readString("clue")
    || readString("rule_hint")
    || readString("target_hint")
    || props.stage?.subtitle
    || "",
)

const hints = computed(() => {
  const source = config.value.hints
  return Array.isArray(source)
    ? source.filter((item): item is HintItem => typeof item === "object" && item !== null)
    : []
})

const puzzlePrompt = computed(() => {
  const puzzle = adaptedPuzzle.value
  if (!puzzle) {
    return ""
  }
  if (puzzle.prompt) {
    return puzzle.prompt
  }
  const payload = puzzle.questionPayload as { prompt?: string }
  return typeof payload?.prompt === "string" ? payload.prompt : ""
})
</script>

<template>
  <div
    v-if="props.stage"
    class="gameplay-preview is-preview-only"
    :class="`is-${meta.className}`"
  >
    <div class="preview-shell">
      <div class="preview-status">
        <span>{{ meta.label }}</span>
        <span>{{ props.stage.score || 0 }} 分</span>
      </div>
      <h3>{{ props.stage.title || "未命名节点" }}</h3>
      <p v-if="props.stage.subtitle" class="preview-subtitle">{{ props.stage.subtitle }}</p>

      <!-- 1–9：与 C 端同源 PuzzleRendererHost -->
      <section v-if="useSharedPuzzle && adaptedPuzzle" class="preview-panel puzzle-panel">
        <p v-if="puzzlePrompt" class="question">{{ puzzlePrompt }}</p>
        <PuzzleRendererHost
          :puzzle="adaptedPuzzle"
          :model-value="previewDraft"
          preview-mode
          readonly-mode
          @update:model-value="previewDraft = $event"
        />
      </section>

      <!-- 10：找一找 -->
      <section v-else-if="interactionType === 10" class="preview-panel find-scan-panel">
        <FindScanRenderer
          preview-mode
          status="idle"
          :title="findScanTitle"
          :location="findScanLocation"
          :clue-text="findScanClue"
        />
      </section>

      <!-- 11：解说导览（B 端工具区） -->
      <section v-else-if="interactionType === 11" class="preview-panel narration-panel">
        <p class="question">站在展柜前，收听本段文物解说。</p>

        <div class="narration-hero">
          <div class="narration-avatar" aria-hidden="true">导</div>
          <div class="narration-hero-copy">
            <strong>{{ props.stage.exhibitName || props.stage.title || "当前文物" }}</strong>
            <span>{{ narrationDurationLabel }} · 语音导览</span>
          </div>
        </div>

        <div class="narration-audio-block">
          <template v-if="hasNarrationAudio">
            <audio class="narration-audio" controls :src="narrationAudioUrl" preload="metadata" />
            <p v-if="narrationDurationMsLabel" class="narration-audio-meta">
              时长 {{ narrationDurationMsLabel }}
              <span v-if="narrationAudioStatus === NARRATION_AUDIO_STATUS.Stale"> · 文本已更新，可重新生成</span>
            </p>
            <button
              v-if="narrationAudioStatus === NARRATION_AUDIO_STATUS.Stale || narrationAudioStatus === NARRATION_AUDIO_STATUS.Failed"
              type="button"
              class="narration-audio-btn is-secondary"
              :disabled="narrationAudioBusy || !narrationText"
              @click="requestGenerateAudio"
            >
              {{ narrationAudioActionLabel }}
            </button>
          </template>
          <template v-else>
            <div class="narration-wave" aria-hidden="true">
              <i v-for="bar in 18" :key="bar" :style="{ height: `${28 + ((bar * 17) % 42)}%` }" />
            </div>
            <button
              type="button"
              class="narration-audio-btn"
              :disabled="narrationAudioBusy || !narrationText || narrationStatus === 'loading'"
              @click="requestGenerateAudio"
            >
              {{ narrationAudioActionLabel }}
            </button>
            <p class="narration-audio-hint">
              无音频时点击生成语音；生成完成后可在线试听。
            </p>
          </template>
        </div>

        <dl class="narration-meta">
          <div v-if="props.stage.exhibitName">
            <dt>文物</dt>
            <dd>{{ props.stage.exhibitName }}</dd>
          </div>
          <div v-if="narrationGuideName || narrationGuideId">
            <dt>讲解人</dt>
            <dd>
              {{ narrationGuideName || `ID ${narrationGuideId}` }}
            </dd>
          </div>
          <div>
            <dt>目标时长</dt>
            <dd>{{ narrationDurationSec }} 秒</dd>
          </div>
          <div v-if="narrationScene">
            <dt>场景</dt>
            <dd>{{ narrationScene }}</dd>
          </div>
          <div v-if="narrationStyle">
            <dt>风格</dt>
            <dd>{{ narrationStyle }}</dd>
          </div>
        </dl>

        <div v-if="narrationStatus === 'loading'" class="narration-script-empty">
          正在加载解说词…
        </div>
        <div v-else-if="narrationStatus === 'error'" class="narration-script-empty is-error">
          {{ narrationErrorMessage || narrationTextError || "解说词加载失败" }}
        </div>
        <div v-else-if="narrationText" class="narration-script">
          <p class="narration-script-label">解说词</p>
          <p>{{ narrationText }}</p>
        </div>
        <p v-else class="narration-script-empty">
          暂无解说词。可先通过对话生成解说，或确认该节点已生成 Narration 文本。
        </p>
      </section>

      <section v-else class="preview-panel">
        <p class="question">当前玩法暂未配置专属预览。</p>
      </section>

      <div v-if="hints.length" class="hint-strip">
        <span
          v-for="hint in hints"
          :key="hint.hint_id || hint.clueId || hint.content || String(hint.level)"
        >
          {{ hint.content || "提示待解锁" }}
        </span>
      </div>
    </div>
  </div>
  <div v-else class="gameplay-empty">请选择左侧节点查看模拟效果。</div>
</template>

<style scoped>
.gameplay-preview {
  min-height: 100%;
  padding: 14px;
  border-radius: 24px;
  background: linear-gradient(160deg, #242832, #15171c 56%, #1f211b);
  color: #fff8ea;
}

/* 后台预览：默认屏蔽玩家侧交互；解说音频区为 B 端试听/生成工具，单独放行 */
.gameplay-preview.is-preview-only .preview-panel {
  pointer-events: none;
  user-select: none;
}

.gameplay-preview.is-preview-only .narration-panel .narration-audio-block {
  pointer-events: auto;
  user-select: auto;
}

.preview-shell {
  display: flex;
  min-height: 540px;
  flex-direction: column;
  gap: 14px;
  border-radius: 22px;
  border: 1px solid rgb(255 255 255 / 10%);
  padding: 18px;
  background: rgb(7 8 10 / 42%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 6%);
}

.preview-status {
  display: flex;
  justify-content: space-between;
  color: rgb(247 239 221 / 62%);
  font-size: 12px;
}

h3 {
  margin: 0;
  font-size: 18px;
  line-height: 1.25;
}

.preview-subtitle,
.question {
  margin: 0;
  color: rgb(247 239 221 / 68%);
  font-size: 13px;
  line-height: 1.55;
}

.preview-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  border-radius: 18px;
  padding: 14px;
  background: rgb(255 255 255 / 5%);
}

.puzzle-panel {
  gap: 14px;
}

.find-scan-panel {
  gap: 0;
  padding: 12px;
  background: transparent;
}

.hint-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hint-strip span {
  border-radius: 999px;
  padding: 6px 10px;
  background: rgb(159 214 194 / 10%);
  color: #bfe6d8;
  font-size: 12px;
}

.narration-panel {
  gap: 14px;
}

.narration-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 16px;
  border: 1px solid rgb(209 178 111 / 22%);
  padding: 12px;
  background: linear-gradient(135deg, rgb(209 178 111 / 14%), rgb(255 255 255 / 4%));
}

.narration-avatar {
  display: flex;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgb(209 178 111 / 24%);
  color: #f3d99d;
  font-size: 14px;
  font-weight: 800;
}

.narration-hero-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.narration-hero-copy strong {
  overflow: hidden;
  color: #fff8ea;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.narration-hero-copy span {
  color: rgb(247 239 221 / 58%);
  font-size: 12px;
}

.narration-audio-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-radius: 14px;
  border: 1px solid rgb(209 178 111 / 18%);
  padding: 12px;
  background: rgb(255 255 255 / 4%);
}

.narration-audio-btn {
  min-height: 40px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, rgb(209 178 111 / 92%), rgb(243 217 157 / 78%));
  color: #1a160f;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.narration-audio-btn.is-secondary {
  border: 1px solid rgb(209 178 111 / 35%);
  background: rgb(209 178 111 / 12%);
  color: #f3d99d;
}

.narration-audio-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.narration-audio-meta,
.narration-audio-hint {
  margin: 0;
  color: rgb(247 239 221 / 55%);
  font-size: 11px;
  line-height: 1.45;
}

.narration-wave {
  display: flex;
  height: 44px;
  align-items: flex-end;
  gap: 3px;
  padding: 0 4px;
}

.narration-wave i {
  display: block;
  flex: 1;
  min-height: 18%;
  border-radius: 999px;
  background: linear-gradient(180deg, rgb(243 217 157 / 85%), rgb(209 178 111 / 28%));
}

.narration-meta {
  display: grid;
  gap: 8px;
  margin: 0;
}

.narration-meta > div {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 8px;
  font-size: 12px;
  line-height: 1.45;
}

.narration-meta dt {
  margin: 0;
  color: rgb(247 239 221 / 48%);
}

.narration-meta dd {
  margin: 0;
  color: rgb(247 239 221 / 86%);
  word-break: break-word;
}

.narration-script,
.narration-script-empty {
  margin: 0;
  border-radius: 14px;
  padding: 12px;
  background: rgb(255 255 255 / 5%);
  color: rgb(247 239 221 / 72%);
  font-size: 12px;
  line-height: 1.6;
}

.narration-script-empty.is-error {
  border: 1px solid rgb(224 112 112 / 28%);
  background: rgb(224 112 112 / 8%);
  color: #f0b4b4;
}

.narration-script-label {
  margin: 0 0 6px;
  color: #d1b26f;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.narration-script p {
  margin: 0;
  white-space: pre-wrap;
}

.narration-audio {
  width: 100%;
  height: 36px;
}

.gameplay-empty {
  display: flex;
  min-height: 540px;
  align-items: center;
  justify-content: center;
  border-radius: 24px;
  border: 1px dashed rgb(255 255 255 / 14%);
  color: rgb(247 239 221 / 58%);
}
</style>
