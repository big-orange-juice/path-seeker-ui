<script setup lang="ts">
import { computed } from "vue"
import { RouterLink, useRoute } from "vue-router"
import { UiAppIcon } from "@path-seeker/ui"
import type { AppIconName } from "@path-seeker/ui"
import type { ShellTab } from "@/types/mission"

interface TabItem {
  label: string
  icon: AppIconName
  routeName: string
  value: ShellTab
}

const route = useRoute()

const items: TabItem[] = [
  { label: "展厅", icon: "compass", routeName: "shell-hall", value: "hall" },
  { label: "探索", icon: "route", routeName: "shell-playing", value: "playing" },
  { label: "历史", icon: "archive", routeName: "shell-archive", value: "archive" },
]

const activeTab = computed(() => String(route.meta.shellTab || "hall"))
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/92 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur"
  >
    <div class="mx-auto grid max-w-[30rem] grid-cols-3 gap-2 rounded-[1.1rem] border border-border bg-card/90 p-2 shadow-warm">
      <RouterLink
        v-for="item in items"
        :key="item.value"
        :to="{ name: item.routeName }"
        class="flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-[0.9rem] text-xs font-medium transition-colors"
        :class="
          activeTab === item.value
            ? 'bg-primary/14 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        "
      >
        <UiAppIcon :name="item.icon" class="h-4 w-4" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>
