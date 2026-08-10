<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { useAdminNavigation } from '@/composables/useAdminNavigation';
import { useAdminNavDrawer } from '@/composables/useAdminNavDrawer';

const DESKTOP_NAV_MQ = '(min-width: 1024px)';

const route = useRoute();
const { navItems } = useAdminNavigation();
const { open, closeNav } = useAdminNavDrawer();

const linkClass = (to: string) =>
  route.path === to
    ? 'bg-primary/10 text-foreground ring-1 ring-inset ring-primary/20'
    : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground';

const handleEscape = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !open.value) {
    return;
  }
  event.stopPropagation();
  closeNav();
};

/** 拉到桌面断点后关掉抽屉，避免状态残留 */
const handleViewportChange = (event: MediaQueryListEvent | MediaQueryList) => {
  if (event.matches) {
    closeNav();
  }
};

watch(
  () => route.fullPath,
  () => {
    closeNav();
  },
);

watch(
  open,
  (isOpen) => {
    if (!import.meta.client) {
      return;
    }

    document.body.classList.toggle('admin-nav-drawer-open', isOpen);

    if (isOpen) {
      window.addEventListener('keydown', handleEscape, true);
      return;
    }
    window.removeEventListener('keydown', handleEscape, true);
  },
  { immediate: true },
);

let desktopMedia: MediaQueryList | null = null;

onMounted(() => {
  if (!import.meta.client || typeof window.matchMedia !== 'function') {
    return;
  }
  desktopMedia = window.matchMedia(DESKTOP_NAV_MQ);
  handleViewportChange(desktopMedia);
  desktopMedia.addEventListener('change', handleViewportChange);
});

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return;
  }
  desktopMedia?.removeEventListener('change', handleViewportChange);
  document.body.classList.remove('admin-nav-drawer-open');
  window.removeEventListener('keydown', handleEscape, true);
});
</script>

<template>
  <!-- 桌面常驻侧栏 -->
  <aside class="admin-sidebar-desktop hidden h-full border-r border-border bg-[#0f1012] lg:flex lg:flex-col lg:overflow-hidden">
    <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="主导航">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :data-admin-nav="item.to"
        class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors"
        :class="linkClass(item.to)"
      >
        <UiAppIcon :name="item.icon" class="h-4 w-4 shrink-0" />
        <span class="truncate">{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </aside>

  <!-- 窄屏抽屉：顶栏「菜单」打开；点遮罩 / 跳转 / Esc 关闭 -->
  <Teleport to="body">
    <div
      v-if="open"
      class="admin-nav-drawer-root lg:hidden"
      role="presentation"
    >
      <button
        type="button"
        class="admin-nav-drawer-backdrop"
        aria-label="关闭导航菜单"
        @click="closeNav"
      />
      <aside
        id="admin-nav-drawer"
        class="admin-nav-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="导航菜单"
      >
        <div class="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
          <p class="text-sm font-medium text-foreground">导航菜单</p>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
            title="关闭"
            aria-label="关闭导航菜单"
            @click="closeNav"
          >
            <UiAppIcon name="x" class="h-4 w-4" />
          </button>
        </div>
        <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="主导航">
          <NuxtLink
            v-for="item in navItems"
            :key="`drawer-${item.to}`"
            :to="item.to"
            :data-admin-nav="item.to"
            class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors"
            :class="linkClass(item.to)"
            @click="closeNav"
          >
            <UiAppIcon :name="item.icon" class="h-4 w-4 shrink-0" />
            <span class="truncate">{{ item.label }}</span>
          </NuxtLink>
        </nav>
      </aside>
    </div>
  </Teleport>
</template>
