<script setup lang="ts">
/**
 * 解说导览渲染：音频播放 + 封面轮播 / 解说词互切（类似专辑封面与歌词）。
 * 配图来自 detail.images；不再展示 config 的 user_style_input / scene_context。
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import { gsap } from "gsap"
import {
  NARRATION_AUDIO_STATUS,
  type GameplayPreviewNarrationStatus,
  type NarrationImageItem,
} from "../../contracts"
import ImageCarousel from "../ImageCarousel.vue"

type MediaView = "cover" | "lyrics"

interface Props {
  title?: string | null
  exhibitName?: string | null
  guideName?: string | null
  guideId?: string | null
  /** @deprecated 渲染侧不再展示风格文案 */
  style?: string | null
  /** @deprecated 渲染侧不再展示场景说明 */
  sceneContext?: string | null
  targetDurationSeconds?: number | null
  narrationText?: string | null
  audioUrl?: string | null
  audioStatus?: number | null
  durationMs?: number | null
  images?: NarrationImageItem[] | null
  status?: GameplayPreviewNarrationStatus
  errorMessage?: string | null
  showPlayActions?: boolean
  completing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
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
  images: () => [],
  status: "ready",
  errorMessage: "",
  showPlayActions: true,
  completing: false,
})

const emit = defineEmits<{
  complete: []
  skip: []
}>()

const displayTitle = computed(() =>
  String(props.title || props.exhibitName || "当前文物").trim() || "当前文物",
)
const displayText = computed(() => String(props.narrationText || "").trim())
const guideLabel = computed(() => {
  const name = String(props.guideName || "").trim()
  if (name) return name
  const id = String(props.guideId || "").trim()
  return id ? `讲解 ${id}` : ""
})
const targetDurationSec = computed(() => {
  const sec = Number(props.targetDurationSeconds)
  return Number.isFinite(sec) && sec > 0 ? Math.round(sec) : 90
})
const resolvedAudioStatus = computed(() => {
  const status = props.audioStatus
  return typeof status === "number" && Number.isFinite(status)
    ? status
    : NARRATION_AUDIO_STATUS.NotGenerated
})
const audioUrl = computed(() => String(props.audioUrl || "").trim())
const hasAudio = computed(() => Boolean(audioUrl.value))
const audioBusy = computed(() =>
  resolvedAudioStatus.value === NARRATION_AUDIO_STATUS.Queued
  || resolvedAudioStatus.value === NARRATION_AUDIO_STATUS.Generating,
)

const imageUrls = computed(() =>
  [...(props.images || [])]
    .sort((left, right) => Number(left?.sortOrder ?? 0) - Number(right?.sortOrder ?? 0))
    .map((item) => String(item?.imageUrl || "").trim())
    .filter(Boolean),
)
const hasImages = computed(() => imageUrls.value.length > 0)

const mediaView = ref<MediaView>("cover")
const mediaRoot = ref<HTMLElement | null>(null)
let mediaCtx: gsap.Context | null = null

const setMediaView = async (next: MediaView) => {
  if (mediaView.value === next) return
  // 无配图时不允许切到封面
  if (next === "cover" && !hasImages.value) return

  mediaView.value = next
  await nextTick()
  const root = mediaRoot.value
  if (!root) return

  mediaCtx?.revert()
  mediaCtx = gsap.context(() => {
    const panel = root.querySelector<HTMLElement>("[data-media-panel].is-active")
    if (!panel) return
    gsap.fromTo(
      panel,
      { autoAlpha: 0, y: 10, scale: 0.985 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: "power2.out" },
    )
  }, root)
}

watch(
  hasImages,
  (ok) => {
    // 无配图时默认解说词；有配图时默认封面
    mediaView.value = ok ? "cover" : "lyrics"
  },
  { immediate: true },
)

const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

const formatTime = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) return "0:00"
  const total = Math.floor(sec)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

const progress = computed(() =>
  duration.value ? Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100)) : 0,
)
const durationLabel = computed(() => {
  if (duration.value > 0) return formatTime(duration.value)
  const ms = props.durationMs
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0
    ? formatTime(ms / 1000)
    : formatTime(targetDurationSec.value)
})

const stopPlayback = () => {
  const el = audioRef.value
  if (!el) return
  el.pause()
  isPlaying.value = false
}

const togglePlay = async () => {
  const el = audioRef.value
  if (!el || !hasAudio.value || audioBusy.value) return
  if (isPlaying.value) {
    stopPlayback()
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
  currentTime.value = audioRef.value?.currentTime || 0
}
const onLoadedMeta = () => {
  const next = audioRef.value?.duration
  duration.value = typeof next === "number" && Number.isFinite(next) ? next : 0
}
const onEnded = () => {
  isPlaying.value = false
  currentTime.value = 0
}
const seekToRatio = (ratio: number) => {
  const el = audioRef.value
  if (!el || !duration.value) return
  const next = Math.min(1, Math.max(0, ratio)) * duration.value
  el.currentTime = next
  currentTime.value = next
}
const onTrackPointer = (event: PointerEvent) => {
  if (!hasAudio.value || !duration.value) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (rect.width > 0) seekToRatio((event.clientX - rect.left) / rect.width)
}

watch(audioUrl, () => {
  stopPlayback()
  currentTime.value = 0
  duration.value = 0
})

onBeforeUnmount(() => {
  stopPlayback()
  mediaCtx?.revert()
  mediaCtx = null
})

const playerLabel = computed(() => {
  if (audioBusy.value) return "语音生成中"
  if (!hasAudio.value) return "语音暂未就绪"
  return isPlaying.value ? "正在收听" : "语音导览"
})
</script>

<template>
  <div class="nr is-play">
    <section class="nr-top">
      <header class="nr-head">
        <h3 class="nr-title">
          {{ displayTitle }}
        </h3>
        <p v-if="guideLabel" class="nr-sub">
          {{ guideLabel }}
        </p>
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
          </div>
          <button
            type="button"
            class="nr-track"
            :disabled="!hasAudio || !duration"
            :aria-label="`进度 ${formatTime(currentTime)} / ${durationLabel}`"
            @pointerdown="onTrackPointer">
            <span class="nr-track__rail" aria-hidden="true" />
            <span class="nr-track__fill" aria-hidden="true" :style="{ width: `${progress}%` }" />
            <span class="nr-track__knob" aria-hidden="true" :style="{ left: `${progress}%` }" />
          </button>
          <div class="nr-time">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ durationLabel }}</span>
          </div>
        </div>
      </div>

      <p v-if="!hasAudio && !audioBusy" class="nr-player-hint">
        {{ displayText ? "语音正在准备中" : "暂无解说词" }}
      </p>
      <p v-else-if="resolvedAudioStatus === NARRATION_AUDIO_STATUS.Stale" class="nr-player-hint">
        解说词已更新，语音正在更新中
      </p>
    </section>

    <!-- 封面 / 解说词：类似播放器专辑封面与歌词切换 -->
    <section class="nr-media">
      <div class="nr-media-toggle" role="tablist" aria-label="展示切换">
        <button
          type="button"
          role="tab"
          class="nr-media-tab"
          :class="{ 'is-active': mediaView === 'cover' }"
          :aria-selected="mediaView === 'cover'"
          :disabled="!hasImages"
          @click="setMediaView('cover')">
          封面
        </button>
        <button
          type="button"
          role="tab"
          class="nr-media-tab"
          :class="{ 'is-active': mediaView === 'lyrics' }"
          :aria-selected="mediaView === 'lyrics'"
          @click="setMediaView('lyrics')">
          解说词
        </button>
      </div>

      <div ref="mediaRoot" class="nr-media-stage">
        <div
          v-show="mediaView === 'cover'"
          data-media-panel
          class="nr-media-panel"
          :class="{ 'is-active': mediaView === 'cover' }">
          <ImageCarousel :images="imageUrls" :autoplay="mediaView === 'cover'" />
        </div>

        <div
          v-show="mediaView === 'lyrics'"
          data-media-panel
          class="nr-media-panel nr-media-panel--lyrics"
          :class="{ 'is-active': mediaView === 'lyrics' }">
          <div v-if="props.status === 'loading'" class="nr-script-state">正在加载解说词…</div>
          <div v-else-if="props.status === 'error'" class="nr-script-state is-error">
            {{ props.errorMessage || "解说词加载失败" }}
          </div>
          <template v-else>
            <div class="nr-script-label">解说词</div>
            <div v-if="displayText" class="nr-script-body">{{ displayText }}</div>
            <div v-else class="nr-script-state">暂无解说词</div>
          </template>
        </div>
      </div>
    </section>

    <footer v-if="showPlayActions" class="nr-actions">
      <button
        type="button"
        class="nr-btn nr-btn--primary"
        :disabled="props.completing"
        @click="emit('complete')">
        {{ props.completing ? "提交中…" : "听完了，继续" }}
      </button>
      <button type="button" class="nr-btn" :disabled="props.completing" @click="emit('skip')">
        {{ props.completing ? "提交中…" : "跳过解说" }}
      </button>
    </footer>

    <slot name="footer" />
  </div>
</template>

<style scoped>
.nr {
  display: flex;
  height: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  color: #fff8ea;
}

.nr-top {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 10px;
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

/* —— 封面 / 解说词切换 —— */
.nr-media {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
}

.nr-media-toggle {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: rgb(255 255 255 / 5%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 6%);
}

.nr-media-tab {
  min-height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgb(247 239 221 / 55%);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.nr-media-tab.is-active {
  background: rgb(209 178 111 / 16%);
  color: #f0dfb0;
  box-shadow: inset 0 0 0 1px rgb(209 178 111 / 28%);
}

.nr-media-tab:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.nr-media-stage {
  position: relative;
  display: flex;
  min-height: 200px;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
}

.nr-media-panel {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.nr-media-panel--lyrics {
  gap: 8px;
  overflow: hidden;
  border-radius: 12px;
  background: rgb(0 0 0 / 18%);
  padding: 12px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 6%);
}

.nr-script-label {
  flex-shrink: 0;
  color: rgb(209 178 111 / 80%);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.nr-script-body {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  color: rgb(247 239 221 / 88%);
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
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
</style>
