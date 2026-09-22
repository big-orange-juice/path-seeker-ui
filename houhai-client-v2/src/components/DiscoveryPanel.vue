<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { ArrowUpRight, Bike, ChevronRight, Clock3, MapPin, Search } from 'lucide-vue-next'
import type { CulturalPlace, Scene, TourRoute } from '../types'
import PlaceArtwork from './PlaceArtwork.vue'

const props = defineProps<{ scene: Scene; places: CulturalPlace[]; routes: TourRoute[]; selectedPlaceId: string; selectedRouteId: string }>()
const emit = defineEmits<{ selectPlace: [id: string]; selectRoute: [id: string] }>()
const query = shallowRef('')
const category = shallowRef('全部')
const categories = computed(() => ['全部', ...new Set(props.places.map(place => place.category))])
const visiblePlaces = computed(() => props.places.filter(place => (category.value === '全部' || place.category === category.value) && `${place.name}${place.category}${place.address}`.includes(query.value.trim())))
const featuredRoute = computed(() => props.routes.find(route => route.id === props.selectedRouteId) ?? props.routes[0])
watch(() => props.scene, () => { query.value = ''; category.value = '全部' })
</script>

<template>
  <aside class="discovery">
    <div class="discovery-heading"><span class="eyebrow">{{ scene === 'rickshaw' ? 'BEIJING · HOUHAI' : 'CULTURE · COLLECTION' }}</span><h1>{{ scene === 'rickshaw' ? '后海，慢一点。' : '在器物里，看中国。' }}</h1><p>{{ scene === 'rickshaw' ? '坐上黄包车，听一座城的故事。' : '循着一条路线，发现文物的故事。' }}</p></div>
    <label class="search-box"><Search :size="17" /><input v-model="query" :placeholder="scene === 'rickshaw' ? '寻找一处风景、一段故事' : '搜索展品或展厅'" aria-label="搜索文化地点" /></label>
    <div class="category-list" aria-label="地点分类"><button v-for="item in categories" :key="item" :class="{ active: item === category }" :aria-pressed="item === category" @click="category = item">{{ item }}</button></div>
    <div class="section-label"><h2>{{ scene === 'rickshaw' ? '沿途，值得停留' : '值得细看的馆藏' }}</h2><span>{{ visiblePlaces.length }} {{ scene === 'rickshaw' ? '处' : '件' }}</span></div>
    <div class="place-list">
      <button v-for="(place, index) in visiblePlaces" :key="place.id" class="place-item" :class="{ selected: place.id === selectedPlaceId }" :aria-pressed="place.id === selectedPlaceId" @click="emit('selectPlace', place.id)">
        <PlaceArtwork :kind="place.artwork" :accent="place.accent" compact />
        <span class="place-item-copy"><span class="place-name">{{ place.name }}</span><span class="place-subtitle">{{ place.category }} · {{ place.duration }} 分钟讲解</span><span class="place-number">{{ String(index + 1).padStart(2, '0') }} / {{ scene === 'rickshaw' ? 'HOUHAI' : 'COLLECTION' }}</span></span>
        <ChevronRight :size="15" class="place-chevron" />
      </button>
      <div v-if="!visiblePlaces.length" class="empty-search"><Search :size="22" /><p>没有找到这个地点</p><button class="text-button" @click="query = ''; category = '全部'">清除筛选</button></div>
    </div>
    <div v-if="featuredRoute" class="route-ticket">
      <div class="ticket-header"><Bike :size="18" /><span>为您安排好的一程</span><ArrowUpRight :size="16" /></div>
      <h3>{{ featuredRoute.title }}</h3><p>{{ featuredRoute.subtitle }}</p>
      <div class="ticket-facts"><span><Clock3 :size="13" />{{ featuredRoute.duration }} 分钟</span><span><MapPin :size="13" />{{ featuredRoute.stopIds.length }} 站</span></div>
      <button @click="emit('selectRoute', featuredRoute.id)">查看完整路线 <ChevronRight :size="16" /></button>
    </div>
    <p class="sidebar-note">{{ scene === 'rickshaw' ? '湖岸有风，胡同有故事。' : '让每一次观看，都有所发现。' }}</p>
  </aside>
</template>

<style scoped>
.discovery{padding:8px 22px 12px 0;min-width:0}.eyebrow{font-size:9px;font-weight:700;letter-spacing:2.5px;color:var(--muted)}.discovery-heading h1{font:600 28px/1.45 var(--display);letter-spacing:1px;margin:12px 0 8px}.discovery-heading p{font-size:12px;color:var(--muted);margin:0 0 25px}.search-box{display:flex;align-items:center;gap:9px;background:white;border:1px solid var(--line);border-radius:10px;padding:11px 12px;color:var(--muted)}.search-box input{background:none;border:0;outline:0;width:100%;font-size:11px;color:var(--ink)}.category-list{display:flex;gap:7px;flex-wrap:wrap;margin:14px 0 25px}.category-list button{font-size:10px;color:var(--muted);background:transparent;border:1px solid var(--line);border-radius:6px;padding:5px 8px}.category-list .active{color:var(--lake);border-color:var(--lake);background:#e5eeeb}.section-label{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.section-label h2{font-size:13px;font-weight:600;margin:0}.section-label>span{font:11px monospace;color:var(--muted)}.place-list{display:grid;gap:8px}.place-item{position:relative;display:flex;align-items:center;gap:11px;text-align:left;border:1px solid transparent;background:transparent;padding:9px 7px;border-radius:12px;width:100%;color:var(--ink)}.place-item:hover{background:#edf2ee}.place-item.selected{background:#e7eeeb;border-color:#c6d7ce}.place-item-copy{min-width:0}.place-name{display:block;font-size:13px;font-weight:650}.place-subtitle{display:block;font-size:10px;color:var(--muted);margin-top:7px}.place-number{display:block;font:8px monospace;letter-spacing:1px;color:#8b9a91;margin-top:6px}.place-chevron{margin-left:auto;flex-shrink:0;color:#93a39a}.route-ticket{background:var(--lake);color:#f9fbf7;border-radius:14px;margin-top:26px;padding:18px;position:relative}.ticket-header{display:flex;align-items:center;gap:8px;color:#c6d8d3;font-size:10px}.ticket-header svg:last-child{margin-left:auto}.route-ticket h3{font:600 17px var(--display);margin:17px 0 8px}.route-ticket p{font-size:10px;color:#b5ccc5}.ticket-facts{display:flex;gap:22px;border-bottom:1px dashed #ffffff35;padding:13px 0 16px;font-size:11px}.ticket-facts span{display:flex;align-items:center;gap:5px}.route-ticket>button{display:flex;align-items:center;justify-content:space-between;width:100%;padding:14px 0 0;border:0;background:none;color:#eff6ec;font-size:11px}.sidebar-note{text-align:center;font:11px var(--display);letter-spacing:3px;color:#98a79d;margin:22px 0 0}.empty-search{text-align:center;padding:25px 0;font-size:12px;color:var(--muted)}
@media(max-width:1120px) and (min-width:761px){.discovery{padding-right:14px}.discovery-heading h1{font-size:24px}.place-item{gap:7px}.place-item :deep(.compact){width:46px;height:52px}.place-subtitle{font-size:9px}.place-chevron{display:none}}
@media(max-width:760px){.discovery{padding:0}.discovery-heading{padding:5px 2px 0}.discovery-heading h1{font-size:28px;margin-top:8px}.discovery-heading p{margin-bottom:18px}.search-box{padding:12px}.category-list{margin:12px 0;flex-wrap:nowrap;overflow:auto;padding-bottom:3px}.category-list button{white-space:nowrap}.section-label,.route-ticket,.sidebar-note{display:none}.place-list{display:flex;overflow-x:auto;margin-bottom:15px;gap:7px;padding-bottom:4px}.place-item{width:auto;flex-shrink:0;padding:8px 12px;background:white;border-color:var(--line)}.place-item :deep(.artwork),.place-subtitle,.place-number,.place-chevron{display:none}.place-name{font-size:11px}.empty-search{padding:8px;width:100%}.empty-search p{display:inline;margin:0 12px}.empty-search>svg{display:none}}
</style>
