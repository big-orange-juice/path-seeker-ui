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
</script>

<template>
  <div class="client-shell">
    <div class="client-frame client-frame-with-fab">
      <header v-if="!hideChromeHeader" class="mb-5 flex items-start justify-between gap-4">
        <div class="min-w-0 space-y-1.5">
          <p class="client-top-kicker">Path Seeker</p>
          <h1 class="client-page-title">{{ title }}</h1>
        </div>
        <RouterLink to="/auth" class="client-user-pill shrink-0">
          {{ authStore.isLoggedIn ? authStore.displayName || "探索者" : "登录" }}
        </RouterLink>
      </header>

      <main class="flex-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>
