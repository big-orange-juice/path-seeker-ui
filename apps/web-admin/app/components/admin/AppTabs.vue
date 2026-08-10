<script setup lang="ts">
import { useAdminTabs } from '@/composables/useAdminTabs';

const { tabs, activeTab, closeTab } = useAdminTabs();

function handleClose(event: MouseEvent, path: string) {
  event.preventDefault();
  event.stopPropagation();
  closeTab(path);
}
</script>

<template>
  <div class="border-b border-border bg-[#111214] px-3 sm:px-4 lg:px-5">
    <div class="admin-tabs-inner flex items-center gap-2 overflow-x-auto">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="group inline-flex h-7.5 shrink-0 items-center gap-2 rounded-md border px-2.5 py-1 text-sm transition-colors"
        :class="
          activeTab === tab.to
            ? 'border-primary/40 bg-primary/10 text-foreground'
            : 'border-transparent bg-secondary/45 text-muted-foreground hover:bg-secondary hover:text-foreground'
        ">
        <UiAppIcon :name="tab.icon" class="h-3.5 w-3.5" />
        <span>{{ tab.label }}</span>
        <button
          v-if="tab.closable"
          type="button"
          class="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          @click="handleClose($event, tab.to)">
          <UiAppIcon name="x" class="h-3 w-3" />
        </button>
      </NuxtLink>
    </div>
  </div>
</template>
