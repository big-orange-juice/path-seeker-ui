<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { ArrowLeft, Pause, Play, UserRound } from "lucide-vue-next"
import { ClientButton, ClientEmptyState, ClientSkeleton } from "@/components/ui"
import MissionPreviewCard from "@/components/shell/MissionPreviewCard.vue"
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
const isPlaying = shallowRef(false)
const audioError = shallowRef("")

let audioEl: HTMLAudioElement | null = null

const loading = computed(() => pending.value && !guide.value)
const sampleUrl = computed(() => String(guide.value?.voiceSampleUrl || "").trim())
const hasRoutes = computed(() => routes.value.length > 0)

function stopSample() {
  if (!audioEl) return
  audioEl.pause()
  audioEl.currentTime = 0
  isPlaying.value = false
}

function disposeAudio() {
  stopSample()
  if (audioEl) {
    audioEl.onended = null
    audioEl.onerror = null
    audioEl.onpause = null
    audioEl.onplay = null
    audioEl = null
  }
}

function ensureAudio() {
  if (audioEl) return audioEl
  if (!sampleUrl.value) return null
  audioEl = new Audio(sampleUrl.value)
  audioEl.preload = "metadata"
  audioEl.onended = () => {
    isPlaying.value = false
  }
  audioEl.onerror = () => {
    isPlaying.value = false
    audioError.value = "试听加载失败，请稍后重试。"
  }
  audioEl.onplay = () => {
    isPlaying.value = true
  }
  audioEl.onpause = () => {
    isPlaying.value = false
  }
  return audioEl
}

async function toggleSample() {
  audioError.value = ""
  if (!sampleUrl.value) return
  const el = ensureAudio()
  if (!el) return
  if (isPlaying.value) {
    el.pause()
    return
  }
  try {
    await el.play()
  } catch {
    audioError.value = "无法播放试听，请检查网络或设备设置。"
    isPlaying.value = false
  }
}

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
  disposeAudio()
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

onUnmounted(() => {
  disposeAudio()
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

    <div v-if="loading" class="space-y-4">
      <div class="flex items-center gap-3">
        <ClientSkeleton class="h-16 w-16 rounded-full" />
        <div class="min-w-0 flex-1 space-y-2">
          <ClientSkeleton class="h-5 w-36 rounded-md" />
          <ClientSkeleton class="h-4 w-24 rounded-md" />
        </div>
      </div>
      <ClientSkeleton class="h-28 w-full rounded-[1rem]" />
    </div>

    <template v-else-if="guide">
      <header class="guide-detail__hero">
        <div class="guide-detail__avatar">
          <img
            v-if="guide.avatarUrl"
            :src="guide.avatarUrl"
            :alt="guide.name"
          >
          <UserRound
            v-else
            class="h-8 w-8 text-[var(--gold)] opacity-85"
            :stroke-width="1.5"
          />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="guide-detail__name font-display">
            {{ guide.name }}
          </h2>
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

      <section class="guide-detail__section">
        <h3 class="guide-detail__label">
          简介
        </h3>
        <p class="guide-detail__copy">
          {{ guide.description || "暂无描述。" }}
        </p>
      </section>

      <section class="guide-detail__section">
        <h3 class="guide-detail__label">
          声音风格
        </h3>
        <p class="guide-detail__copy">
          {{ guide.voiceStyle || "暂未设置声音风格。" }}
        </p>
      </section>

      <section class="guide-detail__section">
        <h3 class="guide-detail__label">
          声音试听
        </h3>
        <template v-if="sampleUrl">
          <ClientButton
            variant="outline"
            class="guide-detail__play"
            @click="toggleSample"
          >
            <Pause
              v-if="isPlaying"
              class="mr-1.5 h-4 w-4"
              :stroke-width="1.8"
            />
            <Play
              v-else
              class="mr-1.5 h-4 w-4"
              :stroke-width="1.8"
            />
            {{ isPlaying ? "暂停试听" : "播放试听" }}
          </ClientButton>
          <p
            v-if="audioError"
            class="guide-detail__error"
          >
            {{ audioError }}
          </p>
        </template>
        <p
          v-else
          class="guide-detail__copy"
        >
          暂无试听音频。
        </p>
      </section>

      <!-- 反向路线：布局同展厅瀑布流，guideId 精确查询 -->
      <section class="guide-detail__section guide-detail__routes">
        <div class="guide-detail__routes-head">
          <h3 class="guide-detail__label">
            讲解路线
          </h3>
          <p
            v-if="!routesPending && hasRoutes"
            class="guide-detail__routes-count"
          >
            {{ routes.length }} 条
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
  gap: 1.15rem;
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
  padding: 0.15rem 0;
  font-size: 0.82rem;
  color: var(--gold-bright);
}

.guide-detail__hero {
  display: flex;
  align-items: center;
  gap: 0.95rem;
}

.guide-detail__avatar {
  display: flex;
  height: 4.25rem;
  width: 4.25rem;
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

.guide-detail__name {
  margin: 0;
  font-size: 1.45rem;
  line-height: 1.2;
  color: var(--fg);
}

.guide-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.guide-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.32);
  background: rgba(209, 178, 111, 0.08);
  padding: 0.12rem 0.5rem;
  font-size: 0.68rem;
  line-height: 1.3;
  color: var(--gold-bright);
}

.guide-detail__section {
  border-top: 1px solid rgba(255, 248, 230, 0.06);
  padding-top: 1rem;
}

.guide-detail__label {
  margin: 0 0 0.45rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--gold);
  text-transform: uppercase;
}

.guide-detail__copy {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.65;
  color: var(--fg-dim);
  white-space: pre-wrap;
}

.guide-detail__play {
  margin-top: 0.15rem;
}

.guide-detail__error {
  margin: 0.55rem 0 0;
  font-size: 0.78rem;
  color: var(--bad);
}

.guide-detail__routes {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.guide-detail__routes-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.guide-detail__routes-head .guide-detail__label {
  margin-bottom: 0;
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
