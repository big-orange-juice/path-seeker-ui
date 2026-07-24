<script setup lang="ts">
import {
  ADMIN_AUTH_REDIRECT_QUERY,
  ADMIN_LOGIN_PATH,
  ADMIN_PUBLIC_PATHS,
} from '@/constants/admin-auth';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import { useAdminAuthStore } from '@/stores/adminAuth';

const store = useAdminAuthStore();
const route = useRoute();

const handleConfirm = async () => {
  store.closeSessionExpiredDialog();
  store.logout();

  const currentPath = String(route.fullPath || '').trim();
  const canRedirect =
    currentPath
    && !ADMIN_PUBLIC_PATHS.has(route.path)
    && !currentPath.startsWith(ADMIN_LOGIN_PATH);

  await navigateTo({
    path: ADMIN_LOGIN_PATH,
    query: canRedirect
      ? { [ADMIN_AUTH_REDIRECT_QUERY]: currentPath }
      : undefined,
  });
};
</script>

<template>
  <Dialog :open="store.sessionExpiredDialogOpen" @update:open="() => {}">
    <DialogContent
      :z-index="11000"
      :show-close="false"
      class="max-w-[min(92vw,24rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="space-y-2 px-5 pb-2 pt-4">
        <DialogTitle class="text-base font-semibold text-foreground">
          登录状态已失效
        </DialogTitle>
        <DialogDescription class="text-sm leading-6 text-muted-foreground">
          {{ store.sessionExpiredMessage }}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter class="px-5 pb-4 pt-3">
        <UiButton @click="handleConfirm">
          重新登录
        </UiButton>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
