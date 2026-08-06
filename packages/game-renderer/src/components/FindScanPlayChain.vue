<script setup lang="ts">
/**
 * 找一找共用 play 链路：扫一扫 → 观展短片。
 * 视觉对齐 H5 ChapterBrief 的 locate / video 阶段（不含星空背景）。
 */
import { computed, shallowRef, useTemplateRef, watch } from "vue"
import FindScanRenderer, { type FindScanStatus } from "./renderers/FindScanRenderer.vue"

export type FindScanPlayPhase = "scan" | "video"

const props = withDefaults(
  defineProps<{
    title?: string | null
    location?: string | null
    clueText?: string | null
    videoUrl?: string | null
    stageTitle?: string | null
    stageNo?: number | null
    tips?: string[]
    canComplete?: boolean
    initialPhase?: FindScanPlayPhase
  }>(),
  {
    title: "",
    location: "",
    clueText: "",
    videoUrl: "",
    stageTitle: "",
    stageNo: null,
    tips: () => [],
    canComplete: false,
    initialPhase: "scan",
  },
)

const emit = defineEmits<{
  "update:phase": [phase: FindScanPlayPhase]
  complete: []
  "skip-stage": []
}>()

const phase = shallowRef<FindScanPlayPhase>(props.initialPhase)
const statusText = shallowRef("即将播放")
const progressPct = shallowRef(0)
const finishing = shallowRef(false)
const videoRef = useTemplateRef<HTMLVideoElement>("videoEl")

const displayTitle = computed(() => String(props.title || "").trim() || "目标展品")
const displayStageTitle = computed(() => String(props.stageTitle || props.title || "").trim() || "找一找")
const displayLocation = computed(() => String(props.location || "").trim())
const displayClue = computed(
  () => String(props.clueText || "").trim() || "到展柜前仔细观察，再继续下一步。",
)
const resolvedVideoUrl = computed(() => String(props.videoUrl || "").trim())
const hasVideo = computed(() => Boolean(resolvedVideoUrl.value))
const tipList = computed(() => (props.tips || []).map((tip) => String(tip || "").trim()).filter(Boolean))
const scanKicker = computed(() => {
  const no = props.stageNo
  return typeof no === "number" && no > 0 ? `第 ${no} 站 · 线索 · 找一找` : "线索 · 找一找"
})
const videoKicker = computed(() => {
  const no = props.stageNo
  return typeof no === "number" && no > 0 ? `第 ${no} 站 · 观展短片` : "观展短片"
})

watch(
  () => [props.title, props.location, props.clueText, props.videoUrl, props.initialPhase] as const,
  () => {
    phase.value = props.initialPhase
    progressPct.value = 0
    statusText.value = "即将播放"
    finishing.value = false
  },
)

watch(phase, (next) => emit("update:phase", next))

const setPhase = (next: FindScanPlayPhase) => {
  phase.value = next
  if (next === "video") {
    progressPct.value = 0
    statusText.value = hasVideo.value ? "即将播放" : "暂无短片"
    finishing.value = false
  }
}

const handleStatus = (status: FindScanStatus) => {
  if (status === "success") setPhase("video")
}

const enterVideo = () => setPhase("video")

const onTimeUpdate = () => {
  const video = videoRef.value
  if (!video?.duration) return
  progressPct.value = Math.min(100, Math.round((video.currentTime / video.duration) * 100))
  statusText.value = video.paused ? "已暂停" : "播放中"
}

const onEnded = () => {
  progressPct.value = 100
  statusText.value = "播放完成"
  // 播完通知宿主；是否真正提交由宿主决定（B 端可忽略）
  emit("complete")
}

const togglePlay = async () => {
  const video = videoRef.value
  if (!video) return
  if (video.paused) {
    try {
      video.muted = false
      await video.play()
      statusText.value = "播放中"
    } catch {
      try {
        video.muted = true
        await video.play()
        statusText.value = "播放中（静音）"
      } catch {
        statusText.value = "点击播放"
      }
    }
    return
  }
  video.pause()
  statusText.value = "已暂停"
}

const handleSkipStage = () => {
  if (!props.canComplete || finishing.value) return
  finishing.value = true
  emit("skip-stage")
}
</script>

<template>
  <div class="find-chain" :class="`is-${phase}`">
    <!-- 扫一扫：对齐 H5 locate 卡片 -->
    <section v-if="phase === 'scan'" class="play-panel">
      <div class="play-panel__inner">
        <div class="find-top">
          <p class="play-kicker">{{ scanKicker }}</p>
          <div v-if="$slots.ask" class="find-top__ask">
            <slot name="ask" />
          </div>
        </div>
        <div class="play-heading">
          <slot name="title">
            <h2 class="play-title is-lg">{{ displayStageTitle }}</h2>
          </slot>
          <p class="play-copy">{{ displayClue }}</p>
        </div>

        <div v-if="displayLocation" class="info-row">
          <span class="info-dot" />
          <div class="info-text">
            <p class="info-label">位置</p>
            <p class="info-value">{{ displayLocation }}</p>
          </div>
        </div>

        <div v-if="tipList.length" class="tips-block">
          <p class="section-label">观察提示</p>
          <div v-for="(tip, index) in tipList" :key="`${index}-${tip}`" class="tip-item">
            <span class="tip-index">{{ index + 1 }}</span>
            <p>{{ tip }}</p>
          </div>
        </div>

        <div class="scan-block">
          <p class="section-label">找一找</p>
          <div class="scan-frame">
            <FindScanRenderer
              :title="displayTitle"
              :location="displayLocation"
              :clue-text="displayClue"
              allow-skip
              @update:status="handleStatus"
              @skip="enterVideo" />
          </div>
          <p class="play-footnote">可跳过识别进入短片。</p>
        </div>

        <div v-if="canComplete" class="play-actions">
          <button type="button" class="play-btn" :disabled="finishing" @click="handleSkipStage">
            {{ finishing ? "处理中…" : "跳过本站" }}
          </button>
        </div>
        <slot name="actions" />
      </div>
    </section>

    <!-- 观展短片：对齐 H5 film stage -->
    <section v-else class="film-stage">
      <div class="film-head">
        <div class="play-heading">
          <p class="play-kicker">{{ videoKicker }}</p>
          <slot name="title">
            <h2 class="play-title">{{ displayStageTitle }}</h2>
          </slot>
        </div>
        <div class="film-head__trail">
          <div v-if="$slots.ask" class="film-head__ask">
            <slot name="ask" />
          </div>
          <button
            v-if="canComplete"
            type="button"
            class="play-btn is-compact"
            :disabled="finishing"
            @click="handleSkipStage">
            跳过
          </button>
        </div>
      </div>

      <div v-if="hasVideo" class="film-frame">
        <video
          ref="videoEl"
          class="film-video"
          playsinline
          preload="metadata"
          :src="resolvedVideoUrl"
          @timeupdate="onTimeUpdate"
          @ended="onEnded"
          @click="togglePlay" />
        <div class="film-progress" aria-hidden="true">
          <span :style="{ width: `${progressPct}%` }" />
        </div>
      </div>
      <p v-else class="play-copy is-center">这一站尚未配置观展短片。</p>

      <p class="play-status">{{ statusText }}</p>

      <div class="play-actions">
        <button v-if="hasVideo" type="button" class="play-btn is-primary" @click="togglePlay">
          播放
        </button>
        <button
          v-if="canComplete"
          type="button"
          class="play-btn"
          :disabled="finishing"
          @click="handleSkipStage">
          {{ finishing ? "处理中…" : "跳过本站" }}
        </button>
        <button type="button" class="play-btn" @click="setPhase('scan')">
          返回扫一扫
        </button>
      </div>
      <slot name="actions" />
    </section>
  </div>
</template>

<style scoped>
.find-chain {
  --sp-void: #0a0908;
  --sp-line: rgba(255, 248, 230, 0.08);
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
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.25rem;
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
  min-width: 0;
  color: var(--sp-fg);
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.25;
}

.play-title.is-lg {
  font-size: 1.85rem;
  line-height: 1.15;
}

.play-copy {
  margin: 0;
  color: var(--sp-fg-dim);
  font-size: 0.875rem;
  line-height: 1.5;
}

.play-copy.is-center {
  text-align: center;
}

.play-footnote,
.play-status {
  margin: 0;
  color: var(--sp-fg-dim);
  font-size: 0.75rem;
  line-height: 1.45;
}

.play-status {
  text-align: center;
  font-size: 0.875rem;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border-radius: 1rem;
  background: rgba(10, 9, 8, 0.45);
  padding: 1rem;
}

.info-dot {
  width: 0.625rem;
  height: 0.625rem;
  margin-top: 0.35rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--sp-gold);
}

.info-label {
  margin: 0;
  color: var(--sp-fg-dim);
  font-size: 0.75rem;
}

.info-value {
  margin: 0.25rem 0 0;
  color: var(--sp-fg);
  font-size: 0.875rem;
  font-weight: 500;
}

.tips-block,
.scan-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-label {
  margin: 0;
  color: var(--sp-fg);
  font-size: 0.875rem;
  font-weight: 600;
}

.tip-item {
  display: flex;
  gap: 0.75rem;
  border-radius: 1rem;
  background: rgba(10, 9, 8, 0.45);
  padding: 1rem;
  color: var(--sp-fg-dim);
  font-size: 0.875rem;
  line-height: 1.5;
}

.tip-index {
  display: flex;
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(209, 178, 111, 0.15);
  color: var(--sp-gold);
  font-size: 0.75rem;
  font-weight: 600;
}

.scan-frame {
  overflow: hidden;
  border: 1px solid rgba(255, 248, 230, 0.08);
  border-radius: 1rem;
  background: #0c0d10;
  padding: 0.75rem;
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

.play-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.play-btn.is-primary {
  border-color: rgba(209, 178, 111, 0.42);
  background: linear-gradient(145deg, rgba(232, 201, 138, 0.95), rgba(184, 150, 69, 0.95));
  color: #1a160c;
}

.play-btn.is-compact {
  width: auto;
  flex-shrink: 0;
  padding: 0.45rem 0.85rem;
  font-size: 0.8rem;
}

.film-stage {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
  overflow: auto;
  padding: 0.25rem 0.15rem 0.5rem;
}

.find-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.find-top__ask {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.film-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.film-head__trail {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.45rem;
}

.film-head__ask {
  display: flex;
  align-items: center;
}

.film-frame {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(209, 178, 111, 0.22);
  border-radius: 1.25rem;
  background: rgba(0, 0, 0, 0.45);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35),
    0 24px 60px rgba(0, 0, 0, 0.45),
    inset 0 0 40px rgba(209, 178, 111, 0.06);
}

.film-video {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: #080706;
  cursor: pointer;
}

.film-progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

.film-progress span {
  display: block;
  height: 100%;
  background: var(--sp-gold);
  transition: width 0.15s linear;
}
</style>
