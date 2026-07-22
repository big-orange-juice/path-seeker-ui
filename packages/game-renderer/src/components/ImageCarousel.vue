<script setup lang="ts">
/**
 * 解说配图轮播：GSAP 淡入切换，供 admin 模拟器与 H5 共用。
 * 只负责展示 URL 列表，不关心上传/绑定。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { gsap } from "gsap"

const props = withDefaults(
  defineProps<{
    images?: string[] | null
    /** 是否自动轮播；单图时忽略 */
    autoplay?: boolean
    intervalMs?: number
  }>(),
  {
    images: () => [],
    autoplay: true,
    intervalMs: 4200,
  },
)

const root = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
let ctx: gsap.Context | null = null
let timer: ReturnType<typeof setInterval> | null = null
let animating = false

const urls = computed(() =>
  (props.images || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean),
)

const hasMultiple = computed(() => urls.value.length > 1)

const clearTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const scheduleAutoplay = () => {
  clearTimer()
  if (!props.autoplay || !hasMultiple.value) return
  timer = setInterval(() => {
    void goTo(activeIndex.value + 1)
  }, Math.max(2200, props.intervalMs))
}

const paintSlides = async (fromIndex: number, toIndex: number, animate: boolean) => {
  await nextTick()
  if (!root.value) return

  ctx?.revert()
  ctx = gsap.context(() => {
    const slides = root.value!.querySelectorAll<HTMLElement>("[data-carousel-slide]")
    slides.forEach((slide, index) => {
      const isActive = index === toIndex
      if (!animate || fromIndex === toIndex) {
        gsap.set(slide, {
          autoAlpha: isActive ? 1 : 0,
          scale: isActive ? 1 : 1.02,
          zIndex: isActive ? 2 : 1,
        })
        return
      }
      if (index === fromIndex) {
        gsap.to(slide, {
          autoAlpha: 0,
          scale: 0.98,
          duration: 0.38,
          ease: "power2.inOut",
          zIndex: 1,
        })
      } else if (index === toIndex) {
        gsap.fromTo(
          slide,
          { autoAlpha: 0, scale: 1.04, zIndex: 3 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.42,
            ease: "power2.out",
            zIndex: 2,
          },
        )
      } else {
        gsap.set(slide, { autoAlpha: 0, zIndex: 1 })
      }
    })
  }, root.value)
}

const goTo = async (index: number, options?: { animate?: boolean }) => {
  if (!urls.value.length || animating) return
  const len = urls.value.length
  const next = ((index % len) + len) % len
  const prev = activeIndex.value
  if (next === prev && options?.animate !== false) return

  animating = true
  activeIndex.value = next
  try {
    await paintSlides(prev, next, options?.animate !== false)
  } finally {
    animating = false
    scheduleAutoplay()
  }
}

watch(
  urls,
  async (list) => {
    activeIndex.value = 0
    await paintSlides(0, 0, false)
    scheduleAutoplay()
    if (!list.length) clearTimer()
  },
  { immediate: true },
)

onMounted(() => {
  void paintSlides(0, 0, false)
  scheduleAutoplay()
})

onUnmounted(() => {
  clearTimer()
  ctx?.revert()
  ctx = null
})
</script>

<template>
  <div ref="root" class="ic">
    <div v-if="urls.length" class="ic-stage">
      <div
        v-for="(url, index) in urls"
        :key="`${index}-${url.slice(0, 48)}`"
        class="ic-slide"
        data-carousel-slide
        :aria-hidden="index !== activeIndex">
        <img :src="url" alt="" class="ic-img" draggable="false">
      </div>
    </div>
    <div v-else class="ic-empty">
      <span>暂无配图</span>
    </div>

    <div v-if="hasMultiple" class="ic-dots" role="tablist" aria-label="配图切换">
      <button
        v-for="(_, index) in urls"
        :key="`dot-${index}`"
        type="button"
        class="ic-dot"
        :class="{ 'is-active': index === activeIndex }"
        :aria-label="`第 ${index + 1} 张`"
        :aria-selected="index === activeIndex"
        @click="goTo(index)" />
    </div>
  </div>
</template>

<style scoped>
.ic {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 10px;
}

.ic-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 180px;
  overflow: hidden;
  border-radius: 12px;
  background: rgb(0 0 0 / 28%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 6%);
}

.ic-slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  visibility: hidden;
}

.ic-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  -webkit-user-drag: none;
}

.ic-empty {
  display: grid;
  min-height: 180px;
  flex: 1;
  place-items: center;
  border-radius: 12px;
  border: 1px dashed rgb(255 255 255 / 12%);
  background: rgb(0 0 0 / 18%);
  color: rgb(247 239 221 / 42%);
  font-size: 13px;
}

.ic-dots {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  gap: 6px;
}

.ic-dot {
  width: 6px;
  height: 6px;
  border: 0;
  border-radius: 999px;
  background: rgb(255 255 255 / 22%);
  padding: 0;
  cursor: pointer;
  transition:
    width 0.2s ease,
    background 0.2s ease;
}

.ic-dot.is-active {
  width: 16px;
  background: #e8d18a;
}
</style>
