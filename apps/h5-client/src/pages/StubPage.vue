<script setup lang="ts">
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { ClientEmptyState } from "@/components/ui"

const route = useRoute()
const router = useRouter()

const title = computed(() => String(route.meta.title || "功能迁移中"))
const description = computed(() => String(route.meta.description || "当前页面已预留路由，功能会在后续阶段接入。"))
</script>

<template>
  <ClientEmptyState
    :title="title"
    :description="description"
    action-text="返回任务大厅"
    @action="router.push('/shell/hall')"
  >
    <div class="rounded-[0.9rem] bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
      当前已经切到标准 Vue H5 路由结构，下一步会把 `apps/mp-wechat` 的真实任务数据、会话状态和页面职责逐段接入。
    </div>
  </ClientEmptyState>
</template>
