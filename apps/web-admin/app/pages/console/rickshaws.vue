<script setup lang="ts">
definePageMeta({ middleware: 'admin-auth' });
await navigateTo('/console/app-users', { replace: true });
</script>

<template>
  <div />
</template>
