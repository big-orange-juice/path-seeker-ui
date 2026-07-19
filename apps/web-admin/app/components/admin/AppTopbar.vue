<script setup lang="ts">
import { computed } from 'vue';
import { useAdminNavigation } from '@/composables/useAdminNavigation';
import { useAdminAuthStore } from '@/stores/adminAuth';

const route = useRoute();
const authStore = useAdminAuthStore();
const { navItems } = useAdminNavigation();

const currentPage = computed(() => {
  return navItems.value.find((item) => item.to === route.path) ?? navItems.value[0]!;
});

const handleLogout = async () => {
  authStore.logout();
  await navigateTo('/');
};
</script>

<template>
  <header class="border-b border-border bg-background/96 backdrop-blur-sm">
    <div class="flex h-14 items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex h-16 items-center">
          <p class="font-display text-[1.18rem] font-semibold tracking-tight text-primary">Path Seeker</p>
        </div>
        <div class="hidden h-5 w-px bg-border sm:block" />
        <div class="min-w-0">
          <p class="text-[11px] uppercase tracking-[0.24em] text-primary/80">path seeker museum</p>
          <h1 class="truncate pt-1 text-base font-semibold text-foreground">{{ currentPage?.label || '控制台' }}</h1>
        </div>
      </div>

      <div class="flex items-center gap-3 text-sm text-foreground">
        <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/14 text-primary ring-1 ring-inset ring-primary/20">
          <UiAppIcon name="user-round" class="h-4 w-4" />
        </div>
        <div class="hidden text-right sm:block">
          <p class="font-medium">{{ authStore.displayName }}</p>
          <p class="text-xs text-muted-foreground">{{ authStore.profile?.role || '管理员控制台' }}</p>
        </div>
        <UiButton variant="ghost" size="sm" @click="handleLogout">
          退出
        </UiButton>
      </div>
    </div>
  </header>
</template>
