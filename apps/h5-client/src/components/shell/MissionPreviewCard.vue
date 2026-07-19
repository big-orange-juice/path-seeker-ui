<script setup lang="ts">
import { computed } from "vue"
import { RouterLink } from "vue-router"
import { getDifficultyLevelLabel, getScaleTypeLabel } from "@path-seeker/ts-shared"
import defaultPost from "@/assets/images/default-post.png"
import type { MissionRouteCard } from "@/types/mission"

interface Props {
  mission: MissionRouteCard
}

const props = defineProps<Props>()

const coverUrl = computed(() => {
  const url = String(props.mission.coverImageUrl || "").trim()
  return url || defaultPost
})

/**
 * 按站数分档卡片高度：站越多越高，体现路线体量。
 * ≤3 站 short / 4–6 站 mid / ≥7 站 tall；未知站数回落 mid。
 */
const heightTone = computed((): "tall" | "mid" | "short" => {
  const stations = Number(props.mission.chapterCount || 0)
  if (stations >= 7) return "tall"
  if (stations >= 4) return "mid"
  if (stations > 0) return "short"
  return "mid"
})

const difficultyLabel = computed(() =>
  getDifficultyLevelLabel(props.mission.difficultyLevel),
)

const scaleLabel = computed(() => getScaleTypeLabel(props.mission.scaleType))

const metaBits = computed(() =>
  [
    difficultyLabel.value,
    scaleLabel.value,
    props.mission.chapterCount ? `${props.mission.chapterCount} 站` : "",
    props.mission.estimatedMinutes ? `${props.mission.estimatedMinutes}′` : "",
  ].filter(Boolean),
)
</script>

<template>
  <RouterLink
    :to="`/missions/${mission.id}/map`"
    class="mission-post"
    :class="`is-${heightTone}`"
  >
    <div class="mission-post__media" aria-hidden="true">
      <img
        class="mission-post__img"
        :src="coverUrl"
        :alt="mission.title"
        loading="lazy"
      >
      <!-- 多层暗化 + 底部渐变，保证任意封面色下文字可读 -->
      <div class="mission-post__veil" />
      <div class="mission-post__grain" />
    </div>

    <div class="mission-post__body">
      <div class="mission-post__tags">
        <span
          v-for="(bit, index) in metaBits"
          :key="`${bit}-${index}`"
          class="mission-post__tag"
          :class="{ 'is-gold': index === 0 }"
        >
          {{ bit }}
        </span>
      </div>
      <h3 class="mission-post__title">
        {{ mission.title }}
      </h3>
      <p v-if="mission.theme" class="mission-post__theme">
        {{ mission.theme }}
      </p>
      <p v-else-if="mission.summary" class="mission-post__summary">
        {{ mission.summary }}
      </p>
    </div>
  </RouterLink>
</template>

<style scoped>
.mission-post {
  position: relative;
  display: block;
  break-inside: avoid;
  margin: 0 0 10px;
  overflow: hidden;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 248, 230, 0.08);
  background: #12110f;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.mission-post:active {
  transform: scale(0.985);
}

.mission-post.is-tall {
  min-height: 248px;
}

.mission-post.is-mid {
  min-height: 210px;
}

.mission-post.is-short {
  min-height: 178px;
}

.mission-post__media {
  position: absolute;
  inset: 0;
}

.mission-post__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transform: scale(1.02);
  filter: saturate(0.92) brightness(0.72);
}

.mission-post__veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      rgba(10, 9, 8, 0.18) 0%,
      rgba(10, 9, 8, 0.28) 28%,
      rgba(10, 9, 8, 0.62) 58%,
      rgba(10, 9, 8, 0.92) 100%
    ),
    linear-gradient(
      115deg,
      rgba(10, 9, 8, 0.35) 0%,
      transparent 42%
    ),
    radial-gradient(
      120% 80% at 50% 100%,
      rgba(209, 178, 111, 0.12),
      transparent 55%
    );
  pointer-events: none;
}

.mission-post__grain {
  position: absolute;
  inset: 0;
  opacity: 0.18;
  mix-blend-mode: soft-light;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
  pointer-events: none;
}

.mission-post__body {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: inherit;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.4rem;
  padding: 0.85rem 0.85rem 0.95rem;
}

.mission-post__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.mission-post__tag {
  border-radius: 999px;
  border: 1px solid rgba(255, 248, 230, 0.1);
  background: rgba(10, 9, 8, 0.42);
  padding: 0.15rem 0.45rem;
  color: rgba(242, 235, 224, 0.78);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  backdrop-filter: blur(6px);
}

.mission-post__tag.is-gold {
  border-color: rgba(209, 178, 111, 0.35);
  background: rgba(209, 178, 111, 0.16);
  color: #e8c98a;
}

.mission-post__title {
  margin: 0;
  color: #f7f0e4;
  font-family: var(--font-display, inherit);
  font-size: 1.05rem;
  font-weight: 650;
  line-height: 1.28;
  letter-spacing: 0.01em;
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.45);
}

.mission-post__theme,
.mission-post__summary {
  margin: 0;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: rgba(242, 235, 224, 0.68);
  font-size: 11px;
  line-height: 1.45;
}
</style>
