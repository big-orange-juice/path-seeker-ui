<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { MapPin, Search, SlidersHorizontal, X } from 'lucide-vue-next'
import type { CulturalPlace } from '../types'

const props = defineProps<{ places: CulturalPlace[]; selectedPlaceId: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const query = shallowRef('')
const category = shallowRef('全部')
const filtersOpen = shallowRef(false)
const categories = computed(() => ['全部', ...new Set(props.places.map(place => place.category))])
const visiblePlaces = computed(() => props.places.filter(place =>
  (category.value === '全部' || category.value === place.category)
  && `${place.name}${place.category}${place.address}`.includes(query.value.trim())))
</script>

<template>
  <section class="map-discovery" aria-label="寻找文化地点">
    <div class="map-search-row">
      <label class="map-search"><Search :size="18" /><input v-model="query" aria-label="搜索文化地点" placeholder="寻找一处风景、一段故事" /><button v-if="query" aria-label="清除搜索" @click="query = ''"><X :size="15" /></button></label>
      <button class="filter-toggle" :class="{ active: category !== '全部' }" :aria-expanded="filtersOpen" aria-controls="map-categories" aria-label="地点分类筛选" @click="filtersOpen = !filtersOpen"><SlidersHorizontal :size="18" /></button>
    </div>
    <div v-if="filtersOpen" id="map-categories" class="map-categories" role="group" aria-label="地点分类"><button v-for="item in categories" :key="item" :aria-pressed="category === item" :class="{ active: category === item }" @click="category = item">{{ item }}</button></div>
    <div class="map-place-chips" aria-label="文化地点列表"><button v-for="place in visiblePlaces" :key="place.id" :aria-pressed="selectedPlaceId === place.id" :class="{ active: selectedPlaceId === place.id }" @click="emit('select', place.id)"><MapPin v-if="selectedPlaceId === place.id" :size="12" />{{ place.name }}</button><span v-if="!visiblePlaces.length" class="no-results">没有找到地点 <button @click="query = ''; category = '全部'">清除筛选</button></span></div>
  </section>
</template>

<style scoped>
.map-discovery{display:grid;gap:9px}.map-search-row{display:flex;gap:8px}.map-search{min-width:0;flex:1;display:flex;align-items:center;gap:9px;background:#fffffff5;border:1px solid #ffffff;border-radius:13px;padding:0 13px;height:46px;box-shadow:0 4px 20px #183e4314;color:#65796e;backdrop-filter:blur(12px)}.map-search input{border:0;background:transparent;min-width:0;flex:1;color:var(--ink);font-size:12px;outline-offset:2px}.map-search button{border:0;background:none;color:var(--muted);display:grid;place-items:center;padding:5px}.filter-toggle{width:46px;display:grid;place-items:center;border:1px solid #fff;border-radius:13px;background:#fffffff5;color:var(--lake);box-shadow:0 4px 20px #183e4314}.map-place-chips,.map-categories{display:flex;gap:7px;overflow-x:auto;padding:2px 2px 5px;scrollbar-width:none}.map-place-chips>button,.map-categories button{display:flex;align-items:center;gap:4px;flex-shrink:0;white-space:nowrap;border:1px solid #fff;border-radius:20px;background:#fffffff5;padding:9px 12px;font-size:11px;color:var(--ink);box-shadow:0 2px 10px #183e4310}.map-place-chips .active,.map-categories .active,.filter-toggle.active{background:var(--lake);border-color:var(--lake);color:white}.map-categories{background:#fffffff5;border-radius:12px;padding:8px}.map-categories button{box-shadow:none;font-size:10px;padding:7px 10px;border-color:var(--line)}.no-results{background:#fffffff5;border-radius:10px;padding:10px 12px;font-size:11px;color:var(--muted)}.no-results button{border:0;background:none;color:var(--lake);font-size:11px}
</style>
