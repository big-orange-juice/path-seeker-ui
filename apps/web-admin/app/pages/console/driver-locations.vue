<script setup lang="ts">
import DriverLocationWorkbench from '@/components/driver-locations/DriverLocationWorkbench.vue';
import { useAdminAuthStore } from '@/stores/adminAuth';
definePageMeta({ middleware: 'admin-auth' });
const auth = useAdminAuthStore();
</script>

<template>
  <DriverLocationWorkbench v-if="auth.isAdmin" />
  <p v-else class="p-4 text-sm text-muted-foreground">车夫位置仅对管理员开放。</p>
</template>
