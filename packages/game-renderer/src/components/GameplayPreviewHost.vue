<script setup lang="ts">
import { computed } from "vue"
import type { GameplayPreviewStage } from "../contracts"

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

const props = defineProps<{
  stage: GameplayPreviewStage | null
}>()

const interactionMeta: Record<number, { label: string; className: string }> = {
  1: { label: "线性答题", className: "answer" },
  2: { label: "密符解锁", className: "password" },
  3: { label: "时序重构", className: "sequence" },
  4: { label: "档案配对", className: "match" },
  5: { label: "颜色寻宝", className: "select" },
  6: { label: "纹样拼图", className: "jigsaw" },
  7: { label: "听声配对", className: "sound" },
  8: { label: "大家来找茬", className: "spot" },
  9: { label: "影子归位", className: "shadow" },
}

const config = computed(() => props.stage?.config ?? {})
const meta = computed(() => interactionMeta[props.stage?.interactionType ?? 0] ?? { label: "未知玩法", className: "unknown" })

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
  <div v-if="props.stage" class="gameplay-preview" :class="`is-${meta.className}`">
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
          <button v-for="option in answerOptions" :key="option.key" type="button">
            <span>{{ option.key }}</span>
            {{ option.label }}
          </button>
          <input v-if="!answerOptions.length" disabled placeholder="玩家在这里输入答案" />
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

.option-list input {
  height: 42px;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 14px;
  padding: 0 12px;
  background: rgb(255 255 255 / 6%);
  color: rgb(247 239 221 / 60%);
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
