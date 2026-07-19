<script setup lang="ts">
/**
 * 解说导览渲染器（interactionType=11）。
 *
 * 规则：
 * - 题面/播放/生成 UI 以本组件为准
 * - play：C 端收听；studio：B 端预览与微调
 * - 双端 adapter 只注入数据、处理 generate-audio / 提交等副作用
 * - 视觉偏 H5 扁平流，避免多层卡片嵌套
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import {
  NARRATION_AUDIO_STATUS,
  type GameplayPreviewNarrationStatus,
  type NarrationRendererDraft,
  type RendererSurfaceMode,
} from "../../contracts"
import StudioField from "../StudioField.vue"

interface Props {
  mode?: RendererSurfaceMode
  title?: string | null
  exhibitName?: string | null
  guideName?: string | null
  guideId?: string | null
  style?: string | null
  sceneContext?: string | null
  targetDurationSeconds?: number | null
  narrationText?: string | null
  audioUrl?: string | null
  audioStatus?: number | null
  durationMs?: number | null
  status?: GameplayPreviewNarrationStatus
  errorMessage?: string | null
  generatingAudio?: boolean
  /** play 模式是否展示完成/跳过（H5 可自带 footer slot 时关掉） */
  showPlayActions?: boolean
  completing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: "play",
  title: "",
  exhibitName: "",
  guideName: "",
  guideId: "",
  style: "",
  sceneContext: "",
  targetDurationSeconds: null,
  narrationText: "",
  audioUrl: "",
  audioStatus: NARRATION_AUDIO_STATUS.NotGenerated,
  durationMs: null,
  status: "ready",
  errorMessage: "",
  generatingAudio: false,
  showPlayActions: true,
  completing: false,
})

const emit = defineEmits<{
  "generate-audio": []
  complete: []
  skip: []
  "update:draft": [draft: NarrationRendererDraft]
  /** studio：打开导游列表选择 */
  "pick-guide": []
}>()

const isStudio = computed(() => props.mode === "studio")

const draftTitle = ref("")
const draftText = ref("")
const draftScene = ref("")
const draftDuration = ref(90)

/** studio：场景上下文弹层编辑 */
type MetaEditField = "scene" | null
const metaEditField = ref<MetaEditField>(null)
const metaEditBuffer = ref("")
const metaEditTextareaRef = ref<HTMLTextAreaElement | null>(null)

const metaEditTitle = computed(() =>
  metaEditField.value === "scene" ? "场景上下文" : "",
)

const metaEditPlaceholder = computed(() =>
  metaEditField.value === "scene"
    ? "例如：上海博物馆东馆 · 青铜馆展厅；观众站在展柜前，背景有人流。"
    : "",
)

const openMetaEdit = (field: "scene") => {
  if (!isStudio.value) {
    return
  }
  metaEditField.value = field
  metaEditBuffer.value = draftScene.value
  void nextTick(() => {
    const el = metaEditTextareaRef.value
    if (!el) {
      return
    }
    el.focus()
    const len = el.value.length
    el.setSelectionRange(len, len)
  })
}

const closeMetaEdit = () => {
  metaEditField.value = null
  metaEditBuffer.value = ""
}

const confirmMetaEdit = () => {
  if (metaEditField.value === "scene") {
    draftScene.value = metaEditBuffer.value.trim()
  }
  closeMetaEdit()
  emitDraft()
}

const truncateMeta = (value: string, max = 28) => {
  const text = value.trim()
  if (!text) {
    return ""
  }
  return text.length > max ? `${text.slice(0, max)}…` : text
}

const openGuidePicker = () => {
  if (!isStudio.value) {
    return
  }
  emit("pick-guide")
}

const syncDraftFromProps = () => {
  draftTitle.value = String(props.title || props.exhibitName || "").trim()
  draftText.value = String(props.narrationText || "").trim()
  draftScene.value = String(props.sceneContext || "").trim()
  const sec = Number(props.targetDurationSeconds)
  draftDuration.value = Number.isFinite(sec) && sec > 0 ? Math.round(sec) : 90
}

watch(
  () => [
    props.title,
    props.exhibitName,
    props.narrationText,
    props.sceneContext,
    props.guideId,
    props.guideName,
    props.targetDurationSeconds,
  ] as const,
  () => {
    // 弹层编辑中不要被 props 回写冲掉缓冲区外的草稿
    if (metaEditField.value) {
      return
    }
    syncDraftFromProps()
  },
  { immediate: true },
)

const emitDraft = () => {
  if (!isStudio.value) {
    return
  }

  emit("update:draft", {
    title: draftTitle.value.trim(),
    narrationText: draftText.value,
    sceneContext: draftScene.value.trim(),
    guideId: String(props.guideId || "").trim() || undefined,
    guideName: String(props.guideName || "").trim() || undefined,
    targetDurationSeconds: Math.max(1, Math.round(Number(draftDuration.value) || 90)),
  })
}

const displayTitle = computed(() => {
  if (isStudio.value) {
    return draftTitle.value || "未命名节点"
  }

  // 与编辑一致：节点 title 优先，其次 exhibitName
  return String(props.title || props.exhibitName || "当前文物").trim() || "当前文物"
})

const displayText = computed(() => {
  if (isStudio.value) {
    return draftText.value
  }

  return String(props.narrationText || "").trim()
})

const guideLabel = computed(() => {
  const name = String(props.guideName || "").trim()
  if (name) {
    return name
  }

  const id = String(props.guideId || "").trim()
  return id ? `讲解 ${id}` : ""
})

const targetDurationSec = computed(() => {
  if (isStudio.value) {
    return Math.max(1, Math.round(Number(draftDuration.value) || 90))
  }

  const sec = Number(props.targetDurationSeconds)
  if (Number.isFinite(sec) && sec > 0) {
    return Math.round(sec)
  }

  return 90
})

const resolvedAudioStatus = computed(() => {
  const status = props.audioStatus
  return typeof status === "number" && Number.isFinite(status)
    ? status
    : NARRATION_AUDIO_STATUS.NotGenerated
})

const audioUrl = computed(() => String(props.audioUrl || "").trim())
const hasAudio = computed(() => Boolean(audioUrl.value))

const audioBusy = computed(() => {
  if (props.generatingAudio) {
    return true
  }

  return (
    resolvedAudioStatus.value === NARRATION_AUDIO_STATUS.Queued
    || resolvedAudioStatus.value === NARRATION_AUDIO_STATUS.Generating
  )
})

const generateLabel = computed(() => {
  if (props.generatingAudio || resolvedAudioStatus.value === NARRATION_AUDIO_STATUS.Queued) {
    return "排队中…"
  }

  if (resolvedAudioStatus.value === NARRATION_AUDIO_STATUS.Generating) {
    return "生成中…"
  }

  if (resolvedAudioStatus.value === NARRATION_AUDIO_STATUS.Failed) {
    return "重试生成"
  }

  if (hasAudio.value || resolvedAudioStatus.value === NARRATION_AUDIO_STATUS.Stale) {
    return "重新生成"
  }

  return "生成解说"
})

const canGenerate = computed(() => {
  if (audioBusy.value || props.completing) {
    return false
  }

  if (props.status === "loading") {
    return false
  }

  return Boolean(displayText.value.trim())
})

// —— 自定义播放器 ——
const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

const formatTime = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) {
    return "0:00"
  }

  const total = Math.floor(sec)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

const progress = computed(() => {
  if (!duration.value) {
    return 0
  }

  return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100))
})

const durationLabel = computed(() => {
  if (duration.value > 0) {
    return formatTime(duration.value)
  }

  const ms = props.durationMs
  if (typeof ms === "number" && Number.isFinite(ms) && ms > 0) {
    return formatTime(ms / 1000)
  }

  return formatTime(targetDurationSec.value)
})

const stopPlayback = () => {
  const el = audioRef.value
  if (!el) {
    return
  }

  el.pause()
  isPlaying.value = false
}

const togglePlay = async () => {
  const el = audioRef.value
  if (!el || !hasAudio.value || audioBusy.value) {
    return
  }

  if (isPlaying.value) {
    el.pause()
    isPlaying.value = false
    return
  }

  try {
    await el.play()
    isPlaying.value = true
  } catch {
    isPlaying.value = false
  }
}

const onTimeUpdate = () => {
  const el = audioRef.value
  if (!el) {
    return
  }

  currentTime.value = el.currentTime || 0
}

const onLoadedMeta = () => {
  const el = audioRef.value
  if (!el) {
    return
  }

  duration.value = Number.isFinite(el.duration) ? el.duration : 0
}

const onEnded = () => {
  isPlaying.value = false
  currentTime.value = 0
}

const seekToRatio = (ratio: number) => {
  const el = audioRef.value
  if (!el || !duration.value) {
    return
  }

  const next = Math.min(1, Math.max(0, ratio)) * duration.value
  el.currentTime = next
  currentTime.value = next
}

const onTrackPointer = (event: PointerEvent) => {
  if (!hasAudio.value || !duration.value) {
    return
  }

  const track = event.currentTarget as HTMLElement
  const rect = track.getBoundingClientRect()
  if (rect.width <= 0) {
    return
  }

  seekToRatio((event.clientX - rect.left) / rect.width)
}

watch(audioUrl, () => {
  stopPlayback()
  currentTime.value = 0
  duration.value = 0
})

onBeforeUnmount(() => {
  stopPlayback()
})

const requestGenerate = () => {
  if (!canGenerate.value) {
    return
  }

  stopPlayback()
  emit("generate-audio")
}

const playerLabel = computed(() => {
  if (audioBusy.value) {
    return "语音生成中"
  }

  if (!hasAudio.value) {
    return "语音待生成"
  }

  if (isPlaying.value) {
    return "正在收听"
  }

  return "语音导览"
})

const metaChips = computed(() => {
  const chips: string[] = []
  if (guideLabel.value) {
    chips.push(guideLabel.value)
  }

  const style = String(props.style || "").trim()
  if (style) {
    chips.push(style)
  }

  const scene = isStudio.value ? draftScene.value.trim() : String(props.sceneContext || "").trim()
  if (scene) {
    chips.push(scene)
  }

  chips.push(`${targetDurationSec.value}s`)
  return chips
})
</script>

<template>
  <div class="nr" :class="isStudio ? 'is-studio' : 'is-play'">
    <!-- 上半：标题 + 播放 + 元信息（放大、扁平） -->
    <section class="nr-top">
      <header class="nr-head">
        <StudioField
          v-if="isStudio"
          v-model="draftTitle"
          label="节点标题"
          placeholder="解说节点名称"
          @change="emitDraft" />
        <template v-else>
          <h3 class="nr-title">
            {{ displayTitle }}
          </h3>
          <p v-if="guideLabel" class="nr-sub">
            {{ guideLabel }}
          </p>
        </template>
      </header>

      <div
        class="nr-player"
        :class="{
          'is-playing': isPlaying,
          'is-ready': hasAudio && !audioBusy,
          'is-busy': audioBusy,
          'is-empty': !hasAudio && !audioBusy,
        }">
        <audio
          :key="audioUrl || 'empty'"
          ref="audioRef"
          class="nr-audio-hidden"
          :src="audioUrl || undefined"
          preload="metadata"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMeta"
          @ended="onEnded"
          @pause="isPlaying = false"
          @play="isPlaying = true" />

        <button
          type="button"
          class="nr-orb"
          :disabled="!hasAudio || audioBusy"
          :title="isPlaying ? '暂停' : '播放'"
          :style="{ '--progress': `${progress}%` }"
          @click="togglePlay">
          <span class="nr-orb__ring" aria-hidden="true" />
          <span class="nr-orb__core">
            <svg v-if="!isPlaying" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 7.2v9.6l7.8-4.8L9 7.2Z" fill="currentColor" />
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 7h2.8v10H8V7Zm5.2 0H16v10h-2.8V7Z" fill="currentColor" />
            </svg>
          </span>
        </button>

        <div class="nr-player-main">
          <div class="nr-player-row">
            <span class="nr-player-label">{{ playerLabel }}</span>
            <button
              type="button"
              class="nr-gen"
              :disabled="!canGenerate"
              @click="requestGenerate">
              {{ generateLabel }}
            </button>
          </div>

          <button
            type="button"
            class="nr-track"
            :disabled="!hasAudio || !duration"
            :aria-label="`进度 ${formatTime(currentTime)} / ${durationLabel}`"
            @pointerdown="onTrackPointer">
            <span class="nr-track__rail" aria-hidden="true" />
            <span
              class="nr-track__fill"
              aria-hidden="true"
              :style="{ width: `${progress}%` }" />
            <span
              class="nr-track__knob"
              aria-hidden="true"
              :style="{ left: `${progress}%` }" />
          </button>

          <div class="nr-time">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ durationLabel }}</span>
          </div>
        </div>
      </div>

      <p
        v-if="!hasAudio && !audioBusy && !displayText"
        class="nr-player-hint">
        暂无解说词，生成语音需先有文本
      </p>
      <p
        v-else-if="resolvedAudioStatus === NARRATION_AUDIO_STATUS.Stale"
        class="nr-player-hint">
        文本已更新，建议重新生成语音
      </p>

      <div v-if="isStudio" class="nr-studio-meta">
        <!-- 导游选择：点击由宿主打开导游列表 -->
        <div class="nr-meta-field">
          <span class="nr-meta-field__label">导游</span>
          <button
            type="button"
            class="nr-meta-field__control"
            title="点击选择导游"
            @click="openGuidePicker">
            <span
              class="nr-meta-field__value"
              :class="{ 'is-empty': !guideLabel }">
              {{ truncateMeta(guideLabel) || "点击选择…" }}
            </span>
          </button>
        </div>
        <div class="nr-meta-field">
          <span class="nr-meta-field__label">场景上下文</span>
          <button
            type="button"
            class="nr-meta-field__control"
            title="点击编辑场景上下文"
            @click="openMetaEdit('scene')">
            <span
              class="nr-meta-field__value"
              :class="{ 'is-empty': !draftScene.trim() }">
              {{ truncateMeta(draftScene) || "点击编辑…" }}
            </span>
          </button>
        </div>
        <StudioField
          v-model="draftDuration"
          class="nr-field--sm"
          label="目标时长(秒)"
          type="number"
          :min="1"
          :max="600"
          @change="emitDraft" />
      </div>
      <div v-else-if="metaChips.length" class="nr-chips">
        <span v-for="chip in metaChips" :key="chip">{{ chip }}</span>
      </div>
    </section>

    <!-- 下半：解说词（始终可见，可滚动） -->
    <section class="nr-script">
      <div v-if="props.status === 'loading'" class="nr-script-state">
        正在加载解说词…
      </div>
      <div v-else-if="props.status === 'error'" class="nr-script-state is-error">
        {{ props.errorMessage || "解说词加载失败" }}
      </div>
      <StudioField
        v-else-if="isStudio"
        v-model="draftText"
        class="nr-script-field"
        label="解说词"
        type="textarea"
        :rows="8"
        placeholder="在此微调解说词正文…"
        @change="emitDraft" />
      <template v-else>
        <div class="nr-script-label">
          解说词
        </div>
        <div v-if="displayText" class="nr-script-body">
          {{ displayText }}
        </div>
        <div v-else class="nr-script-state">
          暂无解说词
        </div>
      </template>
    </section>

    <footer v-if="!isStudio && showPlayActions" class="nr-actions">
      <button
        type="button"
        class="nr-btn nr-btn--primary"
        :disabled="props.completing || !hasAudio"
        @click="emit('complete')">
        {{ props.completing ? "提交中…" : "听完了，继续" }}
      </button>
      <button
        type="button"
        class="nr-btn"
        :disabled="props.completing"
        @click="emit('skip')">
        {{ props.completing ? "提交中…" : "跳过解说" }}
      </button>
    </footer>

    <slot name="footer" />

    <!-- studio：场景上下文弹层编辑；挂 body 以盖住后台 Dialog -->
    <Teleport to="body">
      <div
        v-if="isStudio && metaEditField"
        class="nr-meta-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="metaEditTitle"
        @keydown.esc.stop.prevent="closeMetaEdit">
        <button
          type="button"
          class="nr-meta-modal__mask"
          aria-label="关闭"
          @click="closeMetaEdit" />
        <div class="nr-meta-modal__panel" @click.stop>
          <header class="nr-meta-modal__head">
            <h4 class="nr-meta-modal__title">{{ metaEditTitle }}</h4>
            <button
              type="button"
              class="nr-meta-modal__x"
              title="关闭"
              @click="closeMetaEdit">
              ×
            </button>
          </header>
          <textarea
            ref="metaEditTextareaRef"
            v-model="metaEditBuffer"
            class="nr-meta-modal__textarea"
            rows="8"
            :placeholder="metaEditPlaceholder"
            @keydown.enter.ctrl.prevent="confirmMetaEdit"
            @keydown.enter.meta.prevent="confirmMetaEdit" />
          <footer class="nr-meta-modal__foot">
            <button type="button" class="nr-meta-modal__btn" @click="closeMetaEdit">
              取消
            </button>
            <button
              type="button"
              class="nr-meta-modal__btn nr-meta-modal__btn--primary"
              @click="confirmMetaEdit">
              确定
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.nr {
  display: flex;
  height: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  color: #fff8ea;
}

/* —— 上半区：更大、更扁平 —— */
.nr-top {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
}

.nr-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nr-title {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  line-height: 1.35;
  letter-spacing: 0.01em;
}

.nr-sub {
  margin: 0;
  color: rgb(247 239 221 / 55%);
  font-size: 12px;
}

/* —— 播放器：导览听筒，非传统 audio 条 —— */
.nr-player {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 2px 0 4px;
}

.nr-audio-hidden {
  display: none;
}

.nr-orb {
  --progress: 0%;
  position: relative;
  display: grid;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #1a160d;
  cursor: pointer;
}

.nr-orb__ring {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background:
    conic-gradient(
      from -90deg,
      #e8d18a 0 var(--progress),
      rgb(255 255 255 / 10%) var(--progress) 100%
    );
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
  transition: filter 0.2s ease;
}

.nr-orb__core {
  position: relative;
  z-index: 1;
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 999px;
  background: linear-gradient(155deg, #f0dfb0 0%, #c9a75a 100%);
  box-shadow:
    0 6px 16px rgb(209 178 111 / 22%),
    inset 0 1px 0 rgb(255 255 255 / 35%);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.nr-orb__core svg {
  width: 20px;
  height: 20px;
  margin-left: 1px;
}

.nr-orb:hover:not(:disabled) .nr-orb__core {
  transform: scale(1.04);
  box-shadow:
    0 8px 18px rgb(209 178 111 / 28%),
    inset 0 1px 0 rgb(255 255 255 / 4%);
}

.nr-orb:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.nr-player.is-playing .nr-orb__ring {
  filter: drop-shadow(0 0 6px rgb(232 209 138 / 35%));
}

.nr-player.is-playing .nr-orb__core {
  animation: nr-orb-breathe 1.8s ease-in-out infinite;
}

.nr-player.is-busy .nr-orb__ring {
  background: conic-gradient(from -90deg, #e8d18a, transparent 55%, #e8d18a);
  animation: nr-orb-spin 1.1s linear infinite;
}

.nr-player-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.nr-player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.nr-player-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(209 178 111 / 78%);
}

.nr-player.is-playing .nr-player-label {
  color: #f0dfb0;
}

.nr-track {
  position: relative;
  display: block;
  width: 100%;
  height: 18px;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.nr-track:disabled {
  cursor: default;
  opacity: 0.55;
}

.nr-track__rail,
.nr-track__fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 3px;
  border-radius: 999px;
  transform: translateY(-50%);
}

.nr-track__rail {
  width: 100%;
  background: rgb(255 255 255 / 10%);
}

.nr-track__fill {
  background: linear-gradient(90deg, #b8924a, #e8d18a);
  box-shadow: 0 0 10px rgb(232 209 138 / 25%);
}

.nr-track__knob {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #fff6e4;
  box-shadow: 0 0 0 3px rgb(209 178 111 / 22%);
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.nr-player.is-ready .nr-track:hover .nr-track__knob,
.nr-player.is-playing .nr-track__knob {
  opacity: 1;
}

.nr-time {
  display: flex;
  justify-content: space-between;
  color: rgb(247 239 221 / 42%);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.nr-gen {
  height: 28px;
  flex-shrink: 0;
  border: 1px solid rgb(209 178 111 / 28%);
  border-radius: 999px;
  background: rgb(209 178 111 / 10%);
  padding: 0 11px;
  color: #f0dfb0;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.nr-gen:hover:not(:disabled) {
  border-color: rgb(209 178 111 / 48%);
  background: rgb(209 178 111 / 16%);
}

.nr-gen:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.nr-player-hint {
  margin: 0;
  color: rgb(247 239 221 / 48%);
  font-size: 11px;
  line-height: 1.4;
}

@keyframes nr-orb-breathe {
  0%,
  100% {
    box-shadow:
      0 6px 16px rgb(209 178 111 / 22%),
      inset 0 1px 0 rgb(255 255 255 / 35%);
  }
  50% {
    box-shadow:
      0 8px 22px rgb(209 178 111 / 36%),
      inset 0 1px 0 rgb(255 255 255 / 4%);
  }
}

@keyframes nr-orb-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .nr-player.is-playing .nr-orb__core,
  .nr-player.is-busy .nr-orb__ring {
    animation: none;
  }
}

.nr-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.nr-chips span {
  color: rgb(247 239 221 / 58%);
  font-size: 11px;
}

.nr-chips span:not(:last-child)::after {
  content: "·";
  margin-left: 6px;
  opacity: 0.5;
}

.nr-studio-meta {
  display: grid;
  grid-template-columns: 1fr 1fr 88px;
  gap: 10px;
}

.nr-field--sm {
  min-width: 0;
}

/* 风格 / 场景：label + 可点击 value（形态对齐 StudioField input） */
.nr-meta-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.nr-meta-field__label {
  color: rgb(209 178 111 / 78%);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.nr-meta-field__control {
  display: block;
  width: 100%;
  min-width: 0;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 7px;
  background: rgb(0 0 0 / 20%);
  padding: 6px 8px;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.nr-meta-field__control:hover {
  border-color: rgb(209 178 111 / 42%);
  background: rgb(209 178 111 / 8%);
}

.nr-meta-field__control:focus-visible {
  border-color: rgb(209 178 111 / 42%);
  outline: none;
}

.nr-meta-field__value {
  display: block;
  overflow: hidden;
  color: #fff8ea;
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nr-meta-field__value.is-empty {
  color: rgb(247 239 221 / 32%);
}

.nr-meta-modal {
  position: fixed;
  inset: 0;
  /* 高于 web-admin Dialog 的 z-50 */
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 16px;
}

.nr-meta-modal__mask {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgb(0 0 0 / 55%);
  cursor: pointer;
}

.nr-meta-modal__panel {
  position: relative;
  z-index: 1;
  display: flex;
  width: min(100%, 420px);
  max-height: min(80vh, 520px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgb(209 178 111 / 22%);
  border-radius: 12px;
  background: linear-gradient(180deg, #1a1814 0%, #12110e 100%);
  box-shadow: 0 18px 48px rgb(0 0 0 / 45%);
}

.nr-meta-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px 8px;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
}

.nr-meta-modal__title {
  margin: 0;
  color: #f0dfb0;
  font-size: 14px;
  font-weight: 650;
}

.nr-meta-modal__x {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgb(247 239 221 / 65%);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.nr-meta-modal__x:hover {
  background: rgb(255 255 255 / 6%);
  color: #fff8ea;
}

.nr-meta-modal__textarea {
  flex: 1 1 auto;
  min-height: 180px;
  margin: 12px 14px 0;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 8px;
  background: rgb(0 0 0 / 28%);
  padding: 10px 12px;
  color: #fff8ea;
  font: inherit;
  font-size: 13px;
  line-height: 1.55;
  resize: vertical;
  outline: none;
}

.nr-meta-modal__textarea:focus {
  border-color: rgb(209 178 111 / 42%);
}

.nr-meta-modal__textarea::placeholder {
  color: rgb(247 239 221 / 32%);
}

.nr-meta-modal__foot {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 14px 14px;
  border-top: 1px solid rgb(255 255 255 / 6%);
  margin-top: 12px;
}

.nr-meta-modal__btn {
  min-height: 32px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 8px;
  background: transparent;
  padding: 0 12px;
  color: #fff8ea;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.nr-meta-modal__btn--primary {
  border: 0;
  background: linear-gradient(145deg, #e0c384, #c4a35a);
  color: #1a160f;
}

.nr-meta-modal__btn:hover {
  border-color: rgb(209 178 111 / 35%);
}

.nr-meta-modal__btn--primary:hover {
  filter: brightness(1.04);
}

/* —— 解说词：保证可见，占剩余高度 —— */
.nr-script {
  display: flex;
  min-height: 180px;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.nr-script-label {
  flex-shrink: 0;
  color: rgb(209 178 111 / 80%);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.nr-script-body {
  min-height: 140px;
  flex: 1 1 auto;
  overflow-y: auto;
  color: rgb(247 239 221 / 88%);
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.nr-script-field {
  display: flex;
  min-height: 160px;
  flex: 1 1 auto;
  flex-direction: column;
}

.nr-script-field :deep(textarea.sf__control) {
  min-height: 160px;
  flex: 1 1 auto;
  font-size: 14px;
  line-height: 1.7;
}

.nr-script-state {
  min-height: 80px;
  color: rgb(247 239 221 / 52%);
  font-size: 13px;
  line-height: 1.5;
}

.nr-script-state.is-error {
  color: #f0b4b4;
}

.nr-actions {
  display: grid;
  flex-shrink: 0;
  gap: 8px;
}

.nr-btn {
  min-height: 42px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 10px;
  background: transparent;
  color: #fff8ea;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.nr-btn--primary {
  border: 0;
  background: #d1b26f;
  color: #1a160f;
}

.nr-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 420px) {
  .nr-studio-meta {
    grid-template-columns: 1fr 1fr;
  }

  .nr-field--sm {
    width: auto;
    grid-column: 1 / -1;
  }
}
</style>
