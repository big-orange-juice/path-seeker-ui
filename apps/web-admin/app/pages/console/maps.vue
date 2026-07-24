<script setup lang="ts">
import { ADMIN_CONSOLE_HOME_PATH } from '@/constants/admin-auth';

await navigateTo(ADMIN_CONSOLE_HOME_PATH, { replace: true });
</script>

<template>
  <div class="px-4 py-6 text-sm text-muted-foreground">
    正在跳转到博物馆...
  </div>
</template>

