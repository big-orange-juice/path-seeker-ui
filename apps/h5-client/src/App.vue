<script setup lang="ts">
import { storeToRefs } from "pinia"
import { RouterView, useRoute } from "vue-router"
import { computed } from "vue"
import CinemaStage from "@/components/fx/CinemaStage.vue"
import GalleryBackground from "@/components/fx/GalleryBackground.vue"
import AskPanel from "@/components/shell/AskPanel.vue"
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

  <AskPanel v-if="showAskSheet" />
  <CinemaStage />
  <ClientToastViewport />
</template>
