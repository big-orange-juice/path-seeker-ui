<script setup lang="ts">
import { useRouter } from "vue-router"
import { ClientEmptyState } from "@/components/ui"

const router = useRouter()
</script>

<template>
  <div class="client-surface">
    <!--
      收藏 / 已完成路线应由服务端游玩记录与徽章接口提供。
      已移除对本地 archiveEntries 缓存的依赖，接口就绪后再接入。
    -->
    <ClientEmptyState
      title="暂无收藏"
      description="完成路线后的徽章与记录将由服务端同步，接口接入后展示。可先去展厅开始一条路线。"
      action-text="去展厅"
      @action="router.push('/shell/hall')"
    />
  </div>
</template>
