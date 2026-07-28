<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue"
import { useRouter } from "vue-router"
import { ChevronRight, UserRound } from "lucide-vue-next"
import { ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { fetchGuideClientList } from "@/services/guide"
import { resolveRequestErrorMessage } from "@/services/http"
import type { GuideClientItem } from "@/types/guide"

/**
 * 导游名册：平等人物目录，不做成排行榜，也不做成卡片墙。
 * 无序号、无热度分；单列横排 + 大字号，方便扫读。
 */
const router = useRouter()
const items = shallowRef<GuideClientItem[]>([])
const pending = shallowRef(false)
const errorMessage = shallowRef("")

const loading = computed(() => pending.value && items.value.length === 0)
const failed = computed(() => Boolean(errorMessage.value) && items.value.length === 0)

/** 稳定展示序：按 sortOrder 再按 id，避免接口返回顺序被读成「榜」 */
const roster = computed(() => {
  const list = [...items.value]
  list.sort((a, b) => {
    const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (so !== 0) return so
    return String(a.id).localeCompare(String(b.id))
  })
  return list
})

async function refresh() {
  pending.value = true
  errorMessage.value = ""
  try {
    items.value = await fetchGuideClientList()
  } catch (error) {
    errorMessage.value = resolveRequestErrorMessage(error, "导游列表加载失败。")
  } finally {
    pending.value = false
  }
}

function openDetail(guide: GuideClientItem) {
  void router.push(`/shell/guides/${encodeURIComponent(guide.id)}`)
}

function tagSlice(guide: GuideClientItem, max = 3) {
  return (guide.tags || []).slice(0, max)
}

function routeNote(count: number) {
  if (count <= 0) return "尚无路线"
  if (count === 1) return "1 条讲解线"
  return `${count} 条讲解线`
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="client-surface guides-roster">
    <header class="roster-intro">
      <p class="roster-intro__kicker">
        馆内向导
      </p>
      <p class="roster-intro__lead">
        选一位向导，听 TA 怎么讲这座馆。
      </p>
    </header>

    <div
      v-if="loading"
      class="roster-list"
      aria-hidden="true"
    >
      <div
        v-for="n in 5"
        :key="n"
        class="roster-row roster-row--skel"
      >
        <ClientSkeleton class="roster-skel-avatar" />
        <div class="roster-skel-meta">
          <ClientSkeleton class="roster-skel-line is-name" />
          <ClientSkeleton class="roster-skel-line is-voice" />
        </div>
      </div>
    </div>

    <template v-else-if="roster.length">
      <p
        v-if="errorMessage"
        class="roster-soft-error"
      >
        刷新失败，仍显示上次结果。
        <button
          type="button"
          class="roster-soft-error__action"
          @click="refresh"
        >
          重试
        </button>
      </p>

      <ul class="roster-list">
        <li
          v-for="guide in roster"
          :key="guide.id"
        >
          <button
            type="button"
            class="roster-row"
            @click="openDetail(guide)"
          >
            <div class="roster-row__avatar">
              <img
                v-if="guide.avatarUrl"
                :src="guide.avatarUrl"
                :alt="guide.name"
                loading="lazy"
              >
              <UserRound
                v-else
                class="roster-row__avatar-icon"
                :stroke-width="1.5"
              />
            </div>

            <div class="roster-row__body">
              <div class="roster-row__title-line">
                <h3 class="roster-row__name font-display">
                  {{ guide.name }}
                </h3>
                <span class="roster-row__routes">
                  {{ routeNote(guide.routeCount) }}
                </span>
              </div>

              <p
                v-if="guide.voiceStyle"
                class="roster-row__voice"
              >
                {{ guide.voiceStyle }}
              </p>

              <div
                v-if="tagSlice(guide).length"
                class="roster-row__tags"
              >
                <span
                  v-for="tag in tagSlice(guide)"
                  :key="tag.id"
                  class="roster-tag"
                  :style="tag.color ? { borderColor: tag.color, color: tag.color } : undefined"
                >
                  {{ tag.name }}
                </span>
              </div>
            </div>

            <ChevronRight
              class="roster-row__chevron"
              :stroke-width="1.8"
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>
    </template>

    <ClientEmptyState
      v-else
      :title="failed ? '加载失败' : '暂无向导'"
      :description="
        failed
          ? errorMessage || '请检查网络后重试。'
          : '馆内暂未配置可展示的向导。'
      "
      :action-text="failed ? '重新加载' : undefined"
      @action="failed ? refresh() : undefined"
    />
  </div>
</template>

<style scoped>
.guides-roster {
  gap: 1rem;
}

.roster-intro {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0 0.05rem 0.2rem;
}

.roster-intro__kicker {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--gold);
}

.roster-intro__lead {
  margin: 0;
  color: var(--fg-dim);
  font-size: 1rem;
  line-height: 1.5;
}

.roster-soft-error {
  margin: 0;
  font-size: 0.88rem;
  color: var(--fg-dim);
}

.roster-soft-error__action {
  margin-left: 0.25rem;
  border: none;
  background: transparent;
  padding: 0;
  color: var(--gold-bright);
  text-decoration: underline;
  text-underline-offset: 2px;
  font-size: inherit;
}

/* 单列目录：无卡片底、无边框块，仅分隔线 */
.roster-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid rgba(255, 248, 230, 0.1);
}

.roster-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.9rem;
  margin: 0;
  border: none;
  border-bottom: 1px solid rgba(255, 248, 230, 0.1);
  border-radius: 0;
  background: transparent;
  padding: 1rem 0.1rem;
  text-align: left;
  color: inherit;
}

.roster-row:active {
  background: rgba(209, 178, 111, 0.06);
}

.roster-row--skel {
  pointer-events: none;
}

.roster-row__avatar {
  flex-shrink: 0;
  height: 4.25rem;
  width: 4.25rem;
  overflow: hidden;
  border-radius: 50%;
  border: 1.5px solid rgba(209, 178, 111, 0.35);
  background:
    radial-gradient(
      ellipse at 45% 30%,
      rgba(209, 178, 111, 0.18),
      rgba(8, 7, 6, 0.92) 72%
    );
  display: flex;
  align-items: center;
  justify-content: center;
}

.roster-row__avatar img {
  height: 100%;
  width: 100%;
  object-fit: cover;
  object-position: center 18%;
  filter: saturate(0.92) brightness(0.96) contrast(1.04);
}

.roster-row__avatar-icon {
  height: 1.75rem;
  width: 1.75rem;
  color: var(--gold);
  opacity: 0.8;
}

.roster-row__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.28rem;
}

.roster-row__title-line {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.55rem;
}

.roster-row__name {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fg);
  font-size: 1.22rem;
  line-height: 1.25;
  letter-spacing: 0.01em;
  font-weight: 600;
}

.roster-row__routes {
  flex-shrink: 0;
  color: rgba(247, 239, 221, 0.55);
  font-size: 0.82rem;
  letter-spacing: 0.02em;
  line-height: 1.3;
}

.roster-row__voice {
  margin: 0;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--fg-dim);
  font-size: 0.95rem;
  line-height: 1.45;
}

.roster-row__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.12rem;
}

.roster-tag {
  display: inline-flex;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.32);
  background: transparent;
  padding: 0.12rem 0.5rem;
  color: var(--gold-bright);
  font-size: 0.78rem;
  line-height: 1.3;
}

.roster-row__chevron {
  flex-shrink: 0;
  height: 1.15rem;
  width: 1.15rem;
  color: rgba(247, 239, 221, 0.32);
}

.roster-skel-avatar {
  flex-shrink: 0;
  height: 4.25rem;
  width: 4.25rem;
  border-radius: 50%;
}

.roster-skel-meta {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.45rem;
}

.roster-skel-line {
  height: 0.95rem;
  width: 100%;
  border-radius: 0.3rem;
}

.roster-skel-line.is-name {
  height: 1.15rem;
  width: 42%;
}

.roster-skel-line.is-voice {
  width: 72%;
}
</style>
