<script setup lang="ts">
import { Bike, Landmark } from 'lucide-vue-next'
import type { Destination, Scene } from '../types'
import DestinationMenu from './DestinationMenu.vue'
defineProps<{ scene: Scene; currentDestination?: Destination; destinations: Destination[] }>()
const emit = defineEmits<{ change: [scene: Scene]; selectDestination: [id: string] }>()
</script>

<template>
  <header class="site-header">
    <a class="brand" href="#" @click.prevent="emit('change', 'rickshaw')" aria-label="秘径寻踪首页">
      <span class="brand-mark">径</span><span><strong>秘径寻踪</strong><small>PATH SEEKER</small></span>
    </a>
    <nav class="scene-switch" aria-label="路线场景">
      <button :class="{ active: scene === 'rickshaw' }" :aria-pressed="scene === 'rickshaw'" @click="emit('change', 'rickshaw')"><Bike :size="17" />黄包车慢游<span class="new-label">新</span></button>
      <button :class="{ active: scene === 'museum' }" :aria-pressed="scene === 'museum'" @click="emit('change', 'museum')"><Landmark :size="16" />场馆探索</button>
    </nav>
    <div class="header-location"><DestinationMenu :current="currentDestination" :destinations="destinations" @select="emit('selectDestination', $event)" /><span class="visitor-avatar">游</span></div>
  </header>
</template>

<style scoped>
.site-header{height:88px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding:0 34px;background:var(--paper);gap:20px}.brand{display:flex;align-items:center;gap:11px;text-decoration:none;color:var(--ink);min-width:220px}.brand-mark{display:grid;place-items:center;width:42px;height:44px;background:var(--lake);color:white;border-radius:13px 4px;font:27px var(--display)}.brand strong{display:block;font:700 21px var(--display);letter-spacing:3px}.brand small{display:block;font-size:8px;letter-spacing:3px;margin-top:4px}.scene-switch{display:flex;gap:5px;background:#e9efec;padding:5px;border-radius:12px}.scene-switch button{display:flex;align-items:center;gap:8px;background:transparent;border:0;border-radius:8px;padding:11px 19px;color:var(--muted);font-size:13px;white-space:nowrap}.scene-switch .active{background:var(--paper);color:var(--lake);box-shadow:0 2px 8px #193c4009;font-weight:700}.new-label{font-size:9px;background:var(--ochre);color:#513f18;padding:2px 4px;border-radius:3px}.header-location{display:flex;align-items:center;gap:10px;min-width:220px;justify-content:flex-end}.visitor-avatar{display:grid;place-items:center;background:#e8eeeb;width:34px;height:34px;border-radius:50%;margin-left:4px;font-family:var(--display);color:var(--lake)}
@media(max-width:1080px){.site-header{padding:0 22px}.brand,.header-location{min-width:auto}}
@media(max-width:760px){.site-header{height:auto;padding:18px 18px 14px;display:grid;grid-template-columns:1fr auto;gap:18px}.brand strong{font-size:19px}.brand-mark{width:37px;height:39px}.brand small{font-size:7px}.scene-switch{grid-row:2;grid-column:1/-1}.scene-switch button{justify-content:center;flex:1;padding:11px 10px}.header-location{font-size:11px}.visitor-avatar{display:none}}
</style>
