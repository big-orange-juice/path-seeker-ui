<script setup lang="ts">
import { computed } from "vue"
import { RouterLink, useRoute } from "vue-router"
import { UiButton, UiCard } from "@path-seeker/ui"

const route = useRoute()

const title = computed(() => String(route.meta.title || "功能迁移中"))
const description = computed(() => String(route.meta.description || "当前页面已预留路由，功能会在后续阶段接入。"))
</script>

<template>
  <UiCard class="client-panel">
    <div class="space-y-4 p-5">
      <div class="space-y-2">
        <h2 class="text-2xl font-display text-foreground">{{ title }}</h2>
        <p class="client-page-copy">{{ description }}</p>
      </div>

      <div class="rounded-[0.9rem] bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
        当前已经切到标准 Vue H5 路由结构，下一步会把 `apps/mp-wechat` 的真实任务数据、会话状态和页面职责逐段接入。
      </div>

      <RouterLink to="/shell/hall" class="block">
        <UiButton variant="outline" class="w-full">返回任务大厅</UiButton>
      </RouterLink>
    </div>
  </UiCard>
</template>
