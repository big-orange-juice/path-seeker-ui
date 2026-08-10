<script setup lang="ts">
/**
 * 浏览器标签模板。
 * 各页通过 useHead({ title }) 写入短名（页眉 / 登录页）；
 * 未设置时回落品牌全称。
 *
 * 界面密度由 main.css 媒体查询三档驱动，不再使用 html zoom / 手动 UI 缩放。
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
    <NuxtPage :keepalive="{ max: 10 }" />
  </NuxtLayout>

  <AdminAuthExpiredDialog />
  <AdminActionFeedbackDialog />
  <AdminToastHost />
</template>
