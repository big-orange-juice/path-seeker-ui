<script setup lang="ts">
import { adminNavItems } from '@/composables/useAdminNavigation';

const route = useRoute();
</script>

<template>
  <aside class="hidden h-full border-r border-border bg-[#0f1012] lg:flex lg:flex-col lg:overflow-hidden">
    <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      <NuxtLink
        v-for="item in adminNavItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors"
        :class="
          route.path === item.to
            ? 'bg-primary/10 text-foreground ring-1 ring-inset ring-primary/20'
            : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
        "
      >
        <UiAppIcon :name="item.icon" class="h-4 w-4 shrink-0" />
        <span class="truncate">{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </aside>
</template>
