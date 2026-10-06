<script setup lang="ts">
import AdminTipsGuide from '@/components/admin/AdminTipsGuide.vue';
import PlatformAssistantDrawer from '@/components/admin/PlatformAssistantDrawer.vue';
import { useAdminAssistantDrawer } from '@/composables/useAdminAssistantDrawer';
import { usePlatformAssistantPageContext } from '@/composables/usePlatformAssistantPageContext';

// 平台助手挂载点（设计文档 §8）：顶栏按钮触发，这里持有抽屉并注入页面上下文
const { open } = useAdminAssistantDrawer();
const { context } = usePlatformAssistantPageContext();
</script>

<template>
  <div class="admin-shell h-screen overflow-hidden bg-background text-foreground">
    <div class="flex h-screen flex-col overflow-hidden">
      <AdminAppTopbar />
      <div class="admin-shell-body">
        <AdminAppSidebar />
        <div class="page-frame min-h-0 min-w-0 overflow-hidden">
          <div class="flex h-full min-w-0 flex-col overflow-hidden">
            <AdminAppTabs />
            <main class="admin-main flex min-h-0 flex-1 flex-col overflow-y-auto">
              <slot />
            </main>
          </div>
        </div>
      </div>
    </div>
    <AdminTipsGuide />
    <PlatformAssistantDrawer v-model:open="open" :context="context" />
  </div>
</template>
