<script setup lang="ts">
const keepalive = {
  max: 10,
};
</script>

<template>
  <NuxtLayout>
    <NuxtPage v-slot="{ Component, route }">
      <Transition name="page-fade" mode="out-in" appear>
        <KeepAlive :max="keepalive.max">
          <component :is="Component" :key="route.fullPath" />
        </KeepAlive>
      </Transition>
    </NuxtPage>
  </NuxtLayout>

  <AdminAuthExpiredDialog />
  <AdminActionFeedbackDialog />
</template>
