<script setup lang="ts">
/**
 * 解说导览：去 card 的博物馆音频播放器。
 * 有图 / 无图：图区与解说文区使用固定高度，不被矮屏剩余空间压扁；
 * 整页允许高于视口，由宿主 main 外层滚动（低分辨率 / 浏览器 chrome 场景）。
 * 有图展开「文」：sheet 仅盖媒体栈（图+播放器），底栏 mask 防误点。
 * 底栏「跳过 / 继续」单行并排，压缩底部占用。
 */
import { computed, onBeforeUnmount, ref, watch } from "vue"
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

/** true=解说文全覆盖媒体区（封面+播放器） */
const lyricsOpen = ref(false)
const lyricsBodyRef = ref<HTMLElement | null>(null)
const sheetDragY = ref(0)
const sheetDragging = ref(false)

let sheetPointerId: number | null = null
let sheetStartX = 0
let sheetStartY = 0
let sheetLastY = 0
let sheetLastT = 0
let sheetVelocityY = 0
let sheetAxis: "x" | "y" | null = null
/** 本次手势是否允许下拉关闭（正文滚到顶或点在顶栏） */
let sheetCanDismiss = false

const sheetDragStyle = computed(() => {
  if (!sheetDragging.value && sheetDragY.value <= 0) return undefined
  const y = Math.max(0, sheetDragY.value)
  const fade = Math.min(0.5, y / 420)
  return {
    transform: `translate3d(0, ${y}px, 0)`,
    opacity: String(1 - fade),
  }
})

const resetSheetDrag = () => {
  sheetPointerId = null
  sheetAxis = null
  sheetCanDismiss = false
  sheetDragging.value = false
  sheetDragY.value = 0
  sheetVelocityY = 0
}

const toggleLyrics = () => {
  if (!hasImages.value) return
  resetSheetDrag()
  lyricsOpen.value = !lyricsOpen.value
}

const closeLyrics = () => {
  if (!hasImages.value) return
  resetSheetDrag()
  lyricsOpen.value = false
}

const onSheetPointerDown = (event: PointerEvent) => {
  if (!lyricsOpen.value || !hasImages.value) return
  // 仅主触点；按钮点击仍走自身 handler
  if (event.button !== 0) return
  const target = event.target as HTMLElement | null
  if (target?.closest("button, a, input, textarea")) return

  const body = lyricsBodyRef.value
  const onHandle = Boolean(target?.closest("[data-lyrics-handle]"))
  const atTop = !body || body.scrollTop <= 1
  sheetCanDismiss = onHandle || atTop
  if (!sheetCanDismiss) return

  sheetPointerId = event.pointerId
  sheetStartX = event.clientX
  sheetStartY = event.clientY
  sheetLastY = event.clientY
  sheetLastT = performance.now()
  sheetVelocityY = 0
  sheetAxis = null
  sheetDragging.value = false
  sheetDragY.value = 0
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}

const onSheetPointerMove = (event: PointerEvent) => {
  if (sheetPointerId !== event.pointerId || !sheetCanDismiss) return
  const dx = event.clientX - sheetStartX
  const dy = event.clientY - sheetStartY

  if (!sheetAxis) {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
    sheetAxis = Math.abs(dy) >= Math.abs(dx) ? "y" : "x"
    if (sheetAxis === "x") {
      sheetCanDismiss = false
      return
    }
    // 正文未在顶时若用户在往上滚，交给滚动
    const body = lyricsBodyRef.value
    if (body && body.scrollTop > 1 && dy < 0) {
      sheetCanDismiss = false
      return
    }
  }
  if (sheetAxis !== "y") return

  // 仅下拉关闭；上推不跟手
  const nextY = Math.max(0, dy)
  if (nextY > 0) {
    event.preventDefault()
    sheetDragging.value = true
    // 轻微阻尼
    sheetDragY.value = nextY * 0.92
    const now = performance.now()
    const dt = Math.max(1, now - sheetLastT)
    sheetVelocityY = ((event.clientY - sheetLastY) / dt) * 1000
    sheetLastY = event.clientY
    sheetLastT = now
  }
}

const onSheetPointerUp = (event: PointerEvent) => {
  if (sheetPointerId !== event.pointerId) return
  const y = sheetDragY.value
  const v = sheetVelocityY
  const shouldClose = y > 96 || (y > 42 && v > 720)

  sheetPointerId = null
  sheetAxis = null
  sheetCanDismiss = false
  sheetDragging.value = false

  if (shouldClose) {
    sheetDragY.value = 0
    sheetVelocityY = 0
    lyricsOpen.value = false
    return
  }

  // 回弹
  sheetDragY.value = 0
  sheetVelocityY = 0
}

const onSheetPointerCancel = (event: PointerEvent) => {
  if (sheetPointerId !== event.pointerId) return
  resetSheetDrag()
}

watch(
  hasImages,
  (ok) => {
    // 无配图时直接展示解说词；有配图时默认封面模式
    resetSheetDrag()
    lyricsOpen.value = !ok
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
  <div
    class="nr"
    :class="{
      'is-playing': isPlaying,
      'is-lyrics': lyricsOpen && hasImages,
      'is-no-image': !hasImages,
    }"
  >
    <header class="nr-head">
      <p class="nr-kicker">Audio Guide</p>
      <h3 class="nr-title">{{ displayTitle }}</h3>
      <p v-if="guideLabel" class="nr-sub">{{ guideLabel }}</p>
    </header>

    <!-- 主体：媒体 + 底栏；解说文正文只盖媒体区，底栏另做遮罩防误点 -->
    <div class="nr-main">
      <div class="nr-media" :class="{ 'is-text-only': !hasImages }">
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
              <p class="nr-script-label">解说文</p>
              <div v-if="displayText" class="nr-script-body">{{ displayText }}</div>
              <div v-else class="nr-script-state">暂无解说词</div>
            </template>
          </div>
        </section>

        <section
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

          <div class="am-transport">
            <!-- 三栏：左右等宽，中间 -10/播/+10 真正居中 -->
            <div class="am-transport__side" aria-hidden="true" />

            <div class="am-transport__core">
              <button
                type="button"
                class="am-ctrl am-skip"
                :disabled="!hasAudio || audioBusy"
                aria-label="后退 10 秒"
                @click="seekBy(-10)"
              >
                <!-- 圆环放大；数字单独叠字，保持可读字号 -->
                <svg class="am-skip__ring" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
                  />
                </svg>
                <span class="am-skip__num">10</span>
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

              <button
                type="button"
                class="am-ctrl am-skip is-fwd"
                :disabled="!hasAudio || audioBusy"
                aria-label="前进 10 秒"
                @click="seekBy(10)"
              >
                <svg class="am-skip__ring" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"
                  />
                </svg>
                <span class="am-skip__num">10</span>
              </button>
            </div>

            <div class="am-transport__side is-end">
              <button
                v-if="hasImages"
                type="button"
                class="am-ctrl am-lyrics-btn"
                :class="{ 'is-on': lyricsOpen }"
                :aria-pressed="lyricsOpen"
                aria-label="解说文"
                @click="toggleLyrics"
              >
                文
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

        <!-- 解说文：仅覆盖图+播放器（可滚动区止于播放器底端） -->
        <div
          v-if="hasImages"
          class="nr-lyrics-sheet"
          :class="{
            'is-open': lyricsOpen,
            'is-dragging': sheetDragging,
          }"
          :style="sheetDragStyle"
          :aria-hidden="!lyricsOpen"
          @pointerdown="onSheetPointerDown"
          @pointermove="onSheetPointerMove"
          @pointerup="onSheetPointerUp"
          @pointercancel="onSheetPointerCancel"
        >
          <div class="nr-lyrics-sheet__handle" data-lyrics-handle aria-hidden="true">
            <span class="nr-lyrics-sheet__grabber" />
          </div>
          <div class="nr-lyrics-sheet__top" data-lyrics-handle>
            <p class="nr-script-label">解说文</p>
            <button type="button" class="nr-lyrics-close" @click="closeLyrics">
              封面
            </button>
          </div>
          <div ref="lyricsBodyRef" class="nr-lyrics-sheet__body">
            <div v-if="props.status === 'loading'" class="nr-script-state">正在加载解说词…</div>
            <div v-else-if="props.status === 'error'" class="nr-script-state is-error">
              {{ props.errorMessage || "解说词加载失败" }}
            </div>
            <div v-else-if="displayText" class="nr-script-body is-lyrics">{{ displayText }}</div>
            <div v-else class="nr-script-state">暂无解说词</div>
          </div>
        </div>
      </div>

      <div
        class="nr-foot"
        :class="{ 'is-masked': lyricsOpen && hasImages }"
        :aria-hidden="lyricsOpen && hasImages ? 'true' : undefined"
      >
        <footer v-if="showPlayActions" class="nr-actions">
          <button
            type="button"
            class="nr-btn nr-btn--ghost"
            :disabled="props.completing || (lyricsOpen && hasImages)"
            @click="emit('skip')"
          >
            {{ props.completing ? "提交中…" : "跳过" }}
          </button>
          <button
            type="button"
            class="nr-btn nr-btn--primary"
            :disabled="props.completing || (lyricsOpen && hasImages)"
            @click="emit('complete')"
          >
            {{ props.completing ? "提交中…" : "听完了，继续" }}
          </button>
        </footer>
        <slot name="footer" />
        <!-- 仅遮罩、无文字，挡住底栏误点 -->
        <div
          v-if="hasImages"
          class="nr-foot-mask"
          :class="{ 'is-on': lyricsOpen }"
          aria-hidden="true"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.nr {
  /* 固定图/文高：比 240 更舒展；矮屏外滚，不被剩余视口压扁 */
  --nr-stage-h: clamp(300px, 78vw, 420px);

  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 0.55rem;
  height: auto;
  max-height: none;
  overflow: visible;
  color: #fff8ea;
}

/* 标题区：纯文字，无底板 */
.nr-head {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 0.12rem;
  padding: 0 0.05rem;
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
  margin: 0.08rem 0 0;
  color: rgb(247 239 221 / 52%);
  font-size: 12px;
  letter-spacing: 0.04em;
}

/* 主体：媒体 + 底栏（高度随内容，不抢剩余视口） */
.nr-main {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 0.55rem;
  min-height: 0;
  overflow: visible;
}

/* 媒体栈：图/文固定高 + 播放器内容高；sheet 相对此层 */
.nr-media {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.nr-stage {
  position: relative;
  flex: 0 0 auto;
  width: 100%;
  height: var(--nr-stage-h);
  min-height: var(--nr-stage-h);
  max-height: var(--nr-stage-h);
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
  gap: 0.35rem;
  padding: 0.15rem 0.05rem 0.2rem;
  overflow: hidden;
}

/* 无图：解说文铺满固定 stage，正文区内滚动 */
.nr-media.is-text-only .nr-lyrics-static {
  position: absolute;
  inset: 0;
  height: auto;
}

.nr-media.is-text-only .nr-script-label {
  flex-shrink: 0;
}

.nr-media.is-text-only .nr-script-body {
  flex: 1 1 0%;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  padding-right: 0.2rem;
  font-size: 0.98rem;
  line-height: 1.72;
}

.nr-media.is-text-only .nr-script-state {
  flex: 1 1 0%;
  min-height: 0;
  overflow-y: auto;
}

/* 解说文：仅盖媒体区（图+播放器），不叠到底栏文字区 */
.nr-lyrics-sheet {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  /* 提高遮罩不透明度，减少背后图片干扰阅读 */
  background: rgb(10 9 8 / 88%);
  backdrop-filter: blur(36px) saturate(1.2);
  -webkit-backdrop-filter: blur(36px) saturate(1.2);
  opacity: 0;
  visibility: hidden;
  transform: translate3d(0, 100%, 0);
  transition:
    transform 0.46s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.32s ease,
    visibility 0.32s ease;
  pointer-events: none;
  touch-action: pan-y;
  will-change: transform, opacity;
}

.nr-lyrics-sheet.is-open {
  opacity: 1;
  visibility: visible;
  transform: translate3d(0, 0, 0);
  pointer-events: auto;
}

.nr-lyrics-sheet.is-dragging {
  transition: none;
}

.nr-lyrics-sheet__handle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0 0.15rem;
  cursor: grab;
  touch-action: none;
}

.nr-lyrics-sheet__grabber {
  display: block;
  width: 2.4rem;
  height: 4px;
  border-radius: 999px;
  background: rgb(255 248 230 / 28%);
}

.nr-lyrics-sheet__top {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.35rem 0.1rem 0.35rem;
  touch-action: none;
}

.nr-lyrics-close {
  border: 0;
  background: transparent;
  padding: 0.35rem 0.15rem;
  color: #e8c98a;
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.nr-lyrics-close:hover {
  color: #f0dfb0;
}

.nr-lyrics-sheet__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 0.25rem 0.1rem 0.85rem;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
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
  color: rgb(247 239 221 / 92%);
  font-size: 1.05rem;
  line-height: 1.85;
  white-space: pre-wrap;
  letter-spacing: 0.02em;
}

.nr-script-body.is-lyrics {
  padding: 0.2rem 0.05rem 0.5rem;
  font-size: 1.12rem;
  font-weight: 500;
  line-height: 1.92;
  letter-spacing: 0.03em;
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

/* 播放区：始终按内容高度，不参与抢剩余视口 */
.nr-player {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  flex-direction: column;
  justify-content: flex-start;
  gap: 0.28rem;
  padding: 0.4rem 0.3rem 0.2rem;
  border-top: 1px solid rgb(255 248 230 / 8%);
  background: transparent;
}

.nr-audio-hidden {
  display: none;
}

.am-scrub {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 0.22rem;
  padding: 0.1rem 0.1rem 0;
}

.am-track {
  position: relative;
  display: block;
  width: 100%;
  height: 36px;
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
  height: 3.5px;
  border-radius: 999px;
  transform: translateY(-50%);
  transition: height 0.15s ease;
}

.am-track__rail {
  width: 100%;
  background: rgb(255 255 255 / 18%);
}

.am-track__fill {
  background: linear-gradient(90deg, #d4b56a, #f0dfb0);
  box-shadow: 0 0 10px rgb(232 209 138 / 22%);
}

.am-track__knob {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #f7efdd;
  box-shadow: 0 0 0 3px rgb(232 209 138 / 20%);
  transform: translate(-50%, -50%) scale(0.75);
  opacity: 0.65;
  transition:
    transform 0.16s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.16s ease,
    box-shadow 0.16s ease;
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
  width: 15px;
  height: 15px;
  box-shadow: 0 0 0 5px rgb(232 209 138 / 24%);
}

.am-times {
  display: flex;
  min-width: 0;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0.05rem;
  color: rgb(255 255 255 / 48%);
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  font-feature-settings: "tnum";
}

.am-times span {
  flex-shrink: 0;
}

/* 运输区：三栏等宽，中间控件组真正居中；窄屏压缩尺寸 */
.am-transport {
  display: grid;
  min-width: 0;
  min-height: 0;
  flex: 0 0 auto;
  grid-template-columns: minmax(2.85rem, 1fr) auto minmax(2.85rem, 1fr);
  align-items: center;
  column-gap: 0.25rem;
  padding: 0.3rem 0 0.15rem;
}

.am-transport__side {
  display: flex;
  min-width: 0;
  align-items: center;
}

.am-transport__side.is-end {
  justify-content: flex-end;
  padding-right: 0.05rem;
}

/* -10 / 播放 / +10：次要控件同系，主按钮突出 */
.am-transport__core {
  display: flex;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
}

.am-play {
  display: grid;
  width: 3.85rem;
  height: 3.85rem;
  flex-shrink: 0;
  place-items: center;
  border: 0;
  border-radius: 999px;
  /* 金质渐变 + 内高光，比纯色更有立体感 */
  background:
    linear-gradient(165deg, #f3e4b4 0%, #e8d18a 46%, #c9a75a 100%);
  color: #1a160d;
  box-shadow:
    0 1.5px 0 rgb(255 255 255 / 38%) inset,
    0 -1.5px 2px rgb(90 70 20 / 18%) inset,
    0 10px 24px rgb(0 0 0 / 34%),
    0 2px 6px rgb(0 0 0 / 18%),
    0 0 0 1px rgb(232 209 138 / 22%);
  cursor: pointer;
  transition:
    transform 0.16s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.16s ease,
    filter 0.16s ease,
    box-shadow 0.16s ease;
}

.am-play:hover:not(:disabled) {
  filter: brightness(1.05);
  box-shadow:
    0 1.5px 0 rgb(255 255 255 / 42%) inset,
    0 -1.5px 2px rgb(90 70 20 / 16%) inset,
    0 12px 28px rgb(0 0 0 / 38%),
    0 3px 8px rgb(0 0 0 / 20%),
    0 0 0 1px rgb(240 223 176 / 28%);
}

.am-play:active:not(:disabled) {
  transform: scale(0.94);
  box-shadow:
    0 1px 0 rgb(255 255 255 / 28%) inset,
    0 4px 12px rgb(0 0 0 / 28%),
    0 0 0 1px rgb(232 209 138 / 18%);
}

/* 无音频时仍保持可辨识，不用过低 opacity 糊成泥色 */
.am-play:disabled {
  cursor: not-allowed;
  background: linear-gradient(165deg, rgb(243 228 180 / 45%), rgb(201 167 90 / 38%));
  color: rgb(26 22 13 / 48%);
  box-shadow:
    0 1px 0 rgb(255 255 255 / 12%) inset,
    0 4px 12px rgb(0 0 0 / 14%);
  filter: none;
}

.am-play__icon {
  width: 1.48rem;
  height: 1.48rem;
  margin-left: 0.12rem;
  filter: drop-shadow(0 0.5px 0 rgb(255 255 255 / 25%));
}

.am-play__icon.is-pause {
  margin-left: 0;
  width: 1.32rem;
  height: 1.32rem;
}

/* 次要控件统一：同色、同圆角；skip 更大以便数字可读 */
.am-ctrl {
  display: inline-flex;
  position: relative;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 2.7rem;
  min-width: 2.7rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgb(240 223 176 / 88%);
  cursor: pointer;
  transition:
    color 0.15s ease,
    transform 0.15s ease,
    background 0.15s ease;
}

.am-ctrl:hover:not(:disabled) {
  color: #f7efdd;
  background: rgb(209 178 111 / 12%);
}

.am-ctrl:active:not(:disabled) {
  transform: scale(0.94);
}

.am-ctrl:disabled {
  cursor: not-allowed;
  color: rgb(240 223 176 / 38%);
  background: transparent;
}

.am-ctrl__icon {
  display: block;
  width: 1.72rem;
  height: 1.72rem;
  flex-shrink: 0;
}

/* 快进/快退：圆环放大，数字用固定可读字号居中 */
.am-skip {
  width: 3.05rem;
  height: 3.05rem;
  min-width: 3.05rem;
  padding: 0;
}

.am-skip__ring {
  display: block;
  width: 2.15rem;
  height: 2.15rem;
}

.am-skip__num {
  position: absolute;
  top: 52%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

/* 「文」：纯文字、放大，与 skip 同高 */
.am-lyrics-btn {
  height: 3.05rem;
  min-width: 3.05rem;
  padding: 0 0.85rem;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1;
}

.am-lyrics-btn.is-on {
  color: #f7efdd;
  background: rgb(209 178 111 / 18%);
}

.am-status {
  margin: 0;
  flex-shrink: 0;
  min-height: 1.15rem;
  padding: 0.1rem 0.1rem 0.05rem;
  text-align: center;
  color: rgb(255 255 255 / 42%);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.03em;
}

.nr-player.is-busy .am-status {
  color: rgb(232 201 138 / 78%);
}

.nr-player.is-playing .am-status {
  color: rgb(240 223 176 / 62%);
}

.nr-foot {
  position: relative;
  display: grid;
  flex: 0 0 auto;
  gap: 0.5rem;
  margin-top: 0.15rem;
  padding-top: 0.1rem;
  padding-bottom: 0.1rem;
}

/* 底栏遮罩：无文字，仅挡误点 */
.nr-foot-mask {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: rgb(10 9 8 / 42%);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 0.28s ease,
    visibility 0.28s ease;
}

.nr-foot-mask.is-on {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.nr-foot.is-masked {
  pointer-events: none;
}

.nr-foot.is-masked .nr-foot-mask {
  pointer-events: auto;
}

/* 跳过 / 继续 单行等宽 */
.nr-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
  align-items: stretch;
}

.nr-btn {
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgb(247 239 221 / 82%);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.nr-btn--ghost {
  border: 1px solid rgb(255 248 230 / 16%);
  background: rgb(255 248 230 / 4%);
  color: rgb(247 239 221 / 72%);
}

.nr-btn--primary {
  border: 0;
  background: linear-gradient(155deg, #e8d18a, #c9a75a);
  color: #1a160f;
  font-weight: 650;
}

.nr-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (prefers-reduced-motion: reduce) {
  .nr-lyrics-sheet {
    transition: none;
  }

  .am-play,
  .am-skip,
  .am-track__knob,
  .am-lyrics-btn {
    transition: none;
  }
}
</style>
