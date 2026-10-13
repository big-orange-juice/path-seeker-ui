<script setup lang="ts">
import RickshawWorkbench from '@/components/rickshaws/RickshawWorkbench.vue';
import { useAdminAuthStore } from '@/stores/adminAuth';

definePageMeta({ middleware: 'admin-auth' });
const auth = useAdminAuthStore();
</script>

<template>
  <RickshawWorkbench v-if="auth.isAdmin" />
  <p v-else class="p-4 text-sm text-muted-foreground">黄包车管理仅对管理员开放。</p>
</template>
