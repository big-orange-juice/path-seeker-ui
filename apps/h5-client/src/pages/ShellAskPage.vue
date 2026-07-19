<script setup lang="ts">
import { onMounted } from "vue"
import AskPanel from "@/components/shell/AskPanel.vue"
import { useAskStore } from "@/stores/useAskStore"

const askStore = useAskStore()

onMounted(() => {
  // 浮层放大进全屏时保留 store 附带状态（含用户已去掉）。
  // 仅直达全屏且从未附带、也未主动去掉时，才按上下文补一次。
  askStore.ensureAttachmentFromContext()
  askStore.closeAsk()
})
</script>

<template>
  <AskPanel full-page />
</template>
