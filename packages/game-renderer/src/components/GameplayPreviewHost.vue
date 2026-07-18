<script setup lang="ts">
/**
 * 后台路线预览宿主。
 *
 * 1–9：adaptStageToPuzzle → PuzzleRendererHost(previewMode 禁答，studio 可后续扩编辑)
 * 10：FindScanRenderer 预览
 * 11：NarrationRenderer(studio) —— 紧凑播放 + 生成/重生成 + 字段微调
 *
 * 规则：渲染器负责 UI；本宿主只做数据适配与副作用转发。
 */
import { computed, ref, watch } from "vue"
import { adaptStageToPuzzle, isPuzzleInteraction } from "../adaptStage"
import {
  getInteractionTypeMeta,
  type GameplayPreviewStage,
  type NarrationRendererDraft,
  type PuzzleAnswerDraft,
  type PuzzleDefinition,
  type RendererSurfaceMode,
} from "../contracts"
import FindScanRenderer from "./renderers/FindScanRenderer.vue"
import NarrationRenderer from "./renderers/NarrationRenderer.vue"
import PuzzleRendererHost from "./PuzzleRendererHost.vue"

const props = withDefaults(
  defineProps<{
    stage: GameplayPreviewStage | null
    /** 是否正在请求生成语音 */
    narrationAudioGenerating?: boolean
    /**
     * 表面模式。web-admin 预览默认 studio；
     * 若将来在 H5 复用本宿主，传 play。
     */
    surfaceMode?: RendererSurfaceMode
  }>(),
  {
    narrationAudioGenerating: false,
    surfaceMode: "studio",
  },
)

const emit = defineEmits<{
  "generate-audio": [stageId: string]
  /** studio 字段微调（adapter 决定是否落库） */
  "narration-draft": [payload: { stageId: string; draft: NarrationRendererDraft }]
}>()

interface HintItem {
  hint_id?: string
  clueId?: string
  level?: number
  type?: string
  content?: string | null
  penalty_score?: number
}

const isStudio = computed(() => props.surfaceMode === "studio")

const config = computed(() => props.stage?.config ?? {})
const meta = computed(
  () =>
    getInteractionTypeMeta(props.stage?.interactionType) ?? {
      label: "未知玩法",
      className: "unknown",
    },
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
const narrationErrorMessage = computed(() =>
  String(props.stage?.narrationErrorMessage || "").trim(),
)

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

const narrationGuideName = computed(() =>
  String(narrationFromApi.value?.guideName ?? "").trim(),
)

const narrationStyle = computed(
  () =>
    String(narrationFromApi.value?.resolvedStyle ?? "").trim()
    || readString("user_style_input"),
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

const narrationText = computed(
  () =>
    String(narrationFromApi.value?.narrationText ?? "").trim()
    || readString("narration_text"),
)

const narrationAudioUrl = computed(
  () =>
    String(narrationFromApi.value?.audioUrl ?? "").trim() || readString("audio_url"),
)

const narrationAudioStatus = computed(() => {
  const status = narrationFromApi.value?.audioStatus
  return typeof status === "number" && Number.isFinite(status) ? status : 0
})

const narrationDurationMs = computed(() => {
  const ms = narrationFromApi.value?.durationMs
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : null
})

const narrationTextError = computed(() =>
  String(narrationFromApi.value?.textError ?? "").trim(),
)

function requestGenerateAudio() {
  const stageId = String(props.stage?.stageId || "").trim()
  if (!stageId) {
    return
  }

  emit("generate-audio", stageId)
}

function handleNarrationDraft(draft: NarrationRendererDraft) {
  const stageId = String(props.stage?.stageId || "").trim()
  if (!stageId) {
    return
  }

  emit("narration-draft", { stageId, draft })
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
    ? source.filter(
        (item): item is HintItem => typeof item === "object" && item !== null,
      )
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

/** 题型：studio 仍禁答（previewMode），避免把预览当答题；字段编辑后续扩到各题型 renderer */
const puzzleReadonly = computed(() => true)
const puzzlePreviewMode = computed(() => !isStudio.value)
</script>

<template>
  <div
    class="gameplay-preview-root"
    :class="props.stage
      ? [`is-${meta.className}`, isStudio ? 'is-studio' : 'is-play']
      : 'is-empty'">
    <div v-if="props.stage" class="preview-shell">
      <div class="preview-status">
        <span>{{ meta.label }}</span>
        <span>{{ props.stage.score || 0 }} 分</span>
      </div>

      <!-- 解说节点标题由 NarrationRenderer 管理，避免重复 -->
      <template v-if="interactionType !== 11">
        <h3>{{ props.stage.title || "未命名节点" }}</h3>
        <p v-if="props.stage.subtitle" class="preview-subtitle">
          {{ props.stage.subtitle }}
        </p>
      </template>

      <!-- 1–9：与 C 端同源 PuzzleRendererHost -->
      <section
        v-if="useSharedPuzzle && adaptedPuzzle"
        class="preview-panel puzzle-panel">
        <p v-if="puzzlePrompt" class="question">
          {{ puzzlePrompt }}
        </p>
        <PuzzleRendererHost
          :puzzle="adaptedPuzzle"
          :model-value="previewDraft"
          :preview-mode="puzzlePreviewMode"
          :readonly-mode="puzzleReadonly"
          @update:model-value="previewDraft = $event" />
      </section>

      <!-- 10：找一找 -->
      <section
        v-else-if="interactionType === 10"
        class="preview-panel find-scan-panel">
        <FindScanRenderer
          preview-mode
          status="idle"
          :title="findScanTitle"
          :location="findScanLocation"
          :clue-text="findScanClue" />
      </section>

      <!-- 11：解说导览 -->
      <section
        v-else-if="interactionType === 11"
        class="preview-panel narration-panel">
        <NarrationRenderer
          :mode="props.surfaceMode"
          :title="props.stage.title"
          :exhibit-name="props.stage.exhibitName"
          :guide-name="narrationGuideName"
          :guide-id="narrationGuideId"
          :style="narrationStyle"
          :scene-context="narrationScene"
          :target-duration-seconds="narrationDurationSec"
          :narration-text="narrationText"
          :audio-url="narrationAudioUrl"
          :audio-status="narrationAudioStatus"
          :duration-ms="narrationDurationMs"
          :status="narrationStatus"
          :error-message="narrationErrorMessage || narrationTextError"
          :generating-audio="props.narrationAudioGenerating"
          :show-play-actions="false"
          @generate-audio="requestGenerateAudio"
          @update:draft="handleNarrationDraft" />
      </section>

      <section v-else class="preview-panel">
        <p class="question">
          当前玩法暂未配置专属预览。
        </p>
      </section>

      <div v-if="hints.length" class="hint-strip">
        <span
          v-for="hint in hints"
          :key="hint.hint_id || hint.clueId || hint.content || String(hint.level)">
          {{ hint.content || "提示待解锁" }}
        </span>
      </div>
    </div>
    <div v-else class="gameplay-empty">
      请选择左侧节点查看模拟效果。
    </div>
  </div>
</template>

<style scoped>
.gameplay-preview-root {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #12141a;
  color: #fff8ea;
}

/* play 宿主：屏蔽玩家侧误触；studio 放行编辑/播放/生成 */
.gameplay-preview-root.is-play .preview-panel {
  pointer-events: none;
  user-select: none;
}

.gameplay-preview-root.is-play .narration-panel {
  pointer-events: auto;
  user-select: auto;
}

.preview-shell {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  padding: 14px 14px 12px;
}

.preview-status {
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  color: rgb(247 239 221 / 52%);
  font-size: 11px;
  letter-spacing: 0.04em;
}

h3 {
  margin: 0;
  flex-shrink: 0;
  font-size: 16px;
  line-height: 1.3;
}

.preview-subtitle,
.question {
  margin: 0;
  flex-shrink: 0;
  color: rgb(247 239 221 / 62%);
  font-size: 13px;
  line-height: 1.5;
}

.preview-panel {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  /* 去卡片：无圆角底、无内层底板 */
  padding: 0;
  background: transparent;
}

.puzzle-panel {
  gap: 10px;
}

.find-scan-panel {
  gap: 0;
  padding: 0;
  background: transparent;
}

.narration-panel {
  gap: 0;
  padding: 0;
  background: transparent;
}

.hint-strip {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 8px;
}

.hint-strip span {
  color: rgb(191 230 216 / 80%);
  font-size: 12px;
}

.gameplay-empty {
  display: flex;
  height: 100%;
  min-height: 200px;
  align-items: center;
  justify-content: center;
  color: rgb(247 239 221 / 52%);
  font-size: 13px;
}
</style>
