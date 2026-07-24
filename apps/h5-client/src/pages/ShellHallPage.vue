<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from "vue"
import { Filter, Search } from "lucide-vue-next"
import {
  ClientButton,
  ClientEmptyState,
  ClientInput,
  ClientSheet,
  ClientSheetContent,
  ClientSheetDescription,
  ClientSheetFooter,
  ClientSheetHeader,
  ClientSheetTitle,
} from "@/components/ui"
import MissionPreviewCard from "@/components/shell/MissionPreviewCard.vue"
import { useMissionStore } from "@/stores/useMissionStore"

const missionStore = useMissionStore()
const filterSheetOpen = shallowRef(false)
const keywordDraft = ref(missionStore.filters.keyword || "")

const hasRoutes = computed(() => missionStore.filteredRoutes.length > 0)
const listFailed = computed(() => Boolean(missionStore.routeListError) && !hasRoutes.value)

const emptyTitle = computed(() => (listFailed.value ? "路线加载失败" : "没有匹配路线"))
const emptyText = computed(() =>
  listFailed.value
    ? missionStore.routeListError || "请检查网络后重试。"
    : "没有匹配路线，换个标题关键词再试试。",
)

const filterOn = computed(() => Boolean(String(missionStore.filters.keyword || "").trim()))

const filterSummary = computed(() =>
  [
    String(missionStore.filters.keyword || "").trim()
      ? `「${String(missionStore.filters.keyword).trim()}」`
      : "",
  ].filter(Boolean),
)

/** 骨架屏假高度轮询，真实项按站数分档 */
function skeletonHeightTone(index: number): "tall" | "mid" | "short" {
  const pattern = ["tall", "mid", "short", "mid"] as const
  return pattern[index % pattern.length] ?? "mid"
}

function closeFilterSheet() {
  filterSheetOpen.value = false
}

function applyKeyword() {
  missionStore.setFilters({ keyword: keywordDraft.value.trim() })
}

function resetFilters() {
  keywordDraft.value = ""
  missionStore.resetFilters()
}

function confirmFilters() {
  applyKeyword()
  closeFilterSheet()
}

async function refreshRoutes(force = false) {
  await missionStore.ensureRouteCards({ force })
}

watch(
  () => missionStore.filters.keyword,
  (value) => {
    keywordDraft.value = value || ""
  },
)

onMounted(() => {
  void refreshRoutes(false)
})
</script>

<template>
  <div class="hall-page">
    <header class="hall-top">
      <div class="hall-intro">
        <p class="hall-kicker">Gallery</p>
        <h1 class="hall-title font-display">今日路线</h1>
        <p class="hall-count">
          {{ missionStore.coverageSummary.missionCount }} 条在展
          <template v-if="missionStore.coverageSummary.archiveCount">
            · 收藏 {{ missionStore.coverageSummary.archiveCount }}
          </template>
        </p>
      </div>
      <button
        type="button"
        class="hall-filter-btn"
        :class="{ 'is-on': filterOn }"
        aria-label="筛选"
        @click="filterSheetOpen = true"
      >
        <Filter class="h-4 w-4" />
        <span>筛选</span>
      </button>
    </header>

    <div v-if="filterSummary.length" class="hall-chips">
      <span
        v-for="item in filterSummary"
        :key="item"
        class="client-tag"
      >
        {{ item }}
      </span>
    </div>

    <p
      v-if="missionStore.routeListError && hasRoutes"
      class="text-xs text-muted-foreground"
    >
      列表刷新失败，仍显示上次结果。
      <button type="button" class="text-primary underline-offset-2 hover:underline" @click="refreshRoutes(true)">
        重试
      </button>
    </p>

    <!-- 瀑布流 · 艺术海报块 -->
    <div v-if="hasRoutes" class="hall-waterfall">
      <MissionPreviewCard
        v-for="mission in missionStore.filteredRoutes"
        :key="mission.id"
        :mission="mission"
      />
    </div>

    <div v-else-if="missionStore.routeListPending" class="hall-waterfall">
      <div
        v-for="n in 4"
        :key="n"
        class="hall-skeleton"
        :class="`is-${skeletonHeightTone(n - 1)}`"
      />
    </div>

    <ClientEmptyState
      v-else
      :title="emptyTitle"
      :description="emptyText"
      :action-text="listFailed ? '重新加载' : ''"
      @action="refreshRoutes(true)"
    />

    <!-- 底部筛选：仅标题关键词 -->
    <ClientSheet v-model="filterSheetOpen">
      <ClientSheetContent side="bottom" class="hall-picker">
        <ClientSheetHeader>
          <ClientSheetTitle>筛选路线</ClientSheetTitle>
          <ClientSheetDescription>
            按标题关键词收窄列表。
          </ClientSheetDescription>
        </ClientSheetHeader>

        <div class="mt-5 grid gap-4">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-muted-foreground">标题</label>
            <div class="relative">
              <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <ClientInput
                v-model="keywordDraft"
                class="pl-9"
                placeholder="搜索路线标题"
                @keydown.enter.prevent="confirmFilters"
              />
            </div>
          </div>
        </div>

        <ClientSheetFooter class="mt-6">
          <ClientButton variant="outline" class="w-full" @click="resetFilters">
            重置
          </ClientButton>
          <ClientButton class="w-full" @click="confirmFilters">
            确定
          </ClientButton>
        </ClientSheetFooter>
      </ClientSheetContent>
    </ClientSheet>
  </div>
</template>

<style scoped>
.hall-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 0.5rem;
}

.hall-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0.15rem;
}

.hall-intro {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.hall-kicker {
  margin: 0;
  color: rgba(209, 178, 111, 0.72);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.hall-title {
  margin: 0;
  color: #f4ede1;
  font-size: 1.55rem;
  font-weight: 650;
  line-height: 1.15;
  letter-spacing: 0.02em;
}

.hall-count {
  margin: 0.15rem 0 0;
  color: rgba(168, 159, 144, 0.92);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.hall-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid rgba(255, 248, 230, 0.1);
  border-radius: 999px;
  background: transparent;
  padding: 0.45rem 0.75rem;
  color: rgba(242, 235, 224, 0.78);
  font-size: 12px;
  font-weight: 600;
}

.hall-filter-btn.is-on {
  border-color: rgba(209, 178, 111, 0.4);
  background: rgba(209, 178, 111, 0.1);
  color: #e8c98a;
}

.hall-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

/* 双列瀑布：列距略松，像展墙间隔 */
.hall-waterfall {
  column-count: 2;
  column-gap: 0.75rem;
}

/* 骨架：溶边海报块 */
.hall-skeleton {
  break-inside: avoid;
  margin-bottom: 0.85rem;
  background:
    linear-gradient(
      180deg,
      rgba(255, 248, 230, 0.055) 0%,
      rgba(255, 248, 230, 0.03) 55%,
      transparent 100%
    );
  -webkit-mask-image: linear-gradient(
    180deg,
    #000 0%,
    #000 70%,
    transparent 100%
  );
  mask-image: linear-gradient(
    180deg,
    #000 0%,
    #000 70%,
    transparent 100%
  );
}

.hall-skeleton.is-tall {
  height: 15.2rem;
}

.hall-skeleton.is-mid {
  height: 13rem;
}

.hall-skeleton.is-short {
  height: 11rem;
}

.hall-picker :deep(label) {
  display: block;
}
</style>
