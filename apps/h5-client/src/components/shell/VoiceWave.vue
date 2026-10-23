<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ level?: number }>(), { level: 0 })
const waveStyle = computed(() => ({ '--voice-amplitude': String(0.24 + Math.min(1, Math.max(0, props.level)) * 0.76) }))
</script>

<template>
  <span class="voice-wave" :style="waveStyle" aria-hidden="true">
    <svg class="voice-wave-line" viewBox="0 0 240 48" preserveAspectRatio="none">
      <path d="M0 24 Q10 24 20 24 T40 24 Q50 2 60 24 T80 24 Q90 46 100 24 T120 24 Q130 2 140 24 T160 24 Q170 46 180 24 T200 24 Q210 24 220 24 T240 24" />
      <path d="M0 24 Q10 24 20 24 T40 24 Q50 44 60 24 T80 24 Q90 4 100 24 T120 24 Q130 44 140 24 T160 24 Q170 4 180 24 T200 24 Q210 24 220 24 T240 24" />
    </svg>
  </span>
</template>

<style scoped>
.voice-wave { display: inline-flex; width: 100%; height: 2.5rem; overflow: hidden; align-items: center; color: inherit; }
.voice-wave-line { width: 100%; height: 100%; overflow: visible; transform: scaleY(var(--voice-amplitude)); transition: transform 120ms ease-out; }
.voice-wave-line path { fill: none; stroke: currentColor; stroke-width: 2; vector-effect: non-scaling-stroke; transform-origin: center; animation: voice-wave-flow 1.6s ease-in-out infinite alternate; }
.voice-wave-line path + path { opacity: .4; animation-delay: -.8s; }
@keyframes voice-wave-flow { from { transform: scaleY(.55) translateX(-3px); } to { transform: scaleY(1) translateX(3px); } }
@media (prefers-reduced-motion: reduce) { .voice-wave-line { transition: none; } .voice-wave-line path { animation: none; } }
</style>
