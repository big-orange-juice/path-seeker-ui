<script setup lang="ts">
import { storeToRefs } from "pinia"
import { useCinemaStore } from "@/stores/useCinemaStore"

const cinemaStore = useCinemaStore()
const { showVeil, label, effect, isActive } = storeToRefs(cinemaStore)
</script>

<template>
  <!-- Cinema veil：路由过场 + 接口 loading 共用 -->
  <div
    class="cinema-veil"
    :class="{
      'is-on': showVeil,
      'is-loading': isActive && label,
      [`effect-${effect || 'swirl'}`]: true,
    }"
    aria-live="polite"
    :aria-busy="isActive"
  >
    <div class="cinema-veil-mist" />
    <div v-if="label && isActive" class="cinema-veil-label">
      <span class="cinema-veil-dot" />
      <span>{{ label }}</span>
    </div>
  </div>
</template>
