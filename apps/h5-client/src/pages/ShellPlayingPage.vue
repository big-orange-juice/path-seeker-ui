<script setup lang="ts">
import { useRouter } from "vue-router"
import { ClientEmptyState } from "@/components/ui"

const router = useRouter()
</script>

<template>
  <div class="client-surface">
    <!--
      进行中的路线应由服务端游玩记录接口提供。
      已移除对本地 activeSession 缓存列表的依赖，接口就绪后再接入。
    -->
    <ClientEmptyState
      title="暂无进行中的探索"
      description="当前探索记录将由服务端同步，接口接入后展示进行中的路线。可先从展厅选择路线开始。"
      action-text="去展厅"
      @action="router.push('/shell/hall')"
    />
  </div>
</template>
