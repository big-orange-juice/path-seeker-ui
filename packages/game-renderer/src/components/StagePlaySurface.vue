<script setup lang="ts">
/**
 * 四型共用 play 面：H5 与 B 端模拟器同源布局/样式。
 * 仅负责题面渲染与本地交互；提交/下一站由宿主通过 canSubmit 与事件控制。
 * 不含 H5 页面背景星空等壳层动效。
 */
import { computed, shallowRef, watch } from "vue"
import {
  adaptStageToPuzzle,
  isPuzzleInteraction,
  resolveStageKind,
} from "../adaptStage"
import {
  getInteractionTypeMeta,
  type GameplayPreviewStage,
  type PuzzleAnswerDraft,
  type PuzzleDefinition,
} from "../contracts"
import FindScanPlayChain from "./FindScanPlayChain.vue"
import NarrationRenderer from "./renderers/NarrationRenderer.vue"
import PuzzleRendererHost from "./PuzzleRendererHost.vue"

const props = withDefaults(
  defineProps<{
    stage: GameplayPreviewStage | null
    /** 可选：H5 已适配好的题面，优先于 stage.config 再适配 */
    puzzle?: PuzzleDefinition | null
    modelValue?: PuzzleAnswerDraft | null
    /** 是否展示提交/完成本站类动作；模拟器为 false */
    canSubmit?: boolean
    /** 站序展示，如「第 3 站」；缺省不展示站号 */
    stageNo?: number | null
    /** 找一找观察提示（H5 artifact checklist） */
    tips?: string[]
    /** 找一找初始阶段（H5 按进度恢复） */
    initialFindPhase?: "scan" | "video"
  }>(),
  {
    puzzle: null,
    modelValue: null,
    canSubmit: false,
    stageNo: null,
    tips: () => [],
    initialFindPhase: "scan",
  },
)

const emit = defineEmits<{
  "update:modelValue": [value: PuzzleAnswerDraft | null]
  submit: []
  "complete-find": []
  "skip-find": []
  "complete-narration": []
  "skip-narration": []
  "update:findPhase": [phase: "scan" | "video"]
}>()

const config = computed(() => props.stage?.config ?? {})
const interactionType = computed(() => Number(props.stage?.interactionType ?? 0))
const stageKind = computed(() => resolveStageKind(interactionType.value))
const meta = computed(() => getInteractionTypeMeta(interactionType.value))

const adaptedPuzzle = computed<PuzzleDefinition | null>(() => {
  if (props.puzzle) return props.puzzle
  if (!props.stage || !isPuzzleInteraction(interactionType.value)) return null
  return adaptStageToPuzzle({
    stageId: props.stage.stageId,
    title: props.stage.title,
    subtitle: props.stage.subtitle,
    interactionType: props.stage.interactionType,
    config: props.stage.config,
  })
})

const localDraft = shallowRef<PuzzleAnswerDraft | null>(null)

watch(
  () => [props.modelValue, adaptedPuzzle.value?.id, adaptedPuzzle.value?.templateType] as const,
  () => {
    if (props.modelValue !== undefined && props.modelValue !== null) {
      localDraft.value = props.modelValue
      return
    }
    const puzzle = adaptedPuzzle.value
    localDraft.value = puzzle ? { templateType: puzzle.templateType, value: null } : null
  },
  { immediate: true },
)

const draft = computed({
  get: () => (props.modelValue !== undefined && props.modelValue !== null ? props.modelValue : localDraft.value),
  set: (value: PuzzleAnswerDraft | null) => {
    localDraft.value = value
    emit("update:modelValue", value)
  },
})

const readString = (key: string) => {
  const value = config.value[key]
  return typeof value === "string" ? value.trim() : ""
}
const readNumber = (key: string) => {
  const value = config.value[key]
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

const displayTitle = computed(() => props.stage?.title || "未命名节点")
const puzzleHeading = computed(
  () => adaptedPuzzle.value?.prompt || adaptedPuzzle.value?.title || displayTitle.value,
)
const typeLabel = computed(() => meta.value?.label || "关卡")
const scoreLabel = computed(() => `${props.stage?.score || 0} 分`)
const stageKicker = computed(() => {
  const no = props.stageNo
  const prefix = typeof no === "number" && no > 0 ? `第 ${no} 站 · ` : ""
  if (stageKind.value === "find_scan") return `${prefix}线索 · 找一找`
  if (stageKind.value === "narration") return `${prefix}解说导览`
  return `${prefix}闯关`
})

const findClue = computed(
  () =>
    readString("clue_text")
    || readString("clue")
    || readString("rule_hint")
    || readString("objective")
    || readString("goal")
    || "请在展厅中寻找目标展品。",
)
const findLocation = computed(
  () =>
    readString("location")
    || props.stage?.galleryName
    || props.stage?.exhibitName
    || "",
)
const findVideoUrl = computed(
  () =>
    readString("video_url")
    || readString("videoUrl")
    || readString("video")
    || readString("intro_video_url"),
)
const findExhibitLabel = computed(
  () => props.stage?.exhibitName || displayTitle.value || "展品",
)
const findTips = computed(() => (props.tips || []).map((tip) => String(tip || "").trim()).filter(Boolean))

const narration = computed(() => props.stage?.narration ?? null)
const narrationGuideId = computed(
  () => readString("guide_id") || String(narration.value?.guideId ?? "").trim(),
)
const narrationGuideName = computed(
  () => readString("guide_name") || String(narration.value?.guideName ?? "").trim(),
)
const narrationScene = computed(() => readString("scene_context"))
const narrationStyle = computed(
  () => readString("user_style_input") || String(narration.value?.resolvedStyle ?? "").trim(),
)
const narrationDurationSeconds = computed(() => {
  const configured = readNumber("target_duration_seconds")
  if (configured > 0) return configured
  const durationMs = narration.value?.durationMs
  return typeof durationMs === "number" && durationMs > 0 ? Math.round(durationMs / 1000) : 90
})
const narrationText = computed(
  () => readString("narration_text") || String(narration.value?.narrationText ?? "").trim(),
)
const narrationAudioUrl = computed(
  () => readString("audio_url") || String(narration.value?.audioUrl ?? "").trim(),
)

const handleDraftUpdate = (value: PuzzleAnswerDraft) => {
  draft.value = value
}
</script>

<template>
  <div v-if="props.stage" class="stage-play" :class="`is-${stageKind || 'unknown'}`">
    <!-- 1 / 6：与 H5 brief 题面卡一致 -->
    <section
      v-if="stageKind === 'observe_choice' || stageKind === 'image_puzzle'"
      class="play-panel">
      <div class="play-panel__inner">
        <div class="play-meta-row">
          <span class="play-tag">{{ typeLabel }}</span>
          <span class="play-score">{{ scoreLabel }}</span>
        </div>

        <div class="play-heading">
          <p class="play-kicker">{{ stageKicker }}</p>
          <h2 class="play-title">{{ puzzleHeading }}</h2>
        </div>

        <div class="play-body">
          <PuzzleRendererHost
            v-if="adaptedPuzzle && draft"
            :puzzle="adaptedPuzzle"
            :model-value="draft"
            @update:model-value="handleDraftUpdate" />
        </div>

        <div v-if="canSubmit" class="play-actions">
          <button type="button" class="play-btn is-primary" @click="emit('submit')">
            提交
          </button>
        </div>
        <slot name="actions" />
      </div>
    </section>

    <!-- 10：找一找扫+播，布局对齐 H5 -->
    <FindScanPlayChain
      v-else-if="stageKind === 'find_scan'"
      :title="findExhibitLabel"
      :location="findLocation"
      :clue-text="findClue"
      :video-url="findVideoUrl"
      :stage-no="stageNo"
      :stage-title="displayTitle"
      :tips="findTips"
      :can-complete="canSubmit"
      :initial-phase="initialFindPhase"
      @update:phase="emit('update:findPhase', $event)"
      @complete="emit('complete-find')"
      @skip-stage="emit('skip-find')">
      <template #actions>
        <slot name="actions" />
      </template>
    </FindScanPlayChain>

    <!-- 11：解说，对齐 H5 narration 页 -->
    <section v-else-if="stageKind === 'narration'" class="narration-shell">
      <p class="play-kicker">{{ stageKicker }}</p>
      <NarrationRenderer
        :title="props.stage.title"
        :exhibit-name="props.stage.exhibitName"
        :guide-name="narrationGuideName"
        :guide-id="narrationGuideId"
        :style="narrationStyle"
        :scene-context="narrationScene"
        :target-duration-seconds="narrationDurationSeconds"
        :narration-text="narrationText"
        :audio-url="narrationAudioUrl"
        :audio-status="narration?.audioStatus ?? 0"
        :duration-ms="narration?.durationMs ?? null"
        :status="props.stage.narrationStatus ?? 'idle'"
        :error-message="props.stage.narrationErrorMessage ?? ''"
        :show-play-actions="canSubmit"
        @complete="emit('complete-narration')"
        @skip="emit('skip-narration')">
        <template #footer>
          <slot name="actions" />
        </template>
      </NarrationRenderer>
    </section>

    <section v-else class="play-panel">
      <div class="play-panel__inner">
        <p class="play-muted">当前玩法暂不支持试玩。</p>
      </div>
    </section>
  </div>
  <div v-else class="stage-play is-empty">
    <p class="play-muted">选择一个路线节点开始试玩</p>
  </div>
</template>

<style scoped>
/* 与 H5 client 黑金 token 对齐的自包含样式（不依赖 h5-client CSS） */
.stage-play {
  --sp-void: #0a0908;
  --sp-line: rgba(255, 248, 230, 0.08);
  --sp-line-strong: rgba(209, 178, 111, 0.36);
  --sp-gold: #d1b26f;
  --sp-gold-bright: #e8c98a;
  --sp-fg: #f2ebe0;
  --sp-fg-dim: #a89f90;
  --sp-radius-lg: 1.05rem;

  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  color: var(--sp-fg);
  background: var(--sp-void);
}

.stage-play.is-empty {
  display: grid;
  place-items: center;
  padding: 24px 16px;
}

.play-panel {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: auto;
  border: 1px solid var(--sp-line);
  border-radius: var(--sp-radius-lg);
  background: linear-gradient(165deg, rgba(24, 22, 18, 0.92), rgba(14, 12, 10, 0.88));
  box-shadow:
    0 18px 44px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 248, 230, 0.04);
}

.play-panel__inner {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.25rem;
}

.play-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.play-tag {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(209, 178, 111, 0.28);
  border-radius: 999px;
  background: rgba(209, 178, 111, 0.1);
  padding: 0.3rem 0.75rem;
  color: var(--sp-gold-bright);
  font-size: 0.75rem;
  font-weight: 500;
}

.play-score {
  color: var(--sp-fg-dim);
  font-size: 0.875rem;
}

.play-heading {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.play-kicker {
  margin: 0;
  color: var(--sp-gold);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.play-title {
  margin: 0;
  color: var(--sp-fg);
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: 0.01em;
}

.play-body {
  border-radius: 1rem;
  background: rgba(10, 9, 8, 0.45);
  padding: 1rem;
}

.play-actions {
  display: grid;
  gap: 0.75rem;
}

.play-btn {
  width: 100%;
  border: 1px solid rgba(255, 248, 230, 0.12);
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.03);
  padding: 0.75rem 1rem;
  color: var(--sp-fg);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.play-btn.is-primary {
  border-color: rgba(209, 178, 111, 0.42);
  background: linear-gradient(145deg, rgba(232, 201, 138, 0.95), rgba(184, 150, 69, 0.95));
  color: #1a160c;
}

.play-muted {
  margin: 0;
  color: var(--sp-fg-dim);
  font-size: 0.875rem;
  line-height: 1.5;
  text-align: center;
}

.narration-shell {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
  overflow: auto;
  border: 1px solid rgba(255, 248, 230, 0.08);
  border-radius: 0.75rem;
  background: #0c0d10;
  padding: 1rem;
}
</style>
