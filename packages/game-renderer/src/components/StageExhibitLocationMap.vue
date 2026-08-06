<script setup lang="ts">
/**
 * 关卡定位入口：标题 + 右侧 pin icon；点击打开通用地图弹层。
 */
import { computed, shallowRef, useTemplateRef } from "vue"
import type { ExhibitMapOverlayPoint, StageExhibitLocationMap } from "../contracts"
import ExhibitLocationMapOverlay from "./ExhibitLocationMapOverlay.vue"

const props = withDefaults(
  defineProps<{
    location: StageExhibitLocationMap
    /** 展示为可点击标题 */
    title?: string | null
    /** 字号档：与各题面 .nr-title / .play-title 对齐 */
    size?: "narration" | "md" | "lg"
  }>(),
  {
    title: "",
    size: "md",
  },
)

const open = shallowRef(false)
const triggerRef = useTemplateRef<HTMLButtonElement>("trigger")

const displayTitle = computed(
  () =>
    String(props.title || props.location.exhibitName || props.location.pointTitle || "").trim()
    || "查看位置",
)
const galleryLabel = computed(
  () => String(props.location.galleryName || "").trim() || "展厅地图",
)
const pointLabel = computed(
  () =>
    String(props.location.pointTitle || props.location.exhibitName || "").trim()
    || "当前位置",
)
const overlayPoints = computed<ExhibitMapOverlayPoint[]>(() => [
  {
    id: "stage-pin",
    title: pointLabel.value,
    xPercent: Number(props.location.xPercent) || 0,
    yPercent: Number(props.location.yPercent) || 0,
  },
])

const openMap = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  open.value = true
}

const closeMap = () => {
  open.value = false
}
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="loc-title-trigger"
    :class="`is-${size}`"
    :title="`查看「${displayTitle}」展厅位置`"
    :aria-label="`查看「${displayTitle}」展厅位置`"
    @click="openMap"
  >
    <span class="loc-title-trigger__text">{{ displayTitle }}</span>
    <svg class="loc-title-trigger__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  </button>

  <ExhibitLocationMapOverlay
    :open="open"
    :image-url="location.imageUrl"
    :gallery-name="galleryLabel"
    :subtitle="pointLabel"
    :points="overlayPoints"
    focus-point-id="stage-pin"
    :anchor-el="triggerRef"
    @close="closeMap"
    @update:open="(value) => { open = value }"
  />
</template>

<style scoped>
.loc-title-trigger {
  display: flex;
  width: 100%;
  max-width: 100%;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.loc-title-trigger__icon {
  flex-shrink: 0;
  width: 1em;
  height: 1em;
  margin-left: auto;
  color: #d1b26f;
  opacity: 0.95;
}

.loc-title-trigger__text {
  min-width: 0;
  flex: 1 1 auto;
  color: #f7efdd;
  line-height: 1.25;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
}

.loc-title-trigger.is-narration {
  font-size: 1.28rem;
  font-weight: 650;
}

.loc-title-trigger.is-md {
  font-size: 1.5rem;
  font-weight: 600;
}

.loc-title-trigger.is-lg {
  font-size: 1.85rem;
  font-weight: 600;
  line-height: 1.15;
}

.loc-title-trigger:hover .loc-title-trigger__text {
  color: #efd391;
}

.loc-title-trigger:hover .loc-title-trigger__icon {
  color: #e8c98a;
}

.loc-title-trigger:active {
  opacity: 0.9;
}
</style>
