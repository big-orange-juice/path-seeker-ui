<script setup lang="ts">
import { storeToRefs } from "pinia"
import { RouterView, useRoute } from "vue-router"
import { computed } from "vue"
import CinemaStage from "@/components/fx/CinemaStage.vue"
import GalleryBackground from "@/components/fx/GalleryBackground.vue"
import AskPanel from "@/components/shell/AskPanel.vue"
import AuthExpiredDialog from "@/components/shell/AuthExpiredDialog.vue"
import FloatingMissionFab from "@/components/shell/FloatingMissionFab.vue"
import ClientToastViewport from "@/components/ui/ClientToastViewport.vue"
import { useCinemaStore } from "@/stores/useCinemaStore"

const route = useRoute()
const cinemaStore = useCinemaStore()
const { viewDimmed, viewRising } = storeToRefs(cinemaStore)

/** 全页问一问时不叠浮层 */
const showAskSheet = computed(() => route.path !== "/shell/ask" && route.path !== "/auth")
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
