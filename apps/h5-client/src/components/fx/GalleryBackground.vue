<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from "vue"
import { createStarfieldEngine, registerStarfield, type StarfieldHandle } from "@/fx/starfieldEngine"

const canvasRef = useTemplateRef<HTMLCanvasElement>("starCanvas")
let handle: StarfieldHandle | null = null

onMounted(() => {
  if (!canvasRef.value) {
    return
  }
  handle = createStarfieldEngine(canvasRef.value)
  registerStarfield(handle)
})

onUnmounted(() => {
  handle?.destroy()
  registerStarfield(null)
  handle = null
})
</script>

<template>
  <div class="gallery-bg" aria-hidden="true">
    <canvas ref="starCanvas" class="starfield" />
    <div class="gallery-glow gallery-glow-a" />
    <div class="gallery-glow gallery-glow-b" />
    <div class="gallery-wash" />
    <div class="gallery-grain" />
  </div>
</template>
