<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'
import { ArrowLeft, ChevronRight } from 'lucide-vue-next'
import type { CulturalPlace, Journey, TourRoute } from '../types'
import PlaceDetail from './PlaceDetail.vue'
import RouteDetail from './RouteDetail.vue'
import OutdoorRouteCatalog from './OutdoorRouteCatalog.vue'

const props = defineProps<{ tab: 'place' | 'route'; place?: CulturalPlace; route?: TourRoute; relatedRoutes: TourRoute[]; stops: CulturalPlace[]; journey?: Journey; favorite: boolean; compact?: boolean; catalogOpen?: boolean; allRoutes?: TourRoute[]; allPlaces?: CulturalPlace[] }>()
const emit = defineEmits<{ changeTab: [tab: 'place' | 'route']; selectPlace: [id: string]; selectRoute: [id: string]; favorite: [id: string]; start: []; complete: [] }>()
const content = useTemplateRef<HTMLDivElement>('content')
watch(() => [props.tab, props.place?.id, props.route?.id, props.catalogOpen], async () => {
  await nextTick()
  content.value?.scrollTo({ top: 0 })
})
</script>

<template>
  <aside class="detail-panel" :class="{ 'compact-panel': compact }" aria-label="地点与路线详情">
    <nav class="detail-tabs" aria-label="详情切换"><button :class="{ active: tab === 'place' }" :aria-pressed="tab === 'place'" @click="emit('changeTab', 'place')">{{ place?.scene === 'museum' ? '展品故事' : '地点故事' }}</button><button :class="{ active: tab === 'route' }" :aria-pressed="tab === 'route'" @click="emit('changeTab', 'route')">游览路线<span v-if="journey" class="journey-dot" /></button></nav>
    <nav v-if="compact && tab === 'route'" class="route-levels" aria-label="游览路线层级">
      <span v-if="catalogOpen" class="catalog-root" aria-current="page">全部路线 <small>{{ allRoutes?.length ?? 0 }} 条</small></span>
      <template v-else><button @click="emit('changeTab', 'route')"><ArrowLeft :size="13" />全部路线</button><ChevronRight :size="12" /><span class="current-route" aria-current="page">{{ route?.title ?? '路线详情' }}</span></template>
    </nav>
    <div ref="content" class="detail-content">
      <OutdoorRouteCatalog v-if="compact && tab === 'route' && catalogOpen" :routes="allRoutes ?? []" :places="allPlaces ?? []" :selected-route-id="route?.id" @select="emit('selectRoute', $event)" />
      <PlaceDetail v-else-if="tab === 'place' && place" :key="place.id" :place="place" :routes="relatedRoutes" :favorite="favorite" :compact="compact" @favorite="emit('favorite', $event)" @select-route="emit('selectRoute', $event)" />
      <RouteDetail v-else-if="route" :route="route" :stops="stops" :journey="journey" :selected-place-id="place?.id ?? ''" @select-place="emit('selectPlace', $event)" @start="emit('start')" @complete="emit('complete')" />
    </div>
  </aside>
</template>

<style scoped>
.detail-panel{background:white;border:1px solid var(--line);border-radius:17px;overflow:hidden;display:flex;flex-direction:column;min-height:0}.detail-tabs{display:flex;gap:23px;padding:0 20px;border-bottom:1px solid var(--line);min-height:54px;flex-shrink:0}.detail-tabs button{position:relative;border:0;background:none;font-size:12px;color:var(--muted);padding:16px 0}.detail-tabs .active{color:var(--lake);font-weight:700}.detail-tabs .active::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--lake)}.detail-content{overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#dbe3dc transparent;min-height:0}.journey-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--ochre);margin-left:6px;vertical-align:middle}
@media(max-width:760px){.detail-panel{border-radius:15px}.detail-content{overflow:visible}.detail-tabs{min-height:50px;justify-content:space-around;gap:15px}.detail-tabs button{flex:1}}
.compact-panel .detail-tabs{min-height:0;margin:0 16px 10px;padding:3px;gap:3px;background:#edf2ee;border:0;border-radius:11px}.compact-panel .detail-tabs button{flex:1;padding:8px 6px;font-size:11px;border-radius:8px;line-height:1.4}.compact-panel .detail-tabs button.active{background:#fcfdfc;box-shadow:0 1px 4px #183e430c}.compact-panel .detail-tabs .active::after{display:none}.compact-panel .detail-content{scrollbar-width:none;scroll-behavior:smooth}
.route-levels{display:flex;align-items:center;gap:8px;margin:0 18px 12px;min-height:28px;flex-shrink:0;color:var(--muted);font-size:11px}.route-levels button{display:flex;align-items:center;gap:5px;flex-shrink:0;border:0;background:none;color:var(--lake);padding:5px 0;font-size:11px}.route-levels>svg{flex-shrink:0}.catalog-root{display:flex;align-items:center;gap:8px;color:var(--lake);font-weight:600}.catalog-root small{font-size:10px;font-weight:400;color:var(--muted)}.current-route{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(prefers-reduced-motion:reduce){.compact-panel .detail-content{scroll-behavior:auto}}
</style>
