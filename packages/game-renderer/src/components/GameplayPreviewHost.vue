<script setup lang="ts">
/**
 * 后台路线预览宿主。
 *
 * studio：统一带 label 的可编辑字段 + 各渲染器专属字段
 * play：只读预览
 *
 * 规则：渲染器负责题面与专属字段；宿主负责公共字段（标题/题干/关卡提示）与副作用转发。
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
import StudioField from "./StudioField.vue"

const props = withDefaults(
  defineProps<{
    stage: GameplayPreviewStage | null
    narrationAudioGenerating?: boolean
    surfaceMode?: RendererSurfaceMode
  }>(),
  {
    narrationAudioGenerating: false,
    surfaceMode: "studio",
  },
)

const emit = defineEmits<{
  "generate-audio": [stageId: string]
  "narration-draft": [payload: { stageId: string; draft: NarrationRendererDraft }]
  /** 通用 studio 草稿（adapter 落库） */
  "stage-draft": [payload: {
    stageId: string
    title?: string
    prompt?: string
    hints?: string[]
    extra?: Record<string, unknown>
  }]
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
const studioTitle = ref("")
const studioPrompt = ref("")
const studioHints = ref<string[]>([])

function readString(key: string) {
  const value = config.value[key]
  return typeof value === "string" ? value.trim() : ""
}

function readNumber(key: string) {
  const value = config.value[key]
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function mapHintsFromConfig(): string[] {
  const source = config.value.hints
  if (!Array.isArray(source)) {
    return []
  }
  return source
    .map((item) => {
      if (typeof item === "string") {
        return item.trim()
      }
      if (item && typeof item === "object") {
        return String((item as HintItem).content ?? "").trim()
      }
      return ""
    })
    .filter(Boolean)
}

watch(
  () => props.stage,
  (stage) => {
    studioTitle.value = String(stage?.title || "").trim()
    studioHints.value = mapHintsFromConfig()
  },
  { immediate: true },
)

watch(
  adaptedPuzzle,
  (puzzle) => {
    previewDraft.value = puzzle
      ? { templateType: puzzle.templateType, value: null }
      : null
    studioPrompt.value = puzzle
      ? String(puzzle.prompt || (puzzle.questionPayload as { prompt?: string })?.prompt || "").trim()
      : ""
  },
  { immediate: true },
)

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
  if (typeof draft.title === "string") {
    studioTitle.value = draft.title
  }
  emit("narration-draft", { stageId, draft })
  emitStageDraft({ extra: { narration: draft } })
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
  if (isStudio.value) {
    return studioHints.value.map((content, index) => ({
      content,
      level: index + 1,
    }))
  }
  const source = config.value.hints
  return Array.isArray(source)
    ? source.filter(
        (item): item is HintItem => typeof item === "object" && item !== null,
      )
    : []
})

const puzzlePrompt = computed(() => {
  if (isStudio.value) {
    return studioPrompt.value
  }
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

const displayStageTitle = computed(() => {
  if (isStudio.value) {
    return studioTitle.value || "未命名节点"
  }
  return props.stage?.title || "未命名节点"
})

/** 拼图 / 找一找 / 解说：题干或标题由 renderer 管理，host 不重复题干 */
const showHostTitle = computed(() => useSharedPuzzle.value)
const showHostPrompt = computed(() => {
  if (!useSharedPuzzle.value || !adaptedPuzzle.value) {
    return false
  }
  if (adaptedPuzzle.value.templateType === "image_puzzle") {
    return false
  }
  return true
})

const puzzleStudioMode = computed(() => isStudio.value)
const puzzleReadonly = computed(() => !isStudio.value)
const puzzlePreviewMode = computed(() => !isStudio.value)

function emitStageDraft(partial?: {
  title?: string
  prompt?: string
  hints?: string[]
  extra?: Record<string, unknown>
}) {
  const stageId = String(props.stage?.stageId || "").trim()
  if (!stageId || !isStudio.value) {
    return
  }
  emit("stage-draft", {
    stageId,
    title: partial?.title ?? studioTitle.value,
    prompt: partial?.prompt ?? studioPrompt.value,
    hints: partial?.hints ?? [...studioHints.value],
    extra: partial?.extra,
  })
}

const handlePuzzleContent = (payload: {
  title?: string
  prompt?: string
  options?: Array<{ id: string; label: string }>
  items?: Array<{ id: string; label: string }>
}) => {
  if (typeof payload.title === "string") {
    studioTitle.value = payload.title
  }
  if (typeof payload.prompt === "string") {
    studioPrompt.value = payload.prompt
  }
  emitStageDraft({
    extra: {
      options: payload.options,
      items: payload.items,
    },
  })
}

const handleFindScanContent = (payload: {
  title?: string
  location?: string
  clueText?: string
}) => {
  if (typeof payload.title === "string") {
    studioTitle.value = payload.title
  }
  emitStageDraft({
    extra: {
      findScan: payload,
    },
  })
}

function addHint() {
  studioHints.value = [...studioHints.value, ""]
}

function removeHint(index: number) {
  studioHints.value = studioHints.value.filter((_, i) => i !== index)
  emitStageDraft()
}

function updateHint(index: number, value: string | number) {
  const next = [...studioHints.value]
  next[index] = String(value)
  studioHints.value = next
}
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

      <!-- 公共字段：全题型统一 label -->
      <div v-if="isStudio && showHostTitle" class="studio-common">
        <StudioField
          v-model="studioTitle"
          label="节点标题"
          placeholder="展示给玩家的节点名称"
          @change="emitStageDraft()" />
        <StudioField
          v-if="showHostPrompt"
          v-model="studioPrompt"
          label="题干"
          type="textarea"
          :rows="2"
          placeholder="题目说明 / 提问文案"
          @change="emitStageDraft()" />
      </div>
      <template v-else-if="showHostTitle">
        <h3>{{ displayStageTitle }}</h3>
        <p v-if="showHostPrompt && puzzlePrompt" class="question">
          {{ puzzlePrompt }}
        </p>
      </template>

      <!-- 1–9 -->
      <section
        v-if="useSharedPuzzle && adaptedPuzzle"
        class="preview-panel puzzle-panel">
        <PuzzleRendererHost
          :puzzle="adaptedPuzzle"
          :model-value="previewDraft"
          :preview-mode="puzzlePreviewMode"
          :readonly-mode="puzzleReadonly"
          :studio-mode="puzzleStudioMode"
          @update:model-value="previewDraft = $event"
          @update:content="handlePuzzleContent" />
      </section>

      <!-- 10 -->
      <section
        v-else-if="interactionType === 10"
        class="preview-panel find-scan-panel">
        <FindScanRenderer
          :preview-mode="!isStudio"
          :studio-mode="isStudio"
          status="idle"
          :title="isStudio ? studioTitle || findScanTitle : findScanTitle"
          :location="findScanLocation"
          :clue-text="findScanClue"
          @update:content="handleFindScanContent" />
      </section>

      <!-- 11 -->
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

      <!-- 关卡提示：全题型可编辑 -->
      <div v-if="isStudio" class="studio-hints">
        <div class="studio-hints__head">
          <span class="studio-hints__title">关卡提示</span>
          <button type="button" class="studio-hints__add" @click="addHint">
            添加提示
          </button>
        </div>
        <div
          v-for="(hint, index) in studioHints"
          :key="`hint-${index}`"
          class="studio-hints__row">
          <StudioField
            class="studio-hints__field"
            :model-value="hint"
            :label="`提示 ${index + 1}`"
            type="textarea"
            :rows="2"
            placeholder="玩家可查看的提示内容"
            @update:model-value="updateHint(index, $event)"
            @change="emitStageDraft()" />
          <button
            type="button"
            class="studio-hints__remove"
            title="删除此提示"
            @click="removeHint(index)">
            删除
          </button>
        </div>
        <p v-if="!studioHints.length" class="studio-hints__empty">
          暂无关卡提示，可点击「添加提示」
        </p>
      </div>
      <div v-else-if="hints.length" class="hint-strip">
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
  overflow: hidden;
  background: #12141a;
  color: #fff8ea;
}

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
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 14px 14px 20px;
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

.studio-common {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 8px;
}

.question {
  margin: 0;
  flex-shrink: 0;
  color: rgb(247 239 221 / 62%);
  font-size: 13px;
  line-height: 1.5;
}

.preview-panel {
  display: flex;
  /* 不抢 flex 高度，让 shell 按内容滚动，避免底部提示被盖住 */
  flex: 0 0 auto;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  background: transparent;
}

.puzzle-panel,
.find-scan-panel,
.narration-panel {
  gap: 0;
  padding: 0;
  background: transparent;
}

/* 解说仍尽量占满可视区，内部自滚动 */
.narration-panel {
  flex: 1 1 auto;
  min-height: 240px;
}

.studio-hints {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding-top: 10px;
  padding-bottom: 4px;
  border-top: 1px solid rgb(255 255 255 / 8%);
}

.studio-hints__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.studio-hints__title {
  color: rgb(209 178 111 / 82%);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.studio-hints__add,
.studio-hints__remove {
  border: 1px solid rgb(209 178 111 / 28%);
  border-radius: 999px;
  background: rgb(209 178 111 / 10%);
  padding: 4px 10px;
  color: #f0dfb0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.studio-hints__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
}

.studio-hints__field {
  min-width: 0;
}

.studio-hints__remove {
  margin-bottom: 2px;
  border-color: rgb(255 255 255 / 12%);
  background: rgb(255 255 255 / 4%);
  color: rgb(247 239 221 / 62%);
}

.studio-hints__empty {
  margin: 0;
  color: rgb(247 239 221 / 42%);
  font-size: 12px;
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
