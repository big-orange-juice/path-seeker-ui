<script setup lang="ts">
import { computed } from "vue"
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router"
import { ArrowLeft } from "lucide-vue-next"
import { useAuthStore } from "@/stores/useAuthStore"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const title = computed(() => String(route.meta.title || "Path Seeker"))
const hideChromeHeader = computed(() => {
  // 问一问全页自带顶栏
  return route.path.startsWith("/shell/ask")
})
const showBack = computed(() => {
  const path = route.path
  if (path.startsWith("/shell/ask")) return false
  // 我的页从游览顶栏进入，保留返回入口。
  if (path === "/shell/me") return true
  // 探索中 / 探索记录：从我的进入，需要返回
  if (path === "/shell/playing" || path === "/shell/archive") return true
  return route.meta.showTabBar === false
})
const goBack = () => {
  if (window.history.length > 1) {
    void router.back()
    return
  }
  void router.replace(route.path === '/shell/me' ? '/ride' : '/shell/me')
}
</script>

<template>
  <div class="client-shell" :class="{ 'client-tour-account': route.path === '/shell/me' }">
    <div class="client-frame client-frame-with-fab">
      <header
        v-if="!hideChromeHeader"
        class="relative z-20 mb-5 flex shrink-0 items-start justify-between gap-4"
      >
        <div class="min-w-0">
          <p class="client-top-kicker">Path Seeker</p>
          <h1 class="client-page-title">
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
        <RouterLink :to="{ path: '/auth', query: { redirect: route.fullPath } }" class="client-user-pill shrink-0">
          {{ authStore.isLoggedIn ? authStore.displayName || "探索者" : "登录" }}
        </RouterLink>
      </header>

      <main class="flex min-h-0 flex-1 flex-col">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.client-tour-account{color-scheme:light;--void:#f8faf9;--panel:#fffef8;--panel-2:#edf5ef;--fg:#2b4039;--fg-dim:#687b72;--line:#d4e0d9;--gold:#246859;--gold-bright:#183e43;--gold-soft:#edf5ef;--foreground:150 19% 21%;--primary:165 48% 27%;--muted-foreground:145 8% 43%;--border:145 16% 85%;background:var(--void);color:var(--fg)}
.client-tour-account :deep(.client-panel),.client-tour-account :deep(.client-stat-cell){border:1px solid var(--line);background:var(--panel);box-shadow:none;backdrop-filter:none}
.client-tour-account :deep(.client-user-pill){border-color:var(--line);background:#edf5ef;color:var(--gold-bright)}
</style>
