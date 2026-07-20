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
  <!-- 纯色底（与 mp-shell #0a0908 一致）+ 星点；无渐变/噪点/blur 光晕 -->
  <div class="gallery-bg" aria-hidden="true">
    <canvas ref="starCanvas" class="starfield" />
  </div>
</template>
