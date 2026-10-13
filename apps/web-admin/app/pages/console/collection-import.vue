<script setup lang="ts">
import { ADMIN_ROUTE_PREFIX } from '@/constants/admin-auth';

definePageMeta({
  middleware: 'admin-auth',
});

const route = useRoute();
await navigateTo({
  path: `${ADMIN_ROUTE_PREFIX}/collections`,
  query: { ...route.query, import: '1' },
}, { replace: true, redirectCode: 302 });
</script>

<template>
  <div />
</template>
