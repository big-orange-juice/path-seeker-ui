<script setup lang="ts">
import { ArrowUpRight, Bookmark, Footprints } from 'lucide-vue-next'
import type { CulturalPlace } from '../types'
import PlaceArtwork from './PlaceArtwork.vue'
defineProps<{ kind: 'favorites' | 'journeys'; places: CulturalPlace[]; completedRoutes: number }>()
const emit = defineEmits<{ select: [id: string]; explore: [] }>()
</script>

<template>
  <main class="collection-view"><div class="collection-title"><Bookmark v-if="kind === 'favorites'" :size="26" /><Footprints v-else :size="26" /><span class="eyebrow">MY PATH SEEKER</span><h1>{{ kind === 'favorites' ? '想去的地方，先珍藏。' : '走过的路，都算数。' }}</h1><p>{{ kind === 'favorites' ? `收藏了 ${places.length} 个文化地点，留给下次慢慢看。` : `已体验 ${places.length} 个地点，完成 ${completedRoutes} 条路线。` }}</p></div><div v-if="places.length" class="collection-grid"><button v-for="place in places" :key="place.id" class="collection-card" @click="emit('select', place.id)"><PlaceArtwork :kind="place.artwork" :accent="place.accent" /><div><span>{{ place.scene === 'rickshaw' ? '后海慢游' : '场馆探索' }} · {{ place.category }}</span><h2>{{ place.name }}<ArrowUpRight :size="18" /></h2><p>{{ place.intro }}</p></div></button></div><div v-else class="collection-empty"><p>{{ kind === 'favorites' ? '遇见喜欢的地点，点一下爱心，就能在这里找到它。' : '选一条路线出发，完成地点后，就会留下您的足迹。' }}</p><button class="primary-button" @click="emit('explore')">去探索一段故事<ArrowUpRight :size="16" /></button></div></main>
</template>

<style scoped>
.collection-view{max-width:1050px;margin:0 auto;padding:42px 30px 100px}.collection-title>svg{display:block;color:var(--lake);margin-bottom:20px}.eyebrow{font-size:10px;color:var(--muted);letter-spacing:3px}.collection-title h1{font:600 32px var(--display);margin:15px 0}.collection-title p{font-size:13px;color:var(--muted)}.collection-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;margin-top:35px}.collection-card{border:1px solid var(--line);border-radius:16px;background:white;text-align:left;padding:12px;color:var(--ink)}.collection-card>div:last-child{padding:15px 7px}.collection-card span{font-size:10px;color:var(--muted)}.collection-card h2{display:flex;align-items:center;justify-content:space-between;font:22px var(--display)}.collection-card p{font-size:11px;line-height:1.8;color:var(--muted)}.collection-empty{max-width:450px;margin:65px auto;text-align:center}.collection-empty p{font-size:13px;line-height:2;color:var(--muted)}.collection-empty button{margin-top:25px}
@media(max-width:760px){.collection-view{padding:30px 20px 100px}.collection-title h1{font-size:26px}.collection-grid{grid-template-columns:1fr;gap:18px}}
</style>
