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
  // 两个主入口：我的 / 户外（户外为整屏地图，另有自己的返回）
  if (path === "/shell/me") return false
  // 探索中 / 探索记录：从我的进入，需要返回
  if (path === "/shell/playing" || path === "/shell/archive") return true
  return route.meta.showTabBar === false
})
const goBack = () => {
  if (window.history.length > 1) {
    void router.back()
    return
  }
  void router.replace("/shell/me")
}
</script>

<template>
  <div class="client-shell">
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
        <RouterLink to="/auth" class="client-user-pill shrink-0">
          {{ authStore.isLoggedIn ? authStore.displayName || "探索者" : "登录" }}
        </RouterLink>
      </header>

      <main class="flex min-h-0 flex-1 flex-col">
        <RouterView />
      </main>
    </div>
  </div>
</template>
