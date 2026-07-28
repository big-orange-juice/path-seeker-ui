<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { ArrowLeft, UserRound } from "lucide-vue-next"
import { ClientEmptyState, ClientSkeleton } from "@/components/ui"
import MissionPreviewCard from "@/components/shell/MissionPreviewCard.vue"
import VoiceSamplePlayer from "@/components/shell/VoiceSamplePlayer.vue"
import {
  adaptRemoteRouteCard,
  buildRoutePageQuery,
  resolveRouteList,
} from "@/adapters/missionGameplayAdapter"
import { fetchGuideClientList } from "@/services/guide"
import { fetchPublishedRoutes } from "@/services/gameplay"
import { resolveRequestErrorMessage } from "@/services/http"
import type { GuideClientItem } from "@/types/guide"
import type { MissionRouteCard } from "@/types/mission"

const route = useRoute()
const router = useRouter()

/** 与展厅列表同一馆；未配置 env 时回落默认馆 */
const museumId = String(import.meta.env.VITE_MUSEUM_ID || "345536575083515904").trim()

const guideId = computed(() => String(route.params.guideId || "").trim())
const guide = shallowRef<GuideClientItem | null>(null)
const routes = shallowRef<MissionRouteCard[]>([])
const pending = shallowRef(false)
const routesPending = shallowRef(false)
const errorMessage = shallowRef("")
const routesError = shallowRef("")

const loading = computed(() => pending.value && !guide.value)
const sampleUrl = computed(() => String(guide.value?.voiceSampleUrl || "").trim())
const hasRoutes = computed(() => routes.value.length > 0)
/** 已拉到列表用实际条数；否则用 client-list 的 routeCount */
const resolvedRouteCount = computed(() => {
  if (hasRoutes.value) return routes.value.length
  return Number(guide.value?.routeCount || 0)
})
const routeCountChip = computed(() => {
  const n = resolvedRouteCount.value
  if (n > 0) return `${n} 条路线`
  if (routesPending.value) return "路线加载中"
  return "暂无路线"
})
const routeCountSection = computed(() => {
  if (routesPending.value && !hasRoutes.value) {
    const listed = Number(guide.value?.routeCount || 0)
    return listed > 0 ? `${listed} 条` : "…"
  }
  return `${resolvedRouteCount.value} 条`
})
const shortDesc = computed(() => {
  const raw = String(guide.value?.description || "").trim()
  if (!raw) return ""
  return raw.length > 96 ? `${raw.slice(0, 96).trim()}…` : raw
})

/** 导游详情：用 guideId 精确拉已发布路线（与展厅瀑布流同卡） */
async function loadGuideRoutes(id: string) {
  routesPending.value = true
  routesError.value = ""
  try {
    const response = await fetchPublishedRoutes(
      buildRoutePageQuery({
        museumId,
        ageBand: "all",
        difficulty: "all",
        scaleType: "all",
        guideId: id,
      }),
    )
    routes.value = resolveRouteList(response)
      .map(adaptRemoteRouteCard)
      .filter((item): item is MissionRouteCard => Boolean(item))
  } catch (error) {
    routes.value = []
    routesError.value = resolveRequestErrorMessage(error, "关联路线加载失败。")
  } finally {
    routesPending.value = false
  }
}

async function loadGuide() {
  const id = guideId.value
  if (!id) {
    guide.value = null
    routes.value = []
    errorMessage.value = "缺少导游标识。"
    return
  }

  pending.value = true
  errorMessage.value = ""
  try {
    const list = await fetchGuideClientList()
    guide.value = list.find((item) => item.id === id) || null
    if (!guide.value) {
      errorMessage.value = "未找到该导游。"
      routes.value = []
      return
    }
    void loadGuideRoutes(id)
  } catch (error) {
    guide.value = null
    routes.value = []
    errorMessage.value = resolveRequestErrorMessage(error, "导游详情加载失败。")
  } finally {
    pending.value = false
  }
}

function goBack() {
  if (window.history.length > 1) {
    void router.back()
    return
  }
  void router.replace("/shell/guides")
}

function skeletonHeightTone(index: number): "tall" | "mid" | "short" {
  const pattern = ["tall", "mid", "short", "mid"] as const
  return pattern[index % pattern.length] ?? "mid"
}

watch(guideId, () => {
  void loadGuide()
})

onMounted(() => {
  void loadGuide()
})
</script>

<template>
  <div class="client-surface guide-detail">
    <div class="guide-detail__toolbar">
      <button
        type="button"
        class="guide-detail__back"
        aria-label="返回"
        @click="goBack"
      >
        <ArrowLeft class="h-4 w-4" :stroke-width="1.8" />
        返回
      </button>
    </div>

    <div v-if="loading" class="space-y-3">
      <div class="flex items-center gap-3">
        <ClientSkeleton class="h-12 w-12 rounded-full" />
        <div class="min-w-0 flex-1 space-y-2">
          <ClientSkeleton class="h-4 w-32 rounded-md" />
          <ClientSkeleton class="h-3 w-24 rounded-md" />
        </div>
      </div>
      <ClientSkeleton class="h-10 w-full rounded-full" />
    </div>

    <template v-else-if="guide">
      <!-- 紧凑头区：头像 + 身份一行，简介与试听压扁，把纵向空间留给路线 -->
      <header class="guide-detail__hero">
        <div class="guide-detail__avatar">
          <img
            v-if="guide.avatarUrl"
            :src="guide.avatarUrl"
            :alt="guide.name"
          >
          <UserRound
            v-else
            class="h-5 w-5 text-[var(--gold)] opacity-85"
            :stroke-width="1.5"
          />
        </div>
        <div class="guide-detail__identity">
          <div class="guide-detail__name-row">
            <h2 class="guide-detail__name font-display">
              {{ guide.name }}
            </h2>
            <span
              class="guide-detail__route-count"
              :class="{ 'is-empty': resolvedRouteCount <= 0 && !routesPending }"
            >
              {{ routeCountChip }}
            </span>
          </div>
          <p
            v-if="guide.voiceStyle"
            class="guide-detail__voice"
          >
            {{ guide.voiceStyle }}
          </p>
          <div
            v-if="guide.tags.length"
            class="guide-detail__tags"
          >
            <span
              v-for="tag in guide.tags"
              :key="tag.id"
              class="guide-tag"
              :style="tag.color ? { borderColor: tag.color, color: tag.color } : undefined"
            >
              {{ tag.name }}
            </span>
          </div>
        </div>
      </header>

      <p
        v-if="shortDesc"
        class="guide-detail__desc"
      >
        {{ shortDesc }}
      </p>

      <VoiceSamplePlayer
        class="guide-detail__player"
        :src="sampleUrl"
        empty-text="暂无试听音频"
      />

      <!-- 反向路线：主内容，尽早上屏 -->
      <section class="guide-detail__routes">
        <div class="guide-detail__routes-head">
          <h3 class="guide-detail__label">
            讲解路线
          </h3>
          <p class="guide-detail__routes-count">
            {{ routeCountSection }}
          </p>
        </div>

        <p
          v-if="routesError && hasRoutes"
          class="text-xs text-muted-foreground"
        >
          路线刷新失败，仍显示上次结果。
          <button
            type="button"
            class="text-primary underline-offset-2 hover:underline"
            @click="loadGuideRoutes(guideId)"
          >
            重试
          </button>
        </p>

        <div v-if="hasRoutes" class="hall-waterfall">
          <MissionPreviewCard
            v-for="mission in routes"
            :key="mission.id"
            :mission="mission"
          />
        </div>

        <div v-else-if="routesPending" class="hall-waterfall">
          <div
            v-for="n in 4"
            :key="n"
            class="hall-skeleton"
            :class="`is-${skeletonHeightTone(n - 1)}`"
          />
        </div>

        <ClientEmptyState
          v-else
          title="暂无关联路线"
          :description="routesError || '该导游暂未挂到已发布路线。'"
          :action-text="routesError ? '重新加载' : undefined"
          @action="routesError ? loadGuideRoutes(guideId) : undefined"
        />
      </section>
    </template>

    <ClientEmptyState
      v-else
      title="无法打开导游"
      :description="errorMessage || '请返回列表重试。'"
      action-text="返回列表"
      @action="router.replace('/shell/guides')"
    />
  </div>
</template>

<style scoped>
.guide-detail {
  gap: 0.75rem;
  padding-bottom: 0.5rem;
}

.guide-detail__toolbar {
  display: flex;
  align-items: center;
}

.guide-detail__back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: none;
  background: transparent;
  padding: 0.1rem 0;
  font-size: 0.82rem;
  color: var(--gold-bright);
}

.guide-detail__hero {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.guide-detail__avatar {
  display: flex;
  height: 3.15rem;
  width: 3.15rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.34);
  background: rgba(209, 178, 111, 0.1);
}

.guide-detail__avatar img {
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.guide-detail__identity {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  padding-top: 0.05rem;
}

.guide-detail__name-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.55rem;
}

.guide-detail__name {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.22rem;
  line-height: 1.2;
  color: var(--fg);
}

.guide-detail__route-count {
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.34);
  background: rgba(209, 178, 111, 0.12);
  padding: 0.1rem 0.48rem;
  color: var(--gold-bright);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.25;
  white-space: nowrap;
}

.guide-detail__route-count.is-empty {
  border-color: rgba(255, 248, 230, 0.12);
  background: rgba(12, 10, 8, 0.28);
  color: var(--fg-dim);
  font-weight: 500;
}

.guide-detail__voice {
  margin: 0;
  color: var(--fg-dim);
  font-size: 0.78rem;
  font-style: italic;
  line-height: 1.4;
}

.guide-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem;
  margin-top: 0.1rem;
}

.guide-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.32);
  background: rgba(209, 178, 111, 0.08);
  padding: 0.08rem 0.42rem;
  font-size: 0.64rem;
  line-height: 1.3;
  color: var(--gold-bright);
}

.guide-detail__desc {
  margin: 0;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--fg-dim);
  font-size: 0.82rem;
  line-height: 1.5;
}

.guide-detail__player {
  margin-top: 0.1rem;
}

.guide-detail__routes {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin-top: 0.15rem;
  border-top: 1px solid rgba(255, 248, 230, 0.06);
  padding-top: 0.85rem;
}

.guide-detail__routes-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.guide-detail__label {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--gold);
  text-transform: uppercase;
}

.guide-detail__routes-count {
  margin: 0;
  font-size: 0.72rem;
  color: var(--fg-dim);
}

.hall-waterfall {
  column-count: 2;
  column-gap: 0.75rem;
}

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
</style>
