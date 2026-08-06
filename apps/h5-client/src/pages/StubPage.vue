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
      该功能正在准备中，请稍后再试。
    </div>
  </ClientEmptyState>
</template>
