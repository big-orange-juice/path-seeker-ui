<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { SlidersHorizontal } from 'lucide-vue-next'
import type { TourRoute } from '../types'
import MuseumRouteCard from './MuseumRouteCard.vue'

const props = defineProps<{ routes: TourRoute[]; destinationName: string; selectedRouteId: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const showFilters = shallowRef(false)
const category = shallowRef('全部')
const categories = computed(() => ['全部', ...new Set(props.routes.map(route => route.tag))])
const visibleRoutes = computed(() => props.routes.filter(route => category.value === '全部' || route.tag === category.value))
</script>

<template>
  <section class="museum-route-gallery" aria-label="场馆路线展厅">
    <header class="gallery-heading"><span class="eyebrow">PATH SEEKER · {{ destinationName }}</span><h1>展厅</h1><p>选一条路线，听见器物背后的故事。</p></header>
    <div class="gallery-toolbar"><span>{{ visibleRoutes.length }} 条路线在展</span><button :aria-expanded="showFilters" aria-controls="museum-route-filters" @click="showFilters = !showFilters"><SlidersHorizontal :size="14" />{{ category === '全部' ? '筛选' : category }}</button></div>
    <div v-if="showFilters" id="museum-route-filters" class="gallery-filters" role="group" aria-label="路线主题筛选"><button v-for="item in categories" :key="item" :class="{ active: category === item }" :aria-pressed="category === item" @click="category = item">{{ item }}</button></div>
    <div v-if="visibleRoutes.length" class="route-masonry"><MuseumRouteCard v-for="route in visibleRoutes" :key="route.id" :route="route" :selected="selectedRouteId === route.id" @select="emit('select', $event)" /></div>
    <p v-else class="gallery-empty">这个主题还没有路线，请选择其他主题。</p>
  </section>
</template>

<style scoped>
.museum-route-gallery{min-width:0;max-width:900px;width:100%;margin:0 auto;padding:8px 0 24px}.gallery-heading .eyebrow{font-size:10px;letter-spacing:2px;color:#728578}.gallery-heading h1{font:500 38px var(--display);margin:9px 0 12px;letter-spacing:3px}.gallery-heading p{font-size:12px;color:var(--muted);margin:0}.gallery-toolbar{display:flex;align-items:center;justify-content:space-between;margin:25px 0 19px;font-size:11px;color:#748176}.gallery-toolbar button{display:flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:20px;padding:8px 13px;background:white;color:var(--ink);font-size:11px}.gallery-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.gallery-filters button{padding:7px 11px;border-radius:5px;border:1px solid var(--line);background:white;color:#65766d;font-size:11px}.gallery-filters button.active{background:var(--lake);color:white;border-color:var(--lake)}.route-masonry{columns:2;column-gap:18px}.gallery-empty{padding:40px 0;color:var(--muted);font-size:13px}
@media(max-width:760px){.museum-route-gallery{padding:6px 0 16px}.gallery-heading h1{font-size:30px}.gallery-toolbar{margin-top:23px}.route-masonry{column-gap:12px}}
</style>
