<script setup lang="ts">
import { ArrowUpRight, BookOpen, Landmark } from 'lucide-vue-next'
import type { CulturalPlace } from '../types'
import PlaceArtwork from './PlaceArtwork.vue'
defineProps<{ places: CulturalPlace[]; selectedPlaceId: string }>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <section class="museum-gallery"><div class="gallery-heading"><Landmark :size="26" :stroke-width="1.3" /><span>文 化 探 索 馆</span><h2>一眼千年，<br />与文明慢慢相见。</h2><p>循着器物的线索，听见历史的回声。</p></div><div class="exhibit-grid"><button v-for="(place, index) in places" :key="place.id" class="exhibit-card" :class="{ selected: selectedPlaceId === place.id }" @click="emit('select', place.id)"><PlaceArtwork :kind="place.artwork" :accent="place.accent" /><div><span>CHAPTER {{ String(index + 1).padStart(2, '0') }}</span><h3>{{ place.name }}<ArrowUpRight :size="17" /></h3><p>{{ place.subtitle }}</p><small><BookOpen :size="12" />{{ place.duration }} 分钟 · 讲解与观察</small></div></button></div><p class="gallery-note">场馆路线体验 · 示例展品</p></section>
</template>

<style scoped>
.museum-gallery{border-radius:20px;background:#e9ede5;padding:32px;min-height:600px}.gallery-heading{color:var(--lake)}.gallery-heading>span{font-size:10px;display:block;margin-top:17px}.gallery-heading h2{font:500 36px/1.5 var(--display);margin:18px 0}.gallery-heading p{font-size:12px;color:var(--muted)}.exhibit-grid{display:grid;gap:14px;margin-top:30px}.exhibit-card{display:grid;grid-template-columns:130px 1fr;gap:18px;background:#ffffffbb;border:1px solid #ffffff;border-radius:14px;text-align:left;padding:12px;color:var(--ink)}.exhibit-card.selected{border-color:#719686;box-shadow:0 0 0 2px #70978718}.exhibit-card :deep(.artwork svg){height:145px;width:220px;max-width:none;transform:translateX(-45px)}.exhibit-card>div:last-child{padding:10px 0}.exhibit-card span{font:9px monospace;letter-spacing:2px;color:var(--muted)}.exhibit-card h3{font:20px var(--display);display:flex;align-items:center;justify-content:space-between;margin:13px 0}.exhibit-card p{font-size:11px;color:var(--muted)}.exhibit-card small{display:flex;align-items:center;gap:5px;font-size:9px;color:var(--lake);margin-top:15px}.gallery-note{text-align:center;font-size:10px;color:var(--muted);margin:25px 0 0}
@media(max-width:760px){.museum-gallery{padding:24px;min-height:0}.gallery-heading h2{font-size:30px}.exhibit-card{grid-template-columns:100px 1fr;gap:12px}.exhibit-card :deep(.artwork svg){transform:translateX(-60px)}}
</style>
