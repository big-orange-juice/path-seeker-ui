<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, Clock3, Route } from 'lucide-vue-next'
import type { CulturalPlace, TourRoute } from '../types'

const props = defineProps<{ routes: TourRoute[]; places: CulturalPlace[]; selectedRouteId?: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const entries = computed(() => props.routes.map(route => ({
  route,
  stops: route.stopIds.flatMap(id => props.places.find(place => place.id === id)?.name ?? []).join(' → '),
})))
</script>

<template>
  <section class="route-catalog" aria-label="全部游览路线">
    <p class="catalog-intro">选一条适合你的路线，沿途听故事。</p>
    <div class="catalog-list">
      <button v-for="{ route, stops } in entries" :key="route.id" class="catalog-route" :class="{ selected: route.id === selectedRouteId }" :aria-label="`查看路线：${route.title}`" @click="emit('select', route.id)">
        <span class="route-topline"><span class="route-tag">{{ route.tag }}</span><span v-if="route.id === selectedRouteId" class="map-status">地图展示中</span><ArrowUpRight :size="16" /></span>
        <strong class="route-title">{{ route.title }}</strong>
        <span class="route-facts"><span><Clock3 :size="12" />{{ route.duration }} 分钟</span><span>{{ route.distance }}</span><span><Route :size="12" />{{ route.stopIds.length }} 站</span></span>
        <span class="route-stops">{{ stops }}</span>
      </button>
    </div>
    <p v-if="!entries.length" class="catalog-intro">这里的路线正在准备中，先在地图上看看文化地点吧。</p>
  </section>
</template>

<style scoped>
.route-catalog{padding:0 16px 20px}.catalog-intro{font-size:11px;color:var(--muted);margin:2px 0 14px;line-height:1.7}.catalog-list{display:grid;gap:10px}.catalog-route{display:flex;flex-direction:column;gap:10px;width:100%;padding:14px;text-align:left;border:1px solid var(--line);border-radius:15px;background:white;color:var(--ink)}.catalog-route:hover,.catalog-route:focus-visible{border-color:#91ab9d;background:#f5f8f5}.catalog-route.selected{border-color:#91ab9d;background:#edf3ee}.route-topline{display:flex;align-items:center;gap:8px;width:100%;color:var(--lake)}.route-tag{font-size:10px}.map-status{margin-left:auto;font-size:9px;color:#65766d}.route-topline>svg{margin-left:auto}.map-status+svg{margin-left:0}.route-title{font:600 18px/1.4 var(--display)}.route-facts{display:flex;flex-wrap:wrap;gap:12px;font-size:10px;color:#526c5d}.route-facts>span{display:flex;align-items:center;gap:4px}.route-stops{font-size:10px;line-height:1.8;color:var(--muted);padding-top:9px;border-top:1px dashed #d5dfd7}
</style>
