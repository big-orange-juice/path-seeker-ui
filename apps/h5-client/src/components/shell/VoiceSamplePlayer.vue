<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from "vue"
import { Pause, Play } from "lucide-vue-next"

interface Props {
  src: string
  /** 无样本时的提示 */
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  emptyText: "暂无试听音频",
})

const isPlaying = shallowRef(false)
const isReady = shallowRef(false)
const currentTime = shallowRef(0)
const duration = shallowRef(0)
const errorMessage = shallowRef("")
const scrubbing = shallowRef(false)

let audioEl: HTMLAudioElement | null = null

const hasSrc = computed(() => Boolean(String(props.src || "").trim()))
const progress = computed(() => {
  if (!duration.value || duration.value <= 0) return 0
  return Math.min(1, Math.max(0, currentTime.value / duration.value))
})

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

const currentLabel = computed(() => formatTime(currentTime.value))
const durationLabel = computed(() =>
  duration.value > 0 ? formatTime(duration.value) : "—:——",
)

function bindAudio(el: HTMLAudioElement) {
  el.preload = "metadata"
  el.ontimeupdate = () => {
    if (!scrubbing.value) {
      currentTime.value = el.currentTime || 0
    }
  }
  el.onloadedmetadata = () => {
    duration.value = Number.isFinite(el.duration) ? el.duration : 0
    isReady.value = true
  }
  el.onended = () => {
    isPlaying.value = false
    currentTime.value = 0
  }
  el.onerror = () => {
    isPlaying.value = false
    errorMessage.value = "试听加载失败，请稍后重试。"
  }
  el.onplay = () => {
    isPlaying.value = true
  }
  el.onpause = () => {
    isPlaying.value = false
  }
}

function disposeAudio() {
  if (!audioEl) return
  audioEl.pause()
  audioEl.ontimeupdate = null
  audioEl.onloadedmetadata = null
  audioEl.onended = null
  audioEl.onerror = null
  audioEl.onplay = null
  audioEl.onpause = null
  audioEl.src = ""
  audioEl = null
  isPlaying.value = false
  isReady.value = false
  currentTime.value = 0
  duration.value = 0
}

function ensureAudio() {
  if (!hasSrc.value) return null
  if (audioEl) return audioEl
  audioEl = new Audio(props.src)
  bindAudio(audioEl)
  return audioEl
}

async function togglePlay() {
  errorMessage.value = ""
  if (!hasSrc.value) return
  const el = ensureAudio()
  if (!el) return
  if (isPlaying.value) {
    el.pause()
    return
  }
  try {
    await el.play()
  } catch {
    errorMessage.value = "无法播放试听，请检查网络或设备设置。"
    isPlaying.value = false
  }
}

function seekFromClientX(track: HTMLElement, clientX: number) {
  const el = ensureAudio()
  if (!el || !duration.value) return
  const rect = track.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  const next = ratio * duration.value
  el.currentTime = next
  currentTime.value = next
}

function onTrackPointerDown(event: PointerEvent) {
  if (!hasSrc.value || !duration.value) return
  const track = event.currentTarget as HTMLElement
  scrubbing.value = true
  track.setPointerCapture(event.pointerId)
  seekFromClientX(track, event.clientX)
}

function onTrackPointerMove(event: PointerEvent) {
  if (!scrubbing.value) return
  const track = event.currentTarget as HTMLElement
  seekFromClientX(track, event.clientX)
}

function onTrackPointerUp(event: PointerEvent) {
  if (!scrubbing.value) return
  const track = event.currentTarget as HTMLElement
  try {
    track.releasePointerCapture(event.pointerId)
  } catch {
    /* already released */
  }
  scrubbing.value = false
}

watch(
  () => props.src,
  () => {
    disposeAudio()
    errorMessage.value = ""
  },
)

onUnmounted(() => {
  disposeAudio()
})
</script>

<template>
  <div class="voice-player" :class="{ 'is-empty': !hasSrc }">
    <template v-if="hasSrc">
      <button
        type="button"
        class="voice-player__toggle"
        :aria-label="isPlaying ? '暂停试听' : '播放试听'"
        @click="togglePlay"
      >
        <Pause v-if="isPlaying" class="h-4 w-4" :stroke-width="1.8" />
        <Play v-else class="h-4 w-4" :stroke-width="1.8" />
      </button>

      <div class="voice-player__body">
        <div
          class="voice-player__track"
          role="slider"
          :aria-valuemin="0"
          :aria-valuemax="Math.floor(duration) || 0"
          :aria-valuenow="Math.floor(currentTime)"
          :aria-label="isReady ? '试听进度' : '试听加载中'"
          tabindex="0"
          @pointerdown="onTrackPointerDown"
          @pointermove="onTrackPointerMove"
          @pointerup="onTrackPointerUp"
          @pointercancel="onTrackPointerUp"
        >
          <div class="voice-player__rail" aria-hidden="true" />
          <div
            class="voice-player__fill"
            aria-hidden="true"
            :style="{ width: `${progress * 100}%` }"
          />
          <div
            class="voice-player__thumb"
            aria-hidden="true"
            :style="{ left: `${progress * 100}%` }"
          />
        </div>
        <div class="voice-player__meta">
          <span>{{ currentLabel }}</span>
          <span class="voice-player__meta-sep" aria-hidden="true">/</span>
          <span>{{ durationLabel }}</span>
        </div>
      </div>
    </template>

    <p v-else class="voice-player__empty">
      {{ emptyText }}
    </p>

    <p v-if="errorMessage" class="voice-player__error">
      {{ errorMessage }}
    </p>
  </div>
</template>

<style scoped>
.voice-player {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem 0.75rem;
  width: 100%;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.28);
  background:
    linear-gradient(
      135deg,
      rgba(209, 178, 111, 0.12) 0%,
      rgba(12, 10, 8, 0.55) 48%,
      rgba(12, 10, 8, 0.4) 100%
    );
  padding: 0.45rem 0.7rem 0.45rem 0.45rem;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
}

.voice-player.is-empty {
  border-style: dashed;
  border-color: rgba(255, 248, 230, 0.12);
  background: rgba(12, 10, 8, 0.32);
  padding: 0.55rem 0.85rem;
}

.voice-player__toggle {
  display: inline-flex;
  height: 2.15rem;
  width: 2.15rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(209, 178, 111, 0.45);
  border-radius: 999px;
  background: rgba(209, 178, 111, 0.18);
  color: var(--gold-bright);
  box-shadow: 0 0 16px rgba(209, 178, 111, 0.18);
}

.voice-player__toggle:active {
  background: rgba(209, 178, 111, 0.28);
}

.voice-player__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.22rem;
}

.voice-player__track {
  position: relative;
  height: 1.1rem;
  cursor: pointer;
  touch-action: none;
}

.voice-player__rail,
.voice-player__fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 2px;
  border-radius: 999px;
  transform: translateY(-50%);
}

.voice-player__rail {
  right: 0;
  background: rgba(255, 248, 230, 0.14);
}

.voice-player__fill {
  background: linear-gradient(90deg, rgba(209, 178, 111, 0.55), rgba(232, 201, 138, 0.95));
  box-shadow: 0 0 10px rgba(209, 178, 111, 0.35);
}

.voice-player__thumb {
  position: absolute;
  top: 50%;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  border: 1px solid rgba(250, 244, 234, 0.85);
  background: rgba(232, 201, 138, 0.95);
  box-shadow: 0 0 8px rgba(209, 178, 111, 0.45);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.voice-player__meta {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--fg-dim);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  line-height: 1;
}

.voice-player__meta-sep {
  opacity: 0.45;
}

.voice-player__empty {
  margin: 0;
  color: var(--fg-dim);
  font-size: 0.82rem;
  line-height: 1.4;
}

.voice-player__error {
  flex-basis: 100%;
  margin: 0;
  color: var(--bad);
  font-size: 0.72rem;
  line-height: 1.35;
}
</style>
