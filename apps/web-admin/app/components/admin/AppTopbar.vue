<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import { useAdminNavigation } from '@/composables/useAdminNavigation';
import { useAdminAuthStore } from '@/stores/adminAuth';

const route = useRoute();
const authStore = useAdminAuthStore();
const { navItems } = useAdminNavigation();

const logoutConfirmOpen = shallowRef(false);
const loggingOut = shallowRef(false);

const currentPage = computed(() => {
  return navItems.value.find((item) => item.to === route.path) ?? navItems.value[0]!;
});

/** 页眉中文名同步到浏览器标签：与 titleTemplate 拼成「运营分析 · Path Seeker 秘径寻踪」 */
useHead({
  title: computed(() => String(currentPage.value?.label || '控制台').trim() || '控制台'),
});

const openLogoutConfirm = () => {
  logoutConfirmOpen.value = true;
};

const handleLogout = async () => {
  if (loggingOut.value) {
    return;
  }
  loggingOut.value = true;
  try {
    logoutConfirmOpen.value = false;
    authStore.logout();
    await navigateTo('/');
  } finally {
    loggingOut.value = false;
  }
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
        <UiButton variant="ghost" size="sm" @click="openLogoutConfirm">
          退出
        </UiButton>
      </div>
    </div>
  </header>

  <Dialog v-model:open="logoutConfirmOpen">
    <DialogContent class="max-w-[min(92vw,24rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="space-y-2 px-5 pb-2 pt-4">
        <DialogTitle class="text-base font-semibold text-foreground">
          确认退出
        </DialogTitle>
        <DialogDescription class="text-sm leading-6 text-muted-foreground">
          退出后需重新登录才能进入控制台。确定要退出当前账号吗？
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="gap-2 px-5 pb-4 pt-3">
        <Button variant="outline" type="button" :disabled="loggingOut" @click="logoutConfirmOpen = false">
          取消
        </Button>
        <Button type="button" :disabled="loggingOut" @click="handleLogout">
          {{ loggingOut ? '退出中…' : '确认退出' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
