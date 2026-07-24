<script setup lang="ts">
import { computed } from "vue"
import { RouterLink } from "vue-router"
import defaultPost from "@/assets/images/default-post.png"
import {
  formatDurationSec,
  formatHistoryTime,
  resolveRouteProgressStatusLabel,
  ROUTE_PROGRESS_STATUS,
} from "@/adapters/gameplayMissionAdapter"
import type { MissionRouteHistoryItem } from "@/types/mission"

interface Props {
  item: MissionRouteHistoryItem
  /** map：继续游玩；finale：查看结算 */
  mode?: "map" | "finale"
}

const props = withDefaults(defineProps<Props>(), {
  mode: "map",
})

const coverUrl = computed(() => {
  const url = String(props.item.coverImageUrl || "").trim()
  return url || defaultPost
})

const statusLabel = computed(() => resolveRouteProgressStatusLabel(props.item.status))

const metaLine = computed(() => {
  const parts = [
    props.item.puzzleCount
      ? `${props.item.solvedCount}/${props.item.puzzleCount} 站`
      : props.item.solvedCount
        ? `${props.item.solvedCount} 站`
        : "",
    props.item.totalScore ? `${props.item.totalScore} 分` : "",
    formatDurationSec(props.item.durationSec),
  ].filter(Boolean)
  return parts.join(" · ")
})

const timeLine = computed(() => {
  if (props.item.status === ROUTE_PROGRESS_STATUS.completed) {
    return formatHistoryTime(props.item.completedAt) || formatHistoryTime(props.item.startedAt)
  }
  return formatHistoryTime(props.item.startedAt)
})

const targetPath = computed(() => {
  if (props.mode === "finale") {
    return `/missions/${props.item.routeId}/finale`
  }
  return `/missions/${props.item.routeId}/map`
})
</script>

<template>
  <RouterLink :to="targetPath" class="history-card">
    <div class="history-card__cover">
      <img :src="coverUrl" :alt="item.routeTitle" loading="lazy">
    </div>
    <div class="history-card__body">
      <div class="history-card__head">
        <h3 class="history-card__title font-display">{{ item.routeTitle }}</h3>
        <span
          v-if="item.footprintNo != null || statusLabel"
          class="history-card__badge"
        >
          <template v-if="item.footprintNo != null">#{{ item.footprintNo }}</template>
          <template v-else>{{ statusLabel }}</template>
        </span>
      </div>
      <p v-if="item.theme" class="history-card__theme">{{ item.theme }}</p>
      <p v-if="metaLine" class="history-card__meta">{{ metaLine }}</p>
      <p v-if="timeLine" class="history-card__time">{{ timeLine }}</p>
    </div>
  </RouterLink>
</template>

<style scoped>
.history-card {
  display: grid;
  grid-template-columns: 4.5rem 1fr;
  gap: 0.75rem;
  align-items: stretch;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(255, 248, 230, 0.06);
  color: inherit;
  text-decoration: none;
}

.history-card:last-child {
  border-bottom: none;
}

.history-card__cover {
  overflow: hidden;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 248, 230, 0.08);
  background: rgba(12, 10, 8, 0.4);
  aspect-ratio: 1;
}

.history-card__cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.history-card__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  justify-content: center;
}

.history-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.history-card__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 650;
  line-height: 1.25;
  color: #f4ede1;
}

.history-card__badge {
  flex: 0 0 auto;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.28);
  background: rgba(209, 178, 111, 0.1);
  padding: 0.15rem 0.5rem;
  color: #e8c98a;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.history-card__theme,
.history-card__meta,
.history-card__time {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: rgba(168, 159, 144, 0.92);
}

.history-card__theme {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
