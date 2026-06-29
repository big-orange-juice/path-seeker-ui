<script setup lang="ts">
import { computed } from 'vue';
import { adminNavItems } from '@/composables/useAdminNavigation';

const route = useRoute();

const currentPage = computed(() => {
  return adminNavItems.find((item) => item.to === route.path) ?? adminNavItems[0]!;
});
</script>

<template>
  <header class="border-b border-border bg-background/96 backdrop-blur-sm">
    <div class="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <div class="flex min-w-0 items-center gap-4">
        <div class="flex h-16 items-center">
          <p class="font-display text-[1.18rem] font-semibold tracking-tight text-primary">Path Seeker</p>
        </div>
        <div class="hidden h-5 w-px bg-border sm:block" />
        <div class="min-w-0">
          <p class="text-[11px] uppercase tracking-[0.24em] text-primary/80">path seeker museum</p>
          <h1 class="truncate pt-1 text-base font-semibold text-foreground">{{ currentPage.label }}</h1>
        </div>
      </div>

      <div class="flex items-center gap-3 text-sm text-foreground">
        <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/14 text-primary ring-1 ring-inset ring-primary/20">
          <UiAppIcon name="user-round" class="h-4 w-4" />
        </div>
        <span class="font-medium">张运营</span>
      </div>
    </div>
  </header>
</template>
