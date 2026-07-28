<script setup lang="ts">
import { computed } from "vue"
import { RouterLink } from "vue-router"
import defaultPost from "@/assets/images/default-post.png"
import type { MissionRouteCard } from "@/types/mission"

interface Props {
  mission: MissionRouteCard
  returnGuideId?: string
}

const props = defineProps<Props>()

const coverUrl = computed(() => {
  const url = String(props.mission.coverImageUrl || "").trim()
  return url || defaultPost
})

/**
 * 按站数分档图高：站越多越高，瀑布参差。
 * ≤3 站 short / 4–6 站 mid / ≥7 站 tall；未知站数回落 mid。
 */
const heightTone = computed((): "tall" | "mid" | "short" => {
  const stations = Number(props.mission.chapterCount || 0)
  if (stations >= 7) return "tall"
  if (stations >= 4) return "mid"
  if (stations > 0) return "short"
  return "mid"
})

/** 眉题：只留站数 / 时长，不展示难度、规模分类 */
const eyebrow = computed(() =>
  [
    props.mission.chapterCount ? `${props.mission.chapterCount} 站` : "",
    props.mission.estimatedMinutes ? `${props.mission.estimatedMinutes} 分钟` : "",
  ]
    .filter(Boolean)
    .join(" · "),
)

const caption = computed(() => {
  const theme = String(props.mission.theme || "").trim()
  if (theme) return theme
  return String(props.mission.summary || "").trim()
})

const guideName = computed(() => String(props.mission.guideName || "").trim())
const guideTags = computed(() =>
  (props.mission.guideTags || [])
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .slice(0, 3),
)
const hasGuideMeta = computed(() => Boolean(guideName.value || guideTags.value.length))
const destination = computed(() => ({
  path: `/missions/${encodeURIComponent(props.mission.id)}/map`,
  query: props.returnGuideId
    ? { fromGuide: "1", guideId: props.returnGuideId }
    : undefined,
}))
</script>

<template>
  <!--
    艺术海报块：封面为舞台，题字压在底部溶晕区。
    无卡片壳；底缘 mask 溶进星空底，像墙上的印刷品。
  -->
  <RouterLink
    :to="destination"
    class="mission-plate"
    :class="`is-${heightTone}`"
  >
    <div class="mission-plate__stage">
      <img
        class="mission-plate__img"
        :src="coverUrl"
        :alt="mission.title"
        loading="lazy"
      >

      <!-- 暗角 + 底晕：图仍清晰，题字有落脚 -->
      <div class="mission-plate__veil" aria-hidden="true" />

      <!-- 展品登记角标 -->
      <span class="mission-plate__mark mission-plate__mark--tl" aria-hidden="true" />
      <span class="mission-plate__mark mission-plate__mark--br" aria-hidden="true" />

      <div class="mission-plate__copy">
        <p v-if="eyebrow" class="mission-plate__eyebrow">
          <span class="mission-plate__dot" aria-hidden="true" />
          {{ eyebrow }}
        </p>
        <h3 class="mission-plate__title font-display">{{ mission.title }}</h3>
        <p v-if="caption" class="mission-plate__caption">{{ caption }}</p>

        <!-- 导游署名：名称 + 标签，压在海报底缘 -->
        <div v-if="hasGuideMeta" class="mission-plate__guide">
          <span v-if="guideName" class="mission-plate__guide-name">
            {{ guideName }}
          </span>
          <span
            v-for="tag in guideTags"
            :key="tag"
            class="mission-plate__guide-tag"
          >
            {{ tag }}
          </span>
        </div>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.mission-plate {
  display: block;
  break-inside: avoid;
  margin: 0 0 0.85rem;
  text-decoration: none;
  color: inherit;
  transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.mission-plate:active {
  transform: scale(0.985);
}

/* 舞台：整块是图 + 字，无边框面板 */
.mission-plate__stage {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  /* 底缘溶进页底，消掉「卡片底板」感 */
  -webkit-mask-image: linear-gradient(
    180deg,
    #000 0%,
    #000 72%,
    rgba(0, 0, 0, 0.72) 88%,
    transparent 100%
  );
  mask-image: linear-gradient(
    180deg,
    #000 0%,
    #000 72%,
    rgba(0, 0, 0, 0.72) 88%,
    transparent 100%
  );
}

.mission-plate.is-tall .mission-plate__stage {
  min-height: 15.2rem;
}

.mission-plate.is-mid .mission-plate__stage {
  min-height: 13rem;
}

.mission-plate.is-short .mission-plate__stage {
  min-height: 11rem;
}

.mission-plate__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 28%;
  /* 博物馆印刷感：略暖、略压高光 */
  filter: saturate(0.9) brightness(0.88) contrast(1.06) sepia(0.08);
  transform: scale(1.03);
}

.mission-plate__veil {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    /* 顶部轻暗，不抢图 */
    linear-gradient(
      180deg,
      rgba(10, 9, 8, 0.22) 0%,
      transparent 28%
    ),
    /* 底部长晕：题字落脚，上半仍见图 */
    linear-gradient(
      180deg,
      transparent 28%,
      rgba(10, 9, 8, 0.18) 48%,
      rgba(10, 9, 8, 0.55) 68%,
      rgba(10, 9, 8, 0.9) 100%
    ),
    /* 暖金余晖 */
    radial-gradient(
      90% 55% at 40% 100%,
      rgba(209, 178, 111, 0.16),
      transparent 62%
    ),
    /* 轻暗角 */
    radial-gradient(
      120% 100% at 50% 40%,
      transparent 42%,
      rgba(10, 9, 8, 0.28) 100%
    );
}

/* 对角登记线：像展签/印刷套准 */
.mission-plate__mark {
  position: absolute;
  z-index: 2;
  width: 0.85rem;
  height: 0.85rem;
  pointer-events: none;
  opacity: 0.72;
}

.mission-plate__mark--tl {
  top: 0.55rem;
  left: 0.5rem;
  border-top: 1px solid rgba(232, 201, 138, 0.7);
  border-left: 1px solid rgba(232, 201, 138, 0.7);
}

.mission-plate__mark--br {
  right: 0.5rem;
  bottom: 1.35rem;
  border-right: 1px solid rgba(232, 201, 138, 0.35);
  border-bottom: 1px solid rgba(232, 201, 138, 0.35);
}

.mission-plate__copy {
  position: relative;
  z-index: 2;
  display: flex;
  min-height: inherit;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.28rem;
  padding: 1.1rem 0.7rem 1.05rem;
}

.mission-plate__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  color: rgba(232, 201, 138, 0.9);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  line-height: 1.3;
  text-transform: none;
}

.mission-plate__dot {
  width: 0.28rem;
  height: 0.28rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: rgba(232, 201, 138, 0.85);
  box-shadow: 0 0 8px rgba(209, 178, 111, 0.45);
}

.mission-plate__title {
  margin: 0;
  max-width: 12em;
  color: #faf4ea;
  font-size: 1.12rem;
  font-weight: 650;
  line-height: 1.22;
  letter-spacing: 0.02em;
  text-shadow:
    0 1px 1px rgba(0, 0, 0, 0.35),
    0 8px 22px rgba(0, 0, 0, 0.35);
}

.mission-plate__caption {
  margin: 0.1rem 0 0;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  max-width: 16em;
  color: rgba(242, 235, 224, 0.72);
  font-size: 11px;
  line-height: 1.45;
  letter-spacing: 0.01em;
}

.mission-plate__guide {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.28rem;
  margin-top: 0.35rem;
  max-width: 100%;
}

.mission-plate__guide-name {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(250, 244, 234, 0.92);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1.3;
}

.mission-plate__guide-name::before {
  content: "";
  display: inline-block;
  width: 0.55rem;
  height: 1px;
  margin-right: 0.32rem;
  background: rgba(232, 201, 138, 0.55);
  vertical-align: middle;
}

.mission-plate__guide-tag {
  display: inline-flex;
  align-items: center;
  max-width: 5.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999px;
  border: 1px solid rgba(232, 201, 138, 0.28);
  background: rgba(10, 9, 8, 0.35);
  padding: 0.08rem 0.38rem;
  color: rgba(232, 201, 138, 0.88);
  font-size: 9px;
  letter-spacing: 0.02em;
  line-height: 1.25;
}
</style>
