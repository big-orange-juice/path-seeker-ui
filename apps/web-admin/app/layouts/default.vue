<script setup lang="ts">
import AdminTipsGuide from '@/components/admin/AdminTipsGuide.vue';
</script>

<template>
  <div class="admin-shell h-screen overflow-hidden bg-background text-foreground">
    <div class="flex h-screen flex-col overflow-hidden">
      <AdminAppTopbar />
      <div class="min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <AdminAppSidebar />
        <div class="page-frame min-h-0 min-w-0 overflow-hidden">
          <div class="flex h-full min-w-0 flex-col overflow-hidden">
            <AdminAppTabs />
            <main class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
              <slot />
            </main>
          </div>
        </div>
      </div>
    </div>
    <AdminTipsGuide />
  </div>
</template>
