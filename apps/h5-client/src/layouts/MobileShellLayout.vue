<script setup lang="ts">
import { computed } from "vue"
import { RouterLink, RouterView, useRoute } from "vue-router"
import ShellTabBar from "@/components/shell/ShellTabBar.vue"
import { useAuthStore } from "@/stores/useAuthStore"

const route = useRoute()
const authStore = useAuthStore()

const title = computed(() => String(route.meta.title || "Path Seeker"))
</script>

<template>
  <div class="client-shell">
    <div class="client-frame">
      <header class="mb-6 flex items-start justify-between gap-4">
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Path Seeker H5</p>
          <h1 class="client-page-title">{{ title }}</h1>
        </div>
        <RouterLink
          to="/auth"
          class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
        >
          {{ authStore.isLoggedIn ? authStore.displayName : "登录" }}
        </RouterLink>
      </header>

      <main class="flex-1">
        <RouterView />
      </main>
    </div>

    <ShellTabBar />
  </div>
</template>
