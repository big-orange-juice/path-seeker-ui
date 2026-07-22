<script setup lang="ts">
import { computed } from "vue"
import { RouterLink, RouterView, useRoute } from "vue-router"
import { useAuthStore } from "@/stores/useAuthStore"

const route = useRoute()
const authStore = useAuthStore()

const title = computed(() => String(route.meta.title || "Path Seeker"))
const hideChromeHeader = computed(() => {
  // 播片 / 问一问全页自带顶栏
  return route.path.includes("/video") || route.path.startsWith("/shell/ask")
})
/** 任务流：底栏留白更紧，内容与按钮更贴底 */
const isMissionFlow = computed(() => route.path.startsWith("/missions/"))
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
        <div class="min-w-0 space-y-1.5">
          <p class="client-top-kicker">Path Seeker</p>
          <h1
            class="client-page-title"
            :class="isMissionFlow && 'text-[1.45rem]'"
          >
            {{ title }}
          </h1>
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
