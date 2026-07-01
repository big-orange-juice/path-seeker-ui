<script setup lang="ts">
import { ADMIN_LANDING_PATH } from '@/constants/admin-auth';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import { useAdminAuthStore } from '@/stores/adminAuth';

const store = useAdminAuthStore();

const handleConfirm = async () => {
  store.closeSessionExpiredDialog();
  store.logout();
  await navigateTo(ADMIN_LANDING_PATH);
};
</script>

<template>
  <Dialog :open="store.sessionExpiredDialogOpen" @update:open="store.closeSessionExpiredDialog()">
    <DialogContent class="w-[min(92vw,24rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="space-y-3 border-b border-border/80 px-5 py-4">
        <DialogTitle class="text-base font-semibold text-foreground">
          登录状态已失效
        </DialogTitle>
        <DialogDescription class="text-sm leading-6 text-muted-foreground">
          {{ store.sessionExpiredMessage }}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter class="px-5 py-4">
        <UiButton class="w-full" @click="handleConfirm">
          返回首页
        </UiButton>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
