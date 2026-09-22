<script setup lang="ts">
import { ArrowRight, Clock3, Heart, MapPin } from 'lucide-vue-next'
import type { CulturalPlace, TourRoute } from '../types'
import PlaceArtwork from './PlaceArtwork.vue'
import GuideNarration from './GuideNarration.vue'

defineProps<{ place: CulturalPlace; routes: TourRoute[]; favorite: boolean; compact?: boolean }>()
const emit = defineEmits<{ favorite: [id: string]; selectRoute: [id: string] }>()
</script>

<template>
  <article class="place-detail" :class="{ compact }">
    <PlaceArtwork v-if="!compact" :kind="place.artwork" :accent="place.accent" />
    <div v-if="!compact" class="detail-title"><div><span class="eyebrow">{{ place.category }} <span>·</span> {{ place.era }}</span><h2>{{ place.name }}</h2></div><button class="favorite-button" :class="{ saved: favorite }" :aria-label="favorite ? '取消收藏' : '收藏地点'" :aria-pressed="favorite" @click="emit('favorite', place.id)"><Heart :size="19" :fill="favorite ? 'currentColor' : 'none'" /></button></div>
    <p v-if="!compact" class="place-subtitle">{{ place.subtitle }}</p>
    <p v-if="!compact" class="address"><MapPin :size="12" />{{ place.address }}</p>
    <GuideNarration :key="place.id" :place="place" :compact="compact" />
    <component :is="compact ? 'details' : 'div'" class="related-disclosure">
      <summary v-if="compact">经过这里的路线<span>{{ routes.length }} 条</span></summary>
      <div v-else class="related-heading"><h3>经过这里的路线</h3><span>{{ routes.length }} 条</span></div>
      <button v-for="route in routes" :key="route.id" class="related-route" @click="emit('selectRoute', route.id)"><span class="route-swatch" :style="{ background: route.color }" /><span><strong>{{ route.title }}</strong><small><Clock3 :size="11" />{{ route.duration }} 分钟 · {{ route.stopIds.length }} 站 · {{ route.distance }}</small></span><ArrowRight :size="15" /></button>
    </component>
    <div v-if="compact" class="place-context"><p><MapPin :size="12" />{{ place.address }}</p><button :class="{ saved: favorite }" :aria-label="favorite ? '取消收藏' : '收藏地点'" :aria-pressed="favorite" @click="emit('favorite', place.id)"><Heart :size="14" :fill="favorite ? 'currentColor' : 'none'" />{{ favorite ? '已收藏' : '收藏' }}</button></div>
    <p class="visit-note">{{ place.visitNote }}</p>
  </article>
</template>

<style scoped>
.place-detail{padding:18px}.detail-title{display:flex;align-items:center;justify-content:space-between;margin-top:19px}.eyebrow{font-size:10px;color:var(--muted)}.eyebrow span{margin:0 5px;color:#c1c9c1}.detail-title h2{font:600 28px var(--display);margin:8px 0 0;letter-spacing:2px}.favorite-button{border:1px solid var(--line);border-radius:50%;width:36px;height:36px;background:white;display:grid;place-items:center;color:var(--muted)}.favorite-button.saved{color:#b95646;border-color:#e8c8be;background:#fbf0ea}.place-subtitle{font:13px var(--display);color:var(--muted);margin:10px 0 12px}.address{display:flex;gap:5px;align-items:center;font-size:10px;color:#8b9790;margin-bottom:20px}.related-heading{display:flex;justify-content:space-between;align-items:center;margin:25px 0 8px}.related-heading h3{font-size:12px;margin:0}.related-heading span{font-size:10px;color:var(--muted)}.related-route{display:flex;gap:10px;align-items:center;width:100%;padding:13px 0;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);color:var(--ink)}.route-swatch{width:4px;height:30px;border-radius:3px;flex-shrink:0}.related-route strong{font-size:11px;font-weight:600}.related-route small{display:flex;align-items:center;gap:3px;font-size:10px;color:var(--muted);margin-top:7px}.related-route>svg{margin-left:auto}.visit-note{color:#939c91;font-size:10px;line-height:1.7;margin:19px 0 0;padding-left:10px;border-left:2px solid #d2dccf}
.compact{padding:0 16px 16px}.related-disclosure summary{display:flex;align-items:center;gap:8px;list-style:none;cursor:pointer;padding:12px 0;border-top:1px solid var(--line);font-size:11px;color:#476858}.related-disclosure summary::-webkit-details-marker{display:none}.related-disclosure summary>span{margin-left:auto;font-size:10px;color:var(--muted)}.related-disclosure summary::after{content:'＋';font-size:15px}.related-disclosure[open] summary::after{content:'−'}.place-context{display:flex;align-items:center;gap:9px;border-top:1px solid var(--line);padding-top:11px}.place-context p{display:flex;align-items:center;gap:4px;flex:1;margin:0;font-size:10px;color:var(--muted)}.place-context button{display:flex;align-items:center;gap:4px;padding:6px 8px;border:0;border-radius:8px;background:#eef3ef;color:var(--lake);font-size:10px;flex-shrink:0}.place-context button.saved{color:#b95646;background:#fbf0ea}.compact .visit-note{margin:12px 0 0;font-size:10px}
</style>
