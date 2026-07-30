<script setup lang="ts">
import { computed } from "vue"
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router"
import { ArrowLeft } from "lucide-vue-next"
import { useAuthStore } from "@/stores/useAuthStore"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const title = computed(() => String(route.meta.title || "Path Seeker"))
const returnGuideId = computed(() => String(route.query.guideId || "").trim())
const cameFromGuideDetail = computed(() => {
  if (typeof window === "undefined") return false
  const backPath = String(window.history.state?.back || "")
  return /\/shell\/guides\/[^/?#]+(?:[/?#]|$)/.test(backPath)
})
const isGuideRouteReturn = computed(() =>
  (route.query.fromGuide === "1" && Boolean(returnGuideId.value))
  || cameFromGuideDetail.value,
)
const hideChromeHeader = computed(() => {
  // 播片 / 问一问全页自带顶栏
  return route.path.includes("/video") || route.path.startsWith("/shell/ask")
})
/** 任务流：底栏留白更紧，内容与按钮更贴底 */
const isMissionFlow = computed(() => route.path.startsWith("/missions/"))
/**
 * 壳层返回：非 FAB 主 Tab、且页内未自带返回时展示。
 * 排除 missions（页内业务返回）、ask（面板关闭）、导游详情（页内返回）。
 * playing / archive 虽曾 showTabBar，但从「我的」进入需可回上一页。
 */
const showBack = computed(() => {
  const path = route.path
  if (path.startsWith("/missions/")) return isGuideRouteReturn.value
  if (path.startsWith("/shell/ask")) return false
  if (path.startsWith("/shell/guides/")) return false
  // FAB 三主入口：展厅 / 导游列表 / 我的
  if (path === "/shell/hall" || path === "/shell/guides" || path === "/shell/me") return false
  // 探索中 / 探索记录：从我的进入，需要返回
  if (path === "/shell/playing" || path === "/shell/archive") return true
  return route.meta.showTabBar === false
})
const goBack = () => {
  if (window.history.length > 1) {
    void router.back()
    return
  }
  if (isGuideRouteReturn.value) {
    void router.replace(`/shell/guides/${encodeURIComponent(returnGuideId.value)}`)
    return
  }
  if (route.path === "/shell/playing" || route.path === "/shell/archive") {
    void router.replace("/shell/me")
    return
  }
  void router.replace("/shell/hall")
}
const frameClass = computed(() =>
  isMissionFlow.value
    ? "client-frame client-frame-mission"
    : "client-frame client-frame-with-fab",
)
</script>

<template>
  <div class="client-shell">
    <div :class="frameClass">
      <header
        v-if="!hideChromeHeader"
        class="relative z-20 flex shrink-0 items-start justify-between gap-4"
        :class="isMissionFlow ? 'mb-3' : 'mb-5'"
      >
        <div class="min-w-0">
          <p class="client-top-kicker">Path Seeker</p>
          <h1
            class="client-page-title"
            :class="isMissionFlow && 'text-[1.45rem]'"
          >
            {{ title }}
          </h1>
          <button
            v-if="showBack"
            type="button"
            class="mt-3 inline-flex items-center gap-1.5 text-[0.82rem] text-[var(--gold-bright)] hover:text-[var(--gold)]"
            aria-label="返回"
            @click="goBack"
          >
            <ArrowLeft class="h-4 w-4" :stroke-width="1.8" />
            <span>返回</span>
          </button>
        </div>
        <RouterLink to="/auth" class="client-user-pill shrink-0">
          {{ authStore.isLoggedIn ? authStore.displayName || "探索者" : "登录" }}
        </RouterLink>
      </header>

      <main
        class="flex min-h-0 flex-1 flex-col"
        :class="isMissionFlow ? 'overflow-y-auto overscroll-y-contain' : ''"
      >
        <RouterView />
      </main>
    </div>
  </div>
</template>
