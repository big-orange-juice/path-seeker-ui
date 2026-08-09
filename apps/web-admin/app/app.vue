<script setup lang="ts">
import { useAdminUiStore } from '@/stores/adminUi'

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

// 尽早初始化 UI 偏好 store，使 UI 缩放 class 在首屏即可挂上
useAdminUiStore()
</script>

<template>
  <NuxtLayout>
    <NuxtPage :keepalive="{ max: 10 }" />
  </NuxtLayout>

  <AdminAuthExpiredDialog />
  <AdminActionFeedbackDialog />
  <AdminToastHost />
</template>
