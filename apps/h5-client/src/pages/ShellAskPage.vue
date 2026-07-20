<script setup lang="ts">
import { onMounted } from "vue"
import AskPanel from "@/components/shell/AskPanel.vue"
import { useAskStore } from "@/stores/useAskStore"

const askStore = useAskStore()

onMounted(() => {
  // 全屏页打开时关掉浮层标记，避免叠两层
  askStore.closeAsk()
})
</script>

<template>
  <AskPanel full-page />
</template>
