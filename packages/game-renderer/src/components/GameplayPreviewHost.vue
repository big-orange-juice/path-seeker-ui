<script setup lang="ts">
import { computed } from "vue"
import { getInteractionTypeMeta, NARRATION_AUDIO_STATUS } from "../contracts"
import type { GameplayPreviewStage } from "../contracts"
import FindScanRenderer from "./renderers/FindScanRenderer.vue"

const props = defineProps<{
  stage: GameplayPreviewStage | null
  /** 是否正在请求生成语音 */
  narrationAudioGenerating?: boolean
}>()

const emit = defineEmits<{
  "generate-audio": [stageId: string]
}>()

interface PreviewItem {
  key: string
  label: string
  imageUrl?: string | null
  audioUrl?: string | null
  silhouetteUrl?: string | null
}

interface HintItem {
  hint_id?: string
  clueId?: string
  level?: number
  type?: string
  content?: string | null
  penalty_score?: number
}

const config = computed(() => props.stage?.config ?? {})
const meta = computed(() => getInteractionTypeMeta(props.stage?.interactionType) ?? { label: "未知玩法", className: "unknown" })

const content = computed(() => readString("content") || props.stage?.subtitle || "当前节点暂无题面。")
const ruleHint = computed(() => readString("rule_hint") || "根据节点线索完成本关挑战。")
const digits = computed(() => readNumber("digits") || 4)
const gridRows = computed(() => readNumber("grid_rows") || 3)
const gridCols = computed(() => readNumber("grid_cols") || 3)
const requiredHits = computed(() => readNumber("required_hits") || 3)
const minPick = computed(() => readNumber("min_pick") || 1)
const maxPick = computed(() => readNumber("max_pick") || 0)
const baseImageUrl = computed(() => readString("base_image_url"))
const alteredImageUrl = computed(() => readString("altered_image_url"))

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

const answerOptions = computed(() => {
  const answerExtra = readJsonObject(config.value.answer_extra)
  const options = Array.isArray(answerExtra.options) ? answerExtra.options : []

  return options
    .map((item, index) => ({
      key: readItemString(item, "key") || String.fromCharCode(65 + index),
      label: readItemString(item, "text") || readItemString(item, "label") || `选项 ${index + 1}`,
    }))
})

const sequenceItems = computed(() => readItems("items"))
const leftItems = computed(() => readItems("left"))
const rightItems = computed(() => readItems("right"))
const candidates = computed(() => readItems("candidates"))
const pieces = computed(() => readItems("pieces"))
const clueImages = computed(() => readItems("clue_images"))
const hints = computed(() => {
  const source = config.value.hints
  return Array.isArray(source) ? source.filter((item): item is HintItem => typeof item === "object" && item !== null) : []
})

function readString(key: string) {
  const value = config.value[key]
  return typeof value === "string" ? value.trim() : ""
}

function readNumber(key: string) {
  const value = config.value[key]
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function readJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value !== "string" || !value.trim()) {
    return {}
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function readItemString(item: unknown, key: string) {
  if (!item || typeof item !== "object") {
    return ""
  }

  const value = (item as Record<string, unknown>)[key]
  return typeof value === "string" ? value : ""
}

function readItemNumberString(item: unknown, key: string) {
  if (!item || typeof item !== "object") {
    return ""
  }

  const value = (item as Record<string, unknown>)[key]
  return typeof value === "number" || typeof value === "bigint" ? String(value) : ""
}

function readItems(key: string): PreviewItem[] {
  const source = config.value[key]
  if (!Array.isArray(source)) {
    return []
  }

  return source.map((item, index) => ({
    key: readItemString(item, "key") || readItemString(item, "id") || String(index + 1),
    label: readItemString(item, "label") || readItemString(item, "hint") || readItemString(item, "exhibit_id") || readItemNumberString(item, "exhibit_id") || `项目 ${index + 1}`,
    imageUrl: readItemString(item, "image_url") || readItemString(item, "url") || null,
    audioUrl: readItemString(item, "audio_url") || null,
    silhouetteUrl: readItemString(item, "silhouette_url") || null,
  }))
}

function assetUrl(url?: string | null) {
  const normalized = String(url ?? "").trim()
  if (!normalized) {
    return ""
  }

  return normalized
}

function itemVisualUrl(item: PreviewItem, preferred: "image" | "silhouette" = "image") {
  if (preferred === "silhouette") {
    return assetUrl(item.silhouetteUrl || item.imageUrl)
  }

  return assetUrl(item.imageUrl || item.silhouetteUrl)
}
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

      <section v-if="props.stage.interactionType === 1" class="preview-panel">
        <p class="question">{{ content }}</p>
        <div class="option-list">
          <button v-for="option in answerOptions" :key="option.key" type="button" tabindex="-1">
            <span>{{ option.key }}</span>
            {{ option.label }}
          </button>
          <textarea
            v-if="!answerOptions.length"
            class="answer-textarea"
            rows="4"
            disabled
            readonly
            tabindex="-1"
            placeholder="玩家在这里输入答案"
          />
        </div>
      </section>

      <section v-else-if="props.stage.interactionType === 2" class="preview-panel">
        <p class="question">{{ ruleHint }}</p>
        <div class="password-slots">
          <span v-for="index in digits" :key="index">*</span>
        </div>
        <div v-if="clueImages.length" class="mini-grid">
          <article v-for="item in clueImages" :key="item.key" class="media-card">
            <img v-if="assetUrl(item.imageUrl)" :src="assetUrl(item.imageUrl)" :alt="item.label" loading="lazy" />
            <span v-else class="media-placeholder">线索图</span>
            <strong>{{ item.label }}</strong>
          </article>
        </div>
      </section>

      <section v-else-if="props.stage.interactionType === 3" class="preview-panel">
        <p class="question">{{ readString("variant") || "拖动卡片调整顺序" }}</p>
        <ol class="sequence-list">
          <li v-for="item in sequenceItems" :key="item.key" class="sequence-card">
            <img v-if="assetUrl(item.imageUrl)" :src="assetUrl(item.imageUrl)" :alt="item.label" loading="lazy" />
            <span v-else class="media-placeholder">事件</span>
            <strong>{{ item.label }}</strong>
          </li>
        </ol>
      </section>

      <section v-else-if="[4, 7, 9].includes(props.stage.interactionType)" class="preview-panel">
        <p class="question">{{ props.stage.interactionType === 7 ? "听声音，找对应图像。" : props.stage.interactionType === 9 ? "把剪影与原图配对。" : "把左右两侧档案配对。" }}</p>
        <div class="match-board">
          <div>
            <article v-for="item in leftItems" :key="item.key" class="media-card">
              <img
                v-if="itemVisualUrl(item, props.stage.interactionType === 9 ? 'image' : 'image')"
                :src="itemVisualUrl(item, props.stage.interactionType === 9 ? 'image' : 'image')"
                :alt="item.label"
                loading="lazy"
              />
              <span v-else class="media-placeholder">{{ props.stage.interactionType === 7 ? "音频" : "左侧" }}</span>
              <span v-if="props.stage.interactionType === 7">播放</span>
              <span v-else-if="props.stage.interactionType === 9">原图</span>
              <span v-else>左</span>
              <strong>{{ item.label }}</strong>
            </article>
          </div>
          <div>
            <article v-for="item in rightItems" :key="item.key" class="media-card">
              <img
                v-if="itemVisualUrl(item, props.stage.interactionType === 9 ? 'silhouette' : 'image')"
                :src="itemVisualUrl(item, props.stage.interactionType === 9 ? 'silhouette' : 'image')"
                :alt="item.label"
                loading="lazy"
              />
              <span v-else class="media-placeholder">{{ props.stage.interactionType === 9 ? "剪影" : "右侧" }}</span>
              <span>右</span>
              <strong>{{ item.label }}</strong>
            </article>
          </div>
        </div>
      </section>

      <section v-else-if="props.stage.interactionType === 5" class="preview-panel">
        <p class="question">{{ readString("theme") || "选择符合主题的候选项" }}</p>
        <div class="pick-rule">至少 {{ minPick }} 个<span v-if="maxPick">，最多 {{ maxPick }} 个</span></div>
        <div class="candidate-grid">
          <button v-for="item in candidates" :key="item.key" type="button" class="media-card">
            <img v-if="assetUrl(item.imageUrl)" :src="assetUrl(item.imageUrl)" :alt="item.label" loading="lazy" />
            <span v-else class="media-placeholder">候选</span>
            <strong>{{ item.label }}</strong>
          </button>
        </div>
      </section>

      <section v-else-if="props.stage.interactionType === 6" class="preview-panel">
        <p class="question">将碎片拖回正确位置，完成纹样复原。</p>
        <img v-if="baseImageUrl" class="reference-image" :src="baseImageUrl" alt="拼图参考图" loading="lazy" />
        <div class="jigsaw-grid" :style="{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }">
          <span v-for="index in gridRows * gridCols" :key="index" class="puzzle-piece">
            <img
              v-if="assetUrl(pieces[index - 1]?.imageUrl)"
              :src="assetUrl(pieces[index - 1]?.imageUrl)"
              :alt="pieces[index - 1]?.label || pieces[index - 1]?.key || `拼块 ${index}`"
              loading="lazy"
            />
            <b v-else>{{ pieces[index - 1]?.key || index }}</b>
          </span>
        </div>
      </section>

      <section v-else-if="props.stage.interactionType === 8" class="preview-panel">
        <p class="question">找出两张图中的 {{ requiredHits }} 处差异。</p>
        <div class="spot-board">
          <div class="media-card">
            <img v-if="baseImageUrl" :src="baseImageUrl" alt="原图" loading="lazy" />
            <span v-else class="media-placeholder">原图</span>
            <strong>原图</strong>
          </div>
          <div class="media-card">
            <img v-if="alteredImageUrl" :src="alteredImageUrl" alt="改动图" loading="lazy" />
            <span v-else class="media-placeholder">改动图</span>
            <strong>改动图</strong>
          </div>
        </div>
      </section>

      <section v-else-if="props.stage.interactionType === 10" class="preview-panel find-scan-panel">
        <FindScanRenderer
          preview-mode
          status="idle"
          :title="findScanTitle"
          :location="findScanLocation"
          :clue-text="findScanClue" />
      </section>

      <section v-else-if="props.stage.interactionType === 11" class="preview-panel narration-panel">
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
              @click="requestGenerateAudio">
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
              @click="requestGenerateAudio">
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
        <span v-for="hint in hints" :key="hint.hint_id || hint.clueId || hint.content || String(hint.level)">
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

.option-list,
.sequence-list,
.mini-grid,
.candidate-grid {
  display: grid;
  gap: 10px;
}

.option-list button,
.candidate-grid button,
.sequence-list li,
.mini-grid article,
.match-board article {
  min-height: 42px;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgb(255 255 255 / 6%);
  color: #fff8ea;
  text-align: left;
}

.media-card,
.sequence-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.media-card img,
.sequence-card img,
.reference-image,
.puzzle-piece img {
  display: block;
  width: 100%;
  border-radius: 10px;
  object-fit: cover;
  background: rgb(255 255 255 / 6%);
}

.media-card img,
.sequence-card img {
  aspect-ratio: 4 / 3;
}

.media-card strong,
.sequence-card strong {
  color: #fff8ea;
  font-size: 12px;
  line-height: 1.35;
}

.media-placeholder {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgb(255 255 255 / 6%);
  color: rgb(247 239 221 / 46%);
  font-size: 12px;
}

.option-list span,
.match-board span {
  margin-right: 8px;
  color: #d1b26f;
  font-weight: 800;
}

.option-list input,
.option-list .answer-textarea {
  width: 100%;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgb(255 255 255 / 6%);
  color: rgb(247 239 221 / 60%);
  font: inherit;
  line-height: 1.5;
  resize: none;
}

.option-list input {
  height: 42px;
}

.option-list .answer-textarea {
  min-height: 96px;
}

.password-slots,
.spot-board,
.match-board {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.password-slots span,
.jigsaw-grid span {
  display: flex;
  min-height: 54px;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: linear-gradient(145deg, rgb(209 178 111 / 20%), rgb(255 255 255 / 6%));
  color: #f3d99d;
  font-weight: 900;
}

.match-board > div {
  display: grid;
  gap: 10px;
}

.pick-rule {
  color: #9fd6c2;
  font-size: 12px;
}

.candidate-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.jigsaw-grid {
  display: grid;
  gap: 8px;
}

.reference-image {
  max-height: 160px;
  object-fit: contain;
}

.puzzle-piece {
  overflow: hidden;
  aspect-ratio: 1;
  padding: 0;
}

.puzzle-piece img {
  height: 100%;
  border-radius: 0;
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

.find-scan-panel {
  gap: 0;
  padding: 12px;
  background: transparent;
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
