<script setup lang="ts">
import { ArrowUpRight, Clock3 } from 'lucide-vue-next'
import type { TourRoute } from '../types'
import PlaceArtwork from './PlaceArtwork.vue'

defineProps<{ route: TourRoute; selected: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <button class="museum-route-card" :class="{ selected }" :aria-pressed="selected" :aria-label="`查看路线：${route.title}`" :style="{ '--route-color': route.color }" @click="emit('select', route.id)">
    <div class="route-art"><PlaceArtwork :kind="route.coverArtwork ?? 'bronze'" :accent="route.color" /><span class="route-tag">{{ route.tag }}</span></div>
    <div class="route-card-copy">
      <span class="route-stations">{{ route.stopIds.length }} 站 <span>·</span> {{ route.distance }}</span>
      <h3>{{ route.title }}</h3>
      <p>{{ route.subtitle }}</p>
      <div class="route-card-meta"><span>{{ route.guideName ?? '馆内导览' }}</span><span><Clock3 :size="11" />{{ route.duration }} 分钟</span></div>
      <span class="route-entry">查看路线 <ArrowUpRight :size="14" /></span>
    </div>
  </button>
</template>

<style scoped>
.museum-route-card{display:block;break-inside:avoid;width:100%;margin:0 0 18px;padding:0;border:1px solid var(--line);border-radius:13px;overflow:hidden;text-align:left;background:white;color:var(--ink)}.museum-route-card:hover{border-color:#90a99a}.museum-route-card.selected{border-color:var(--lake);box-shadow:0 0 0 2px #183e4312}.route-art{position:relative;height:210px;background:color-mix(in srgb,var(--route-color) 12%,var(--paper))}.route-art :deep(.artwork){height:100%;border-radius:0;background:transparent}.route-art :deep(.artwork svg){height:100%;width:100%;transform:scale(1.25)}.route-art :deep(.art-caption){display:none}.route-tag{position:absolute;top:14px;left:14px;border:1px solid #ffffff90;background:#ffffffb8;color:var(--lake);padding:5px 8px;border-radius:4px;font-size:10px}.route-card-copy{padding:18px 18px 15px}.route-stations{font-size:10px;letter-spacing:1px;color:#65786b}.route-stations>span{padding:0 4px;color:#a2b0a7}.route-card-copy h3{font:600 24px/1.45 var(--display);margin:10px 0 8px}.route-card-copy p{font-size:12px;line-height:1.7;color:#748176;margin:0 0 17px}.route-card-meta{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:11px;color:#65766d}.route-card-meta>span:last-child{display:flex;align-items:center;gap:4px}.route-entry{display:flex;align-items:center;justify-content:space-between;margin-top:15px;border-top:1px solid var(--line);padding-top:12px;color:var(--lake);font-size:10px}.museum-route-card:nth-child(even) .route-art{height:145px}.museum-route-card:nth-child(3n) .route-art{height:245px}
@media(max-width:760px){.museum-route-card{margin-bottom:12px;border-radius:9px}.route-art{height:170px}.museum-route-card:nth-child(3n + 2) .route-art{height:125px}.museum-route-card:nth-child(3n) .route-art{height:205px}.route-card-copy{padding:12px}.route-card-copy h3{font-size:19px}.route-card-copy p{font-size:11px;margin-bottom:13px}.route-tag{top:10px;left:10px;font-size:9px}.route-card-meta{font-size:10px}.route-stations{font-size:9px;letter-spacing:0}.route-art :deep(.artwork svg){transform:scale(1.6)}}
</style>
