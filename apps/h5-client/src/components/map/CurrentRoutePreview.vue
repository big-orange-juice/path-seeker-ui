<script setup lang="ts">
import type { OutdoorRouteMapResponse } from '@path-seeker/ts-shared'
defineProps<{ routeMap: OutdoorRouteMapResponse }>()
defineEmits<{ clear: []; detail: [routeId: string] }>()
</script>
<template><article class="route-preview"><div><p>当前路线 · {{ routeMap.stations.length }} 站</p><h2>{{ routeMap.title }}</h2><span v-if="routeMap.geometryStatus === 'ready'">{{ routeMap.distanceMeters ?? 0 }} 米 · 约 {{ routeMap.estimatedMinutes ?? 0 }} 分钟</span><span v-else>暂仅展示路线站点</span></div><div class="route-actions"><button type="button" @click="$emit('detail', routeMap.routeId)">查看</button><button type="button" @click="$emit('clear')">清除</button></div></article></template>
<style scoped>.route-preview{display:flex;align-items:center;justify-content:space-between;gap:1rem;border:1px solid rgba(225,184,100,.35);border-radius:1rem;background:rgba(17,14,10,.92);padding:.8rem 1rem;color:#fff7e6;box-shadow:0 12px 32px rgba(0,0,0,.34);backdrop-filter:blur(12px)}.route-preview p{margin:0;color:#dcb369;font-size:.65rem;letter-spacing:.08em}.route-preview h2{margin:.2rem 0;font-size:.95rem}.route-preview span{color:rgba(255,247,230,.65);font-size:.7rem}.route-actions{display:flex;gap:.35rem}.route-actions button{border:1px solid rgba(225,184,100,.35);border-radius:999px;padding:.38rem .58rem;color:#e7c37c;font-size:.68rem}</style>
