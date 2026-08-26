<script setup lang="ts">
/**
 * 问答气泡内位置卡：
 * - 状态文案（located / multi / gallery_only / map_unavailable / unbound）
 * - 有底图时展示缩略图
 * - 可绘时打开多图/多点地图弹层
 */
import { computed, shallowRef, useTemplateRef } from "vue"
import { useRouter } from "vue-router"
import type { ExhibitMapOverlayModel } from "@path-seeker/game-renderer"
import ExhibitLocationMapOverlay from "@path-seeker/game-renderer/exhibit-location-map-overlay"
import type { ExhibitChatLocationItem } from "@/types/exhibitChat"
import {
  canOpenExhibitLocationMap,
  formatExhibitLocationCta,
  formatExhibitLocationDetailLine,
  formatExhibitLocationStatusHint,
  getLocationPreviewImageUrl,
  toExhibitMapOverlayModel,
  toOutdoorMapFocusModel,
} from "@/utils/exhibitLocationView"

const props = defineProps<{
  locations: ExhibitChatLocationItem[]
}>()
const router = useRouter()

const open = shallowRef(false)
const activeModel = shallowRef<ExhibitMapOverlayModel | null>(null)
const listRef = useTemplateRef<HTMLElement>("listEl")
const thumbFailed = shallowRef<Record<string, boolean>>({})

const items = computed(() =>
  (props.locations || []).filter((item) => item && typeof item === "object"),
)

function itemKey(item: ExhibitChatLocationItem, index: number) {
  return `${item.exhibitId || item.exhibitName || "loc"}-${index}`
}

function placeDetail(item: ExhibitChatLocationItem) {
  return formatExhibitLocationDetailLine(item)
}

function statusHint(item: ExhibitChatLocationItem) {
  return formatExhibitLocationStatusHint(item)
}

function exhibitTitle(item: ExhibitChatLocationItem) {
  return String(item.exhibitName || "").trim() || "相关展品"
}

function showcaseLine(item: ExhibitChatLocationItem) {
  const no = String(item.showcaseNo || "").trim()
  return no ? `展柜 ${no}` : ""
}

function ctaLabel(item: ExhibitChatLocationItem) {
  return formatExhibitLocationCta(item)
}

function isOpenable(item: ExhibitChatLocationItem) {
  return canOpenExhibitLocationMap(item)
}

function thumbUrl(item: ExhibitChatLocationItem) {
  return getLocationPreviewImageUrl(item)
}

function showThumb(item: ExhibitChatLocationItem, index: number) {
  const url = thumbUrl(item)
  if (!url) return false
  return !thumbFailed.value[itemKey(item, index)]
}

function onThumbError(item: ExhibitChatLocationItem, index: number) {
  const key = itemKey(item, index)
  thumbFailed.value = { ...thumbFailed.value, [key]: true }
}

function openMap(item: ExhibitChatLocationItem) {
  const model = toExhibitMapOverlayModel(item)
  if (model) {
    activeModel.value = model
    open.value = true
    return
  }
  const outdoor = toOutdoorMapFocusModel(item)
  if (!outdoor?.exhibitId) return
  void router.push({ path: `/map`, query: { assetId: outdoor.exhibitId } })
}

function closeMap() {
  open.value = false
  activeModel.value = null
}

function statusClass(item: ExhibitChatLocationItem) {
  const status = String(item.status || "").trim() || "unknown"
  return `is-${status}`
}
</script>

<template>
  <div v-if="items.length" ref="listEl" class="ask-loc-list">
    <span class="ask-loc-label">位置</span>

    <button
      v-for="(item, index) in items"
      :key="itemKey(item, index)"
      type="button"
      class="ask-loc-card"
      :class="[
        statusClass(item),
        { 'is-openable': isOpenable(item), 'has-thumb': showThumb(item, index) },
      ]"
      :disabled="!isOpenable(item)"
      :aria-label="
        isOpenable(item)
          ? `查看「${exhibitTitle(item)}」展厅位置`
          : `${exhibitTitle(item)}，${statusHint(item)}`
      "
      @click="openMap(item)"
    >
      <span
        v-if="showThumb(item, index)"
        class="ask-loc-card__thumb"
        aria-hidden="true"
      >
        <img
          :src="thumbUrl(item) || ''"
          alt=""
          loading="lazy"
          @error="onThumbError(item, index)"
        >
      </span>
      <span
        v-else
        class="ask-loc-card__pin"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
          <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      </span>

      <span class="ask-loc-card__body">
        <span class="ask-loc-card__title">{{ exhibitTitle(item) }}</span>
        <span class="ask-loc-card__place">{{ placeDetail(item) }}</span>
        <span v-if="showcaseLine(item)" class="ask-loc-card__meta">{{ showcaseLine(item) }}</span>
      </span>

      <span
        class="ask-loc-card__cta"
        :class="{ 'is-muted': !isOpenable(item) }"
      >
        {{ ctaLabel(item) }}
      </span>
    </button>

    <ExhibitLocationMapOverlay
      v-if="activeModel"
      :open="open"
      :image-url="activeModel.imageUrl || ''"
      :gallery-name="activeModel.galleryName"
      :subtitle="activeModel.subtitle"
      :points="activeModel.points || []"
      :maps="activeModel.maps || null"
      :initial-map-id="activeModel.initialMapId"
      :focus-point-id="activeModel.focusPointId"
      :anchor-el="listRef"
      @close="closeMap"
      @update:open="(value) => { if (!value) closeMap() }"
    />
  </div>
</template>

<style scoped>
.ask-loc-list {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.55rem;
  padding-top: 0.45rem;
  border-top: 1px solid rgba(255, 248, 230, 0.06);
}

.ask-loc-label {
  font-size: 0.62rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  color: rgba(242, 235, 224, 0.45);
}

.ask-loc-card {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  padding: 0.5rem 0.55rem;
  border: 1px solid rgba(209, 178, 111, 0.22);
  border-radius: 0.75rem;
  background: linear-gradient(
    135deg,
    rgba(209, 178, 111, 0.12),
    rgba(209, 178, 111, 0.04)
  );
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: default;
  -webkit-tap-highlight-color: transparent;
}

.ask-loc-card.is-openable {
  cursor: pointer;
}

.ask-loc-card.is-openable:active {
  border-color: rgba(209, 178, 111, 0.42);
  background: linear-gradient(
    135deg,
    rgba(209, 178, 111, 0.18),
    rgba(209, 178, 111, 0.08)
  );
}

.ask-loc-card:disabled {
  opacity: 0.95;
}

.ask-loc-card.is-unbound,
.ask-loc-card.is-map_unavailable {
  border-color: rgba(255, 248, 230, 0.1);
  background: rgba(255, 255, 255, 0.03);
}

.ask-loc-card.is-gallery_only {
  border-color: rgba(209, 178, 111, 0.16);
}

.ask-loc-card__thumb {
  position: relative;
  flex-shrink: 0;
  width: 2.6rem;
  height: 2.6rem;
  overflow: hidden;
  border-radius: 0.5rem;
  border: 1px solid rgba(209, 178, 111, 0.28);
  background: rgba(12, 10, 8, 0.55);
}

.ask-loc-card__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ask-loc-card__pin {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(209, 178, 111, 0.28);
  background: rgba(12, 10, 8, 0.35);
  color: #d1b26f;
}

.ask-loc-card__pin svg {
  width: 1rem;
  height: 1rem;
}

.ask-loc-card__body {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 0.12rem;
}

.ask-loc-card__title {
  color: #f3e6c4;
  font-size: 0.78rem;
  font-weight: 650;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ask-loc-card__place,
.ask-loc-card__meta {
  color: rgba(242, 235, 224, 0.58);
  font-size: 0.66rem;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ask-loc-card.is-unbound .ask-loc-card__place,
.ask-loc-card.is-map_unavailable .ask-loc-card__place,
.ask-loc-card.is-gallery_only .ask-loc-card__place {
  color: rgba(232, 201, 138, 0.72);
}

.ask-loc-card__cta {
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.32);
  background: rgba(209, 178, 111, 0.12);
  padding: 0.2rem 0.48rem;
  color: #efd391;
  font-size: 0.62rem;
  font-weight: 650;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.ask-loc-card__cta.is-muted {
  border-color: rgba(255, 248, 230, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(242, 235, 224, 0.48);
  font-weight: 550;
}
</style>
