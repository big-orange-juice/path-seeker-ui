<script setup lang="ts">
import { storeToRefs } from "pinia"
import { RouterView, useRoute } from "vue-router"
import { computed, onMounted, onUnmounted, watch } from "vue"
import CinemaStage from "@/components/fx/CinemaStage.vue"
import GalleryBackground from "@/components/fx/GalleryBackground.vue"
import AskPanel from "@/components/shell/AskPanel.vue"
import AuthExpiredDialog from "@/components/shell/AuthExpiredDialog.vue"
import FloatingMissionFab from "@/components/shell/FloatingMissionFab.vue"
import ClientToastViewport from "@/components/ui/ClientToastViewport.vue"
import { useCinemaStore } from "@/stores/useCinemaStore"
import { useAskStore } from "@/stores/useAskStore"

const route = useRoute()
const cinemaStore = useCinemaStore()
const askStore = useAskStore()
const { viewDimmed, viewRising } = storeToRefs(cinemaStore)

/** 全页问一问时不叠浮层 */
const showAskSheet = computed(() => route.path !== "/shell/ask" && route.path !== "/auth")

watch(() => [route.path, askStore.open, askStore.interactionMode], () => {
  if ((route.path !== "/shell/ask" && !askStore.open) || askStore.interactionMode !== "voice") {
    askStore.cancelVoiceInput()
  }
})

function handleVisibility() {
  if (document.visibilityState === "hidden") askStore.cancelVoiceInput()
}

onMounted(() => document.addEventListener("visibilitychange", handleVisibility))
onUnmounted(() => {
  document.removeEventListener("visibilitychange", handleVisibility)
  askStore.cancelVoiceInput()
})
</script>

<template>
  <GalleryBackground />

  <!-- 仅页面内容参与 cinema 压暗/升起，FAB 放在外面避免过场闪烁 -->
  <div
    id="client-view"
    class="client-view"
    :class="{
      'fx-dim': viewDimmed,
      'fx-rise': viewRising,
    }"
  >
    <RouterView />
  </div>

  <FloatingMissionFab />
  <AskPanel v-if="showAskSheet" />
  <CinemaStage />
  <ClientToastViewport />
  <AuthExpiredDialog />
</template>
