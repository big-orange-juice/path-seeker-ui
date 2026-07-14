<script setup lang="ts">
import { onMounted } from "vue"
import AskPanel from "@/components/shell/AskPanel.vue"
import { useAskStore } from "@/stores/useAskStore"

const askStore = useAskStore()

onMounted(() => {
  if (!askStore.attachment) {
    askStore.setAttachment(askStore.buildAttachmentFromContext())
  }
  askStore.closeAsk()
})
</script>

<template>
  <AskPanel full-page />
</template>
