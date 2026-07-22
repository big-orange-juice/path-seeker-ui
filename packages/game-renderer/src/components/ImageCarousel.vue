<script setup lang="ts">
/**
 * 解说配图叠层轮播：固定高度、透视堆叠、抛掷切换、滑动与点击放大。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { gsap } from "gsap"

const props = withDefaults(
  defineProps<{
    images?: string[] | null
    autoplay?: boolean
    intervalMs?: number
    /** 舞台高度（px）；0 表示填满父级 */
    height?: number
  }>(),
  {
    images: () => [],
    autoplay: true,
    intervalMs: 5200,
    height: 0,
  },
)

const root = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
const previewOpen = ref(false)
const isDragging = ref(false)

let timer: ReturnType<typeof setInterval> | null = null
let animating = false
let layoutTl: gsap.core.Timeline | null = null
let pointerId: number | null = null
let startX = 0
let startY = 0
let lastX = 0
let lockAxis: "x" | "y" | null = null
let didDrag = false
/** 最近一次切换方向：1 下一张 / -1 上一张 */
let lastDir = 1

const urls = computed(() =>
  (props.images || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean),
)

const hasMultiple = computed(() => urls.value.length > 1)
const fillParent = computed(() => !(Number(props.height) > 0))
const stageHeight = computed(() =>
  fillParent.value ? 0 : Math.max(160, Number(props.height) || 236),
)
const stageStyle = computed(() =>
  fillParent.value
    ? { height: "100%", minHeight: "12rem" }
    : { height: `${stageHeight.value}px` },
)

const clearTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const scheduleAutoplay = () => {
  clearTimer()
  if (!props.autoplay || !hasMultiple.value || previewOpen.value) return
  timer = setInterval(() => {
    void goTo(activeIndex.value + 1, { dir: 1 })
  }, Math.max(2600, props.intervalMs))
}

function stackDepth(index: number, active: number, len: number) {
  if (len <= 1) return 0
  const raw = (index - active + len) % len
  if (raw === 0) return 0
  if (raw === len - 1) return -1
  return raw
}

function stackPose(depth: number, dragX = 0) {
  if (depth === 0) {
    return {
      x: dragX,
      y: 0,
      scale: 1,
      rotation: dragX * 0.045,
      rotationY: dragX * -0.08,
      opacity: 1,
      zIndex: 30,
      filter: "blur(0px)",
    }
  }
  if (depth === -1) {
    const reveal = Math.max(0, Math.min(1, dragX / 90))
    return {
      x: -22 + dragX * 0.2,
      y: 8,
      scale: 0.9 + reveal * 0.06,
      rotation: -8,
      rotationY: 8,
      opacity: 0.22 + reveal * 0.55,
      zIndex: 22,
      filter: `blur(${(1 - reveal) * 1.2}px)`,
    }
  }
  if (depth === 1) {
    const push = Math.max(0, -dragX) / 100
    return {
      x: 16 - push * 10,
      y: 12,
      scale: 0.88 + push * 0.08,
      rotation: 6,
      rotationY: -6,
      opacity: 0.78,
      zIndex: 18,
      filter: "blur(0.4px)",
    }
  }
  if (depth === 2) {
    return {
      x: 28,
      y: 20,
      scale: 0.8,
      rotation: 10,
      rotationY: -8,
      opacity: 0.4,
      zIndex: 12,
      filter: "blur(1px)",
    }
  }
  return {
    x: 34,
    y: 26,
    scale: 0.74,
    rotation: 12,
    rotationY: -10,
    opacity: 0,
    zIndex: 4,
    filter: "blur(2px)",
  }
}

const getSlides = () =>
  root.value?.querySelectorAll<HTMLElement>("[data-carousel-slide]") ?? []

/** 静止叠层（拖动跟手 / 初始化） */
const applyStackInstant = (dragX = 0) => {
  if (!root.value) return
  const len = urls.value.length
  const active = activeIndex.value
  getSlides().forEach((slide, index) => {
    const depth = stackDepth(index, active, len)
    const pose = stackPose(depth, dragX)
    gsap.set(slide, {
      ...pose,
      transformOrigin: "50% 85%",
      transformPerspective: 900,
      force3D: true,
    })
  })
}

/**
 * 抛掷切换：离场卡飞出 + 入场卡从堆叠抬起 + 后层错落入位。
 */
const playThrow = (fromIndex: number, toIndex: number, dir: number) => {
  if (!root.value) return Promise.resolve()
  layoutTl?.kill()

  const len = urls.value.length
  const slides = Array.from(getSlides())
  const outSlide = slides[fromIndex]
  const inSlide = slides[toIndex]

  layoutTl = gsap.timeline({
    defaults: { force3D: true, transformPerspective: 900 },
  })

  // 离场：向滑动反方向抛出
  if (outSlide && fromIndex !== toIndex) {
    const flyX = dir > 0 ? -130 : 130
    const flyRot = dir > 0 ? -22 : 22
    layoutTl.to(
      outSlide,
      {
        x: flyX,
        y: -12,
        scale: 0.86,
        rotation: flyRot,
        rotationY: dir > 0 ? 28 : -28,
        opacity: 0,
        filter: "blur(4px)",
        zIndex: 40,
        duration: 0.48,
        ease: "power3.in",
      },
      0,
    )
  }

  // 全体按新 active 归位（入场卡带 overshoot）
  slides.forEach((slide, index) => {
    const depth = stackDepth(index, toIndex, len)
    const pose = stackPose(depth, 0)
    const isIn = index === toIndex
    const isOut = index === fromIndex

    if (isOut) {
      // 离场结束后悄悄归到「上一张侧影」位，避免闪回
      layoutTl!.set(
        slide,
        {
          ...stackPose(-1, 0),
          x: dir > 0 ? -40 : 40,
          opacity: 0,
          filter: "blur(2px)",
        },
        0.48,
      )
      layoutTl!.to(
        slide,
        {
          ...stackPose(-1, 0),
          duration: 0.4,
          ease: "power2.out",
        },
        0.5,
      )
      return
    }

    if (isIn) {
      layoutTl!.fromTo(
        slide,
        {
          x: dir > 0 ? 36 : -28,
          y: 22,
          scale: 0.82,
          rotation: dir > 0 ? 12 : -8,
          rotationY: dir > 0 ? -16 : 12,
          opacity: 0.55,
          filter: "blur(1.5px)",
          zIndex: 28,
          transformOrigin: "50% 85%",
        },
        {
          ...pose,
          duration: 0.58,
          ease: "power3.out",
        },
        0.08,
      )
      // 轻弹一下 scale
      layoutTl!.to(
        slide,
        {
          scale: 1.02,
          duration: 0.16,
          ease: "power1.out",
        },
        0.55,
      )
      layoutTl!.to(
        slide,
        {
          scale: 1,
          duration: 0.22,
          ease: "power2.inOut",
        },
        0.7,
      )
      return
    }

    layoutTl!.to(
      slide,
      {
        ...pose,
        transformOrigin: "50% 85%",
        duration: 0.55,
        ease: "power3.out",
      },
      0.06 + Math.min(depth, 3) * 0.04,
    )
  })

  return new Promise<void>((resolve) => {
    layoutTl!.eventCallback("onComplete", () => resolve())
  })
}

const goTo = async (
  index: number,
  options?: { animate?: boolean; dir?: number },
) => {
  if (!urls.value.length || animating) return
  const len = urls.value.length
  const next = ((index % len) + len) % len
  const prev = activeIndex.value
  if (next === prev && options?.animate !== false) return

  const dir =
    options?.dir
    ?? (next === (prev + 1) % len ? 1 : next === (prev - 1 + len) % len ? -1 : lastDir)
  lastDir = dir

  animating = true
  activeIndex.value = next
  try {
    await nextTick()
    if (options?.animate === false) {
      applyStackInstant(0)
    } else {
      await playThrow(prev, next, dir)
    }
  } finally {
    animating = false
    scheduleAutoplay()
  }
}

const openPreview = () => {
  if (!urls.value.length || didDrag) return
  previewOpen.value = true
  clearTimer()
}

const closePreview = () => {
  previewOpen.value = false
  scheduleAutoplay()
}

const onPointerDown = (event: PointerEvent) => {
  // 预览态也允许左右滑切
  if (!urls.value.length || animating) return
  pointerId = event.pointerId
  startX = event.clientX
  startY = event.clientY
  lastX = event.clientX
  lockAxis = null
  didDrag = false
  isDragging.value = false
  clearTimer()
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}

const onPointerMove = (event: PointerEvent) => {
  if (pointerId !== event.pointerId || animating) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY

  if (!lockAxis) {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
    lockAxis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y"
  }
  if (lockAxis === "y" || !hasMultiple.value) return

  event.preventDefault()
  isDragging.value = true
  if (Math.abs(dx) > 8) didDrag = true
  lastX = event.clientX
  applyStackInstant(Math.max(-140, Math.min(140, dx * 0.9)))
}

const onPointerUp = (event: PointerEvent) => {
  if (pointerId !== event.pointerId) return
  pointerId = null
  const dx = lastX - startX
  const wasDrag = isDragging.value
  isDragging.value = false

  if (wasDrag && hasMultiple.value) {
    const threshold = 42
    if (dx <= -threshold) {
      void goTo(activeIndex.value + 1, { dir: 1 })
    } else if (dx >= threshold) {
      void goTo(activeIndex.value - 1, { dir: -1 })
    } else {
      // 回弹
      layoutTl?.kill()
      layoutTl = gsap.timeline()
      const len = urls.value.length
      getSlides().forEach((slide, index) => {
        const pose = stackPose(stackDepth(index, activeIndex.value, len), 0)
        layoutTl!.to(slide, {
          ...pose,
          transformOrigin: "50% 85%",
          duration: 0.42,
          ease: "power3.out",
        }, 0)
      })
      scheduleAutoplay()
    }
  } else {
    scheduleAutoplay()
  }

  window.setTimeout(() => {
    didDrag = false
  }, 50)
}

const onPointerCancel = (event: PointerEvent) => {
  if (pointerId !== event.pointerId) return
  pointerId = null
  isDragging.value = false
  applyStackInstant(0)
  scheduleAutoplay()
}

const onKeydown = (event: KeyboardEvent) => {
  if (!previewOpen.value) return
  if (event.key === "Escape") closePreview()
  if (event.key === "ArrowRight") void goTo(activeIndex.value + 1, { dir: 1 })
  if (event.key === "ArrowLeft") void goTo(activeIndex.value - 1, { dir: -1 })
}

watch(
  urls,
  async () => {
    activeIndex.value = 0
    await nextTick()
    applyStackInstant(0)
    scheduleAutoplay()
    if (!urls.value.length) clearTimer()
  },
  { immediate: true },
)

watch(() => props.autoplay, () => scheduleAutoplay())

onMounted(() => {
  void nextTick(() => applyStackInstant(0))
  scheduleAutoplay()
  window.addEventListener("keydown", onKeydown)
})

onUnmounted(() => {
  clearTimer()
  layoutTl?.kill()
  layoutTl = null
  window.removeEventListener("keydown", onKeydown)
})
</script>

<template>
  <div ref="root" class="ic" :class="{ 'is-fill': fillParent }" :style="stageStyle">
    <div
      v-if="urls.length"
      class="ic-stage"
      role="region"
      :aria-label="`配图 ${activeIndex + 1} / ${urls.length}`"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <div class="ic-floor" aria-hidden="true" />

      <button
        v-for="(url, index) in urls"
        :key="`${index}-${url.slice(0, 48)}`"
        type="button"
        class="ic-slide"
        data-carousel-slide
        :aria-hidden="index !== activeIndex"
        :tabindex="index === activeIndex ? 0 : -1"
        @click="index === activeIndex && openPreview()"
      >
        <img :src="url" alt="" class="ic-img" draggable="false">
      </button>

      <div class="ic-meta" aria-hidden="true">
        <span v-if="hasMultiple" class="ic-count">{{ activeIndex + 1 }} / {{ urls.length }}</span>
        <span class="ic-hint">{{ hasMultiple ? "滑切 · 点放大" : "点按放大" }}</span>
      </div>
    </div>

    <div v-else class="ic-empty">
      <span>暂无配图</span>
    </div>

    <Teleport to="body">
      <div
        v-if="previewOpen && urls.length"
        class="ic-preview"
        role="dialog"
        aria-modal="true"
        aria-label="配图预览"
        @click="closePreview"
      >
        <button
          type="button"
          class="ic-preview-close"
          aria-label="关闭"
          @click.stop="closePreview"
        >
          关闭
        </button>
        <!-- 仅图片本身拦截点击；其余区域点按关闭 -->
        <div
          class="ic-preview-body"
          @click.stop
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
        >
          <img
            class="ic-preview-img"
            :src="urls[activeIndex]"
            alt=""
            draggable="false"
            @click.stop="closePreview"
          >
        </div>
        <p v-if="hasMultiple" class="ic-preview-foot">
          {{ activeIndex + 1 }} / {{ urls.length }} · 点空白关闭 · 左右滑切换
        </p>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ic {
  position: relative;
  display: flex;
  width: 100%;
  flex-direction: column;
  touch-action: pan-y;
}

.ic.is-fill {
  height: 100%;
  min-height: 12rem;
}

.ic-stage {
  position: relative;
  height: 100%;
  min-height: inherit;
  flex: 1 1 auto;
  overflow: visible;
  perspective: 1100px;
  cursor: grab;
  user-select: none;
  touch-action: pan-y;
}

.ic-stage:active {
  cursor: grabbing;
}

.ic-floor {
  position: absolute;
  left: 14%;
  right: 14%;
  bottom: 8px;
  height: 16px;
  border-radius: 999px;
  background: radial-gradient(ellipse at center, rgb(0 0 0 / 48%), transparent 72%);
  filter: blur(3px);
  pointer-events: none;
  z-index: 1;
}

.ic-slide {
  position: absolute;
  inset: 0 8% 24px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 3px;
  overflow: hidden;
  background: #141210;
  box-shadow:
    0 20px 40px rgb(0 0 0 / 45%),
    0 0 0 1px rgb(255 248 230 / 7%);
  cursor: zoom-in;
  transform-origin: 50% 85%;
  will-change: transform, opacity, filter;
  backface-visibility: hidden;
}

.ic-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  filter: saturate(0.94) contrast(1.05);
}

.ic-meta {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0.15rem;
  pointer-events: none;
}

.ic-count {
  color: rgb(232 201 138 / 88%);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.12em;
  font-variant-numeric: tabular-nums;
}

.ic-hint {
  color: rgb(247 239 221 / 36%);
  font-size: 10px;
  letter-spacing: 0.04em;
}

.ic-empty {
  display: grid;
  height: 100%;
  min-height: 12rem;
  place-items: center;
  color: rgb(247 239 221 / 42%);
  font-size: 13px;
}

.ic-preview {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding:
    max(1rem, env(safe-area-inset-top))
    1rem
    max(1rem, env(safe-area-inset-bottom));
  background: rgb(6 5 4 / 92%);
  backdrop-filter: blur(14px);
  cursor: zoom-out;
}

.ic-preview-close {
  position: absolute;
  top: max(0.85rem, env(safe-area-inset-top));
  right: 1rem;
  z-index: 2;
  border: 0;
  background: transparent;
  color: rgb(232 201 138 / 90%);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  cursor: pointer;
  padding: 0.35rem 0.25rem;
}

.ic-preview-body {
  position: relative;
  display: flex;
  max-width: min(100%, 28rem);
  max-height: min(72dvh, 100%);
  align-items: center;
  justify-content: center;
  touch-action: pan-y;
  cursor: default;
}

.ic-preview-img {
  max-width: 100%;
  max-height: min(72dvh, 100%);
  object-fit: contain;
  border-radius: 2px;
  box-shadow: 0 24px 64px rgb(0 0 0 / 55%);
  user-select: none;
  -webkit-user-drag: none;
  cursor: zoom-out;
}

.ic-preview-foot {
  margin: 0;
  text-align: center;
  color: rgb(247 239 221 / 48%);
  font-size: 11px;
  letter-spacing: 0.06em;
  pointer-events: none;
}
</style>
