<script setup lang="ts">
/**
 * 解说导览：博物馆音频播放器。
 * 封面（看）与解说词（词）二选一；点「词」从播放器区上滑盖住播放器，仿 Apple Music 歌词。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { gsap } from "gsap"
import {
  NARRATION_AUDIO_STATUS,
  type GameplayPreviewNarrationStatus,
  type NarrationImageItem,
} from "../../contracts"
import ImageCarousel from "../ImageCarousel.vue"

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

/** true=词模式（盖住播放器）；false=封面+播放器 */
const lyricsOpen = ref(false)
const mediaRef = ref<HTMLElement | null>(null)
const lyricsRef = ref<HTMLElement | null>(null)
let lyricsTween: gsap.core.Tween | null = null

const applyLyricsOpen = async (open: boolean, animate: boolean) => {
  lyricsOpen.value = open
  await nextTick()
  const panel = lyricsRef.value
  if (!panel) return

  lyricsTween?.kill()
  if (!animate) {
    gsap.set(panel, {
      yPercent: open ? 0 : 100,
      autoAlpha: open ? 1 : 0,
    })
    return
  }

  if (open) {
    gsap.set(panel, { yPercent: 100, autoAlpha: 1 })
    lyricsTween = gsap.to(panel, {
      yPercent: 0,
      duration: 0.48,
      ease: "power3.out",
      overwrite: "auto",
    })
  } else {
    lyricsTween = gsap.to(panel, {
      yPercent: 100,
      duration: 0.4,
      ease: "power2.inOut",
      overwrite: "auto",
      onComplete: () => {
        gsap.set(panel, { autoAlpha: 0 })
      },
    })
  }
}

const openLyrics = () => {
  if (!hasImages.value) return
  void applyLyricsOpen(true, true)
}

const closeLyrics = () => {
  if (!hasImages.value) return
  void applyLyricsOpen(false, true)
}

const toggleLyrics = () => {
  if (!hasImages.value) return
  void applyLyricsOpen(!lyricsOpen.value, true)
}

watch(
  hasImages,
  async (ok) => {
    await nextTick()
    if (!ok) {
      lyricsOpen.value = true
      return
    }
    void applyLyricsOpen(false, false)
  },
  { immediate: true },
)

onMounted(async () => {
  await nextTick()
  if (hasImages.value) void applyLyricsOpen(false, false)
})

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

const seekBy = (deltaSec: number) => {
  const el = audioRef.value
  if (!el || !hasAudio.value) return
  const base = duration.value || el.duration || 0
  if (!base) return
  const next = Math.min(base, Math.max(0, (el.currentTime || 0) + deltaSec))
  el.currentTime = next
  currentTime.value = next
}

const scrubbing = ref(false)
let scrubEl: HTMLElement | null = null

const ratioFromEvent = (event: PointerEvent, el: HTMLElement) => {
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0) return 0
  return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
}

const onTrackPointerDown = (event: PointerEvent) => {
  if (!hasAudio.value || !duration.value) return
  scrubbing.value = true
  scrubEl = event.currentTarget as HTMLElement
  scrubEl.setPointerCapture?.(event.pointerId)
  seekToRatio(ratioFromEvent(event, scrubEl))
}

const onTrackPointerMove = (event: PointerEvent) => {
  if (!scrubbing.value || !scrubEl) return
  seekToRatio(ratioFromEvent(event, scrubEl))
}

const onTrackPointerUp = (event: PointerEvent) => {
  if (!scrubbing.value) return
  if (scrubEl) {
    seekToRatio(ratioFromEvent(event, scrubEl))
    scrubEl.releasePointerCapture?.(event.pointerId)
  }
  scrubbing.value = false
  scrubEl = null
}

watch(audioUrl, () => {
  stopPlayback()
  currentTime.value = 0
  duration.value = 0
})

onBeforeUnmount(() => {
  stopPlayback()
  lyricsTween?.kill()
  lyricsTween = null
})

const playerLabel = computed(() => {
  if (audioBusy.value) return "语音生成中"
  if (!hasAudio.value) return "语音暂未就绪"
  return isPlaying.value ? "正在播放" : "已暂停"
})

const remainingLabel = computed(() => {
  if (duration.value > 0) {
    const left = Math.max(0, duration.value - currentTime.value)
    return `-${formatTime(left)}`
  }
  return `-${durationLabel.value}`
})
</script>

<template>
  <div class="nr" :class="{ 'is-playing': isPlaying, 'is-lyrics': lyricsOpen }">
    <header class="nr-head">
      <p class="nr-kicker">Audio Guide</p>
      <h3 class="nr-title">{{ displayTitle }}</h3>
      <p v-if="guideLabel" class="nr-sub">{{ guideLabel }}</p>
    </header>

    <!-- 媒体区：封面 + 播放器叠在一起；词从底部上滑盖住二者 -->
    <div ref="mediaRef" class="nr-media">
      <!-- 封面 / 无图时的静态词 -->
      <section class="nr-stage">
        <div v-if="hasImages" class="nr-stage-cover">
          <ImageCarousel
            :images="imageUrls"
            :autoplay="!lyricsOpen && !isPlaying"
            :height="0"
          />
        </div>
        <div v-else class="nr-lyrics-static">
          <div v-if="props.status === 'loading'" class="nr-script-state">正在加载解说词…</div>
          <div v-else-if="props.status === 'error'" class="nr-script-state is-error">
            {{ props.errorMessage || "解说词加载失败" }}
          </div>
          <template v-else>
            <p class="nr-script-label">解说词</p>
            <div v-if="displayText" class="nr-script-body">{{ displayText }}</div>
            <div v-else class="nr-script-state">暂无解说词</div>
          </template>
        </div>
      </section>

      <!-- 播放器（词打开时被盖住） -->
      <section
        v-if="hasImages"
        class="nr-player"
        :class="{
          'is-playing': isPlaying,
          'is-ready': hasAudio && !audioBusy,
          'is-busy': audioBusy,
          'is-empty': !hasAudio && !audioBusy,
          'is-scrubbing': scrubbing,
        }"
      >
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
          @play="isPlaying = true"
        />

        <div class="am-scrub">
          <button
            type="button"
            class="am-track"
            :disabled="!hasAudio || !duration"
            :aria-label="`进度 ${formatTime(currentTime)} / ${durationLabel}`"
            @pointerdown="onTrackPointerDown"
            @pointermove="onTrackPointerMove"
            @pointerup="onTrackPointerUp"
            @pointercancel="onTrackPointerUp"
          >
            <span class="am-track__rail" aria-hidden="true" />
            <span class="am-track__fill" aria-hidden="true" :style="{ width: `${progress}%` }" />
            <span class="am-track__knob" aria-hidden="true" :style="{ left: `${progress}%` }" />
          </button>
          <div class="am-times">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ remainingLabel }}</span>
          </div>
        </div>

        <!-- 运输条：-15 · 播放 · +15 · 词 -->
        <div class="am-transport">
          <button
            type="button"
            class="am-skip"
            :disabled="!hasAudio || audioBusy"
            aria-label="后退 15 秒"
            @click="seekBy(-15)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
              />
            </svg>
            <span>15</span>
          </button>

          <button
            type="button"
            class="am-play"
            :disabled="!hasAudio || audioBusy"
            :title="isPlaying ? '暂停' : '播放'"
            :aria-label="isPlaying ? '暂停' : '播放'"
            @click="togglePlay"
          >
            <svg v-if="!isPlaying" class="am-play__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M8.2 5.6v12.8l10.2-6.4L8.2 5.6Z" />
            </svg>
            <svg v-else class="am-play__icon is-pause" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M7 5.5h3.2v13H7v-13Zm6.8 0H17v13h-3.2v-13Z" />
            </svg>
          </button>

          <div class="am-right">
            <button
              type="button"
              class="am-skip is-fwd"
              :disabled="!hasAudio || audioBusy"
              aria-label="前进 15 秒"
              @click="seekBy(15)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"
                />
              </svg>
              <span>15</span>
            </button>

            <!-- Apple Music 式「词」开关 -->
            <button
              type="button"
              class="am-lyrics-btn"
              :class="{ 'is-on': lyricsOpen }"
              :aria-pressed="lyricsOpen"
              aria-label="解说词"
              @click="toggleLyrics"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M4 4.8A1.8 1.8 0 0 1 5.8 3h12.4A1.8 1.8 0 0 1 20 4.8v9.4a1.8 1.8 0 0 1-1.8 1.8H9.2L5 19.8V16H5.8A1.8 1.8 0 0 1 4 14.2V4.8Zm2.2.7v8.7h1.1l.3.2 2.6 1.7V14.2h8V5.5H6.2Z"
                />
              </svg>
              <span>词</span>
            </button>
          </div>
        </div>

        <p class="am-status">
          <template v-if="audioBusy">语音生成中…</template>
          <template v-else-if="!hasAudio">
            {{ displayText ? "语音准备中" : "暂无语音" }}
          </template>
          <template v-else-if="resolvedAudioStatus === NARRATION_AUDIO_STATUS.Stale">
            解说词已更新，语音更新中
          </template>
          <template v-else>{{ playerLabel }}</template>
        </p>
      </section>

      <!-- 无图时仍挂 audio 供底部无播放器？无图也该有播放器 -->
      <section
        v-if="!hasImages"
        class="nr-player"
        :class="{
          'is-playing': isPlaying,
          'is-ready': hasAudio && !audioBusy,
          'is-busy': audioBusy,
          'is-empty': !hasAudio && !audioBusy,
          'is-scrubbing': scrubbing,
        }"
      >
        <audio
          :key="audioUrl || 'empty-static'"
          ref="audioRef"
          class="nr-audio-hidden"
          :src="audioUrl || undefined"
          preload="metadata"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMeta"
          @ended="onEnded"
          @pause="isPlaying = false"
          @play="isPlaying = true"
        />
        <div class="am-scrub">
          <button
            type="button"
            class="am-track"
            :disabled="!hasAudio || !duration"
            @pointerdown="onTrackPointerDown"
            @pointermove="onTrackPointerMove"
            @pointerup="onTrackPointerUp"
            @pointercancel="onTrackPointerUp"
          >
            <span class="am-track__rail" aria-hidden="true" />
            <span class="am-track__fill" aria-hidden="true" :style="{ width: `${progress}%` }" />
            <span class="am-track__knob" aria-hidden="true" :style="{ left: `${progress}%` }" />
          </button>
          <div class="am-times">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ remainingLabel }}</span>
          </div>
        </div>
        <div class="am-transport is-solo">
          <button
            type="button"
            class="am-skip"
            :disabled="!hasAudio || audioBusy"
            @click="seekBy(-15)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
              />
            </svg>
            <span>15</span>
          </button>
          <button
            type="button"
            class="am-play"
            :disabled="!hasAudio || audioBusy"
            @click="togglePlay"
          >
            <svg v-if="!isPlaying" class="am-play__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M8.2 5.6v12.8l10.2-6.4L8.2 5.6Z" />
            </svg>
            <svg v-else class="am-play__icon is-pause" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M7 5.5h3.2v13H7v-13Zm6.8 0H17v13h-3.2v-13Z" />
            </svg>
          </button>
          <button
            type="button"
            class="am-skip is-fwd"
            :disabled="!hasAudio || audioBusy"
            @click="seekBy(15)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"
              />
            </svg>
            <span>15</span>
          </button>
        </div>
        <p class="am-status">{{ playerLabel }}</p>
      </section>

      <!-- 词层：从播放器位置上滑，盖住封面+播放器 -->
      <div
        v-if="hasImages"
        ref="lyricsRef"
        class="nr-lyrics-sheet"
        :aria-hidden="!lyricsOpen"
      >
        <div class="nr-lyrics-sheet__top">
          <p class="nr-script-label">解说词</p>
          <button type="button" class="nr-lyrics-close" @click="closeLyrics">
            封面
          </button>
        </div>
        <div class="nr-lyrics-sheet__body">
          <div v-if="props.status === 'loading'" class="nr-script-state">正在加载解说词…</div>
          <div v-else-if="props.status === 'error'" class="nr-script-state is-error">
            {{ props.errorMessage || "解说词加载失败" }}
          </div>
          <div v-else-if="displayText" class="nr-script-body">{{ displayText }}</div>
          <div v-else class="nr-script-state">暂无解说词</div>
        </div>
      </div>
    </div>

    <div class="nr-foot">
      <footer v-if="showPlayActions" class="nr-actions">
        <button
          type="button"
          class="nr-btn nr-btn--primary"
          :disabled="props.completing"
          @click="emit('complete')"
        >
          {{ props.completing ? "提交中…" : "听完了，继续" }}
        </button>
        <button type="button" class="nr-btn" :disabled="props.completing" @click="emit('skip')">
          {{ props.completing ? "提交中…" : "跳过解说" }}
        </button>
      </footer>
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.nr {
  display: flex;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 0.65rem;
  color: #fff8ea;
}

.nr-head {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0 0.1rem;
}

.nr-kicker {
  margin: 0;
  color: rgb(209 178 111 / 72%);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.nr-title {
  margin: 0;
  font-size: 1.28rem;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: 0.01em;
}

.nr-sub {
  margin: 0.1rem 0 0;
  color: rgb(247 239 221 / 52%);
  font-size: 12px;
  letter-spacing: 0.04em;
}

/* 媒体栈：封面 + 播放器；词层 absolute 盖住 */
.nr-media {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
}

.nr-stage {
  position: relative;
  min-height: 12rem;
  flex: 1 1 auto;
  overflow: hidden;
}

.nr-stage-cover {
  position: absolute;
  inset: 0;
}

.nr-lyrics-static {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.35rem 0.15rem;
  overflow: hidden;
}

/* —— 词层：从底部（播放器位）上滑盖住 —— */
.nr-lyrics-sheet {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(
      180deg,
      rgb(12 11 9 / 96%) 0%,
      rgb(10 9 8 / 98%) 100%
    );
  opacity: 0;
  transform: translateY(100%);
  will-change: transform, opacity;
  pointer-events: none;
}

.nr.is-lyrics .nr-lyrics-sheet {
  pointer-events: auto;
}

.nr-lyrics-sheet__top {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 0.85rem 0.45rem;
}

.nr-lyrics-close {
  border: 0;
  border-radius: 999px;
  background: rgb(209 178 111 / 14%);
  padding: 0.4rem 0.85rem;
  color: #e8c98a;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.06em;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgb(209 178 111 / 28%);
}

.nr-lyrics-sheet__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 0.35rem 1rem 1.1rem;
  overflow: hidden;
}

.nr-script-label {
  margin: 0;
  color: rgb(232 201 138 / 82%);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.nr-script-body {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  color: rgb(247 239 221 / 92%);
  font-size: 1.05rem;
  line-height: 1.85;
  white-space: pre-wrap;
  letter-spacing: 0.02em;
  -webkit-overflow-scrolling: touch;
}

.nr-script-state {
  min-height: 4rem;
  color: rgb(247 239 221 / 52%);
  font-size: 13px;
  line-height: 1.5;
}

.nr-script-state.is-error {
  color: #f0b4b4;
}

/* —— 播放器 —— */
.nr-player {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.45rem 0.15rem 0.2rem;
  border-top: 1px solid rgb(255 248 230 / 6%);
  background: linear-gradient(180deg, transparent, rgb(10 9 8 / 55%) 40%);
}

.nr-audio-hidden {
  display: none;
}

.am-scrub {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  padding: 0 0.15rem;
}

.am-track {
  position: relative;
  display: block;
  width: 100%;
  height: 28px;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  touch-action: none;
}

.am-track:disabled {
  cursor: default;
  opacity: 0.45;
}

.am-track__rail,
.am-track__fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 3px;
  border-radius: 999px;
  transform: translateY(-50%);
  transition: height 0.15s ease;
}

.am-track__rail {
  width: 100%;
  background: rgb(255 255 255 / 12%);
}

.am-track__fill {
  background: linear-gradient(90deg, #b8924a, #e8d18a 70%, #f0dfb0);
  box-shadow: 0 0 10px rgb(232 209 138 / 28%);
}

.am-track__knob {
  position: absolute;
  top: 50%;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #f0dfb0;
  box-shadow:
    0 0 0 3px rgb(209 178 111 / 28%),
    0 1px 4px rgb(0 0 0 / 35%);
  transform: translate(-50%, -50%) scale(0.6);
  opacity: 0;
  transition:
    transform 0.16s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.16s ease;
}

.nr-player.is-ready .am-track:hover .am-track__knob,
.nr-player.is-playing .am-track__knob,
.nr-player.is-scrubbing .am-track__knob {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.nr-player.is-scrubbing .am-track__rail,
.nr-player.is-scrubbing .am-track__fill {
  height: 5px;
}

.nr-player.is-scrubbing .am-track__knob {
  width: 14px;
  height: 14px;
  box-shadow: 0 2px 10px rgb(0 0 0 / 40%);
}

.am-times {
  display: flex;
  justify-content: space-between;
  color: rgb(255 255 255 / 38%);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  font-feature-settings: "tnum";
}

.am-transport {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.15rem 0.1rem;
}

.am-transport.is-solo {
  grid-template-columns: 1fr auto 1fr;
}

.am-play {
  display: grid;
  width: 4rem;
  height: 4rem;
  place-items: center;
  justify-self: center;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(155deg, #f0dfb0 0%, #d1b26f 48%, #b8924a 100%);
  color: #1a160d;
  cursor: pointer;
  box-shadow:
    0 1px 0 rgb(255 255 255 / 35%) inset,
    0 10px 28px rgb(209 178 111 / 28%);
  transition:
    transform 0.18s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.18s ease,
    opacity 0.18s ease;
}

.am-play:hover:not(:disabled) {
  filter: brightness(1.05);
}

.am-play:active:not(:disabled) {
  transform: scale(0.92);
}

.am-play:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.am-play__icon {
  width: 1.55rem;
  height: 1.55rem;
  margin-left: 0.12rem;
}

.am-play__icon.is-pause {
  margin-left: 0;
  width: 1.4rem;
  height: 1.4rem;
}

.am-skip {
  position: relative;
  display: grid;
  width: 2.55rem;
  height: 2.55rem;
  place-items: center;
  justify-self: end;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgb(232 201 138 / 88%);
  cursor: pointer;
  transition:
    color 0.15s ease,
    transform 0.15s ease,
    opacity 0.15s ease;
}

.am-skip.is-fwd {
  justify-self: start;
}

.am-right {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.15rem;
  justify-self: start;
}

.am-skip svg {
  width: 1.45rem;
  height: 1.45rem;
  opacity: 0.92;
}

.am-skip span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -46%);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.am-skip:hover:not(:disabled) {
  color: #f0dfb0;
}

.am-skip:active:not(:disabled) {
  transform: scale(0.9);
}

.am-skip:disabled {
  cursor: not-allowed;
  opacity: 0.3;
}

/* Music 式「词」按钮 */
.am-lyrics-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  min-height: 2.2rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  padding: 0.25rem 0.55rem;
  color: rgb(232 201 138 / 78%);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition:
    background 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

.am-lyrics-btn svg {
  width: 1.05rem;
  height: 1.05rem;
}

.am-lyrics-btn.is-on,
.am-lyrics-btn:hover {
  background: rgb(209 178 111 / 16%);
  color: #f0dfb0;
  box-shadow: inset 0 0 0 1px rgb(209 178 111 / 32%);
}

.am-status {
  margin: 0;
  min-height: 1rem;
  text-align: center;
  color: rgb(255 255 255 / 36%);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.nr-player.is-busy .am-status {
  color: rgb(232 201 138 / 72%);
}

.nr-foot {
  display: grid;
  flex-shrink: 0;
  gap: 0.55rem;
  margin-top: auto;
  padding-top: 0.25rem;
  padding-bottom: 0.15rem;
}

.nr-actions {
  display: grid;
  gap: 0.45rem;
}

.nr-btn {
  min-height: 46px;
  border: 0;
  border-bottom: 1px solid rgb(255 248 230 / 10%);
  border-radius: 0;
  background: transparent;
  color: rgb(247 239 221 / 78%);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.nr-btn--primary {
  border: 0;
  border-radius: 999px;
  background: linear-gradient(155deg, #e8d18a, #c9a75a);
  color: #1a160f;
  font-weight: 650;
  box-shadow: 0 10px 24px rgb(209 178 111 / 18%);
}

.nr-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (prefers-reduced-motion: reduce) {
  .am-play,
  .am-skip,
  .am-track__knob,
  .am-lyrics-btn {
    transition: none;
  }
}
</style>
