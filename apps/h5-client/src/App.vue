<script setup lang="ts">
import { storeToRefs } from "pinia"
import { RouterView } from "vue-router"
import CinemaStage from "@/components/fx/CinemaStage.vue"
import GalleryBackground from "@/components/fx/GalleryBackground.vue"
import ClientToastViewport from "@/components/ui/ClientToastViewport.vue"
import { useCinemaStore } from "@/stores/useCinemaStore"

const cinemaStore = useCinemaStore()
const { viewDimmed, viewRising } = storeToRefs(cinemaStore)
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

  <CinemaStage />
  <ClientToastViewport />
</template>
