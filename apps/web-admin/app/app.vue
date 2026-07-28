<script setup lang="ts">
const keepalive = {
  max: 10,
}

/**
 * 浏览器标签模板。
 * 各页通过 useHead({ title }) 写入短名（页眉 / 登录页）；
 * 未设置时回落品牌全称。
 */
useHead({
  titleTemplate: (title) => {
    const page = String(title || '').trim()
    if (!page || page === 'Path Seeker 秘径寻踪') {
      return 'Path Seeker 秘径寻踪'
    }
    return `${page} · Path Seeker 秘径寻踪`
  },
})
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
