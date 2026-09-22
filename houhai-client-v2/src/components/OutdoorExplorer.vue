<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Headphones, Route } from 'lucide-vue-next'
import type { CulturalPlace, TourRoute } from '../types'
import { mapViewportInsets } from '../domain/mapViewport'
import { useMapSheet } from '../composables/useMapSheet'
import CulturalMap from './CulturalMap.vue'
import MapDiscoveryBar from './MapDiscoveryBar.vue'
import MapQuickActions from './MapQuickActions.vue'

const props = defineProps<{ places: CulturalPlace[]; routes: TourRoute[]; destinationName: string; selectedPlace?: CulturalPlace; route?: TourRoute; detailTab: 'place' | 'route' }>()
const emit = defineEmits<{ selectPlace: [id: string]; selectRoute: [id: string]; changeTab: [tab: 'place' | 'route']; ask: [] }>()
const catalogOpen = shallowRef(false)
const tourMode = shallowRef(false)
const sheetDocked = shallowRef(true)
const viewport = useTemplateRef<HTMLElement>('viewport')
const toolbar = useTemplateRef<HTMLDivElement>('toolbar')
const measurements = shallowRef({ width: 1000, height: 700, toolbar: 94 })
const { snap, height, settledHeight, expanded, dragging, setSnap, cycle, pointerDown, pointerMove, pointerUp, pointerCancel } = useMapSheet(() => measurements.value)
const insets = computed(() => mapViewportInsets(measurements.value.width, measurements.value.height, measurements.value.toolbar, sheetDocked.value ? 0 : settledHeight.value))
const title = computed(() => props.detailTab === 'route' ? props.destinationName : props.selectedPlace?.name)
const subtitle = computed(() => props.detailTab === 'route'
  ? `游览路线 · 共 ${props.routes.length} 条，选一程慢慢走`
  : `${props.selectedPlace?.category ?? ''} · ${props.selectedPlace?.guideNarrations?.length ?? 1} 位导游，听不同的故事`)
let observer: ResizeObserver | undefined

function open(tab: 'place' | 'route') {
  sheetDocked.value = false
  catalogOpen.value = tab === 'route'
  if (!expanded.value) setSnap('preview')
  emit('changeTab', tab)
}

function selectRoute(id: string) {
  sheetDocked.value = false
  catalogOpen.value = false
  if (!expanded.value) setSnap('preview')
  emit('selectRoute', id)
}

function selectPlace(id: string) {
  catalogOpen.value = false
  setSnap('collapsed')
  emit('selectPlace', id)
}

function dockSheet() {
  sheetDocked.value = true
  setSnap('collapsed')
}

function measure() {
  if (!viewport.value || !toolbar.value) return
  measurements.value = { width: viewport.value.clientWidth, height: viewport.value.clientHeight, toolbar: toolbar.value.offsetHeight }
}

watch(() => props.detailTab, tab => { if (tab === 'route' && !expanded.value) setSnap('preview') })
onMounted(() => {
  observer = new ResizeObserver(measure)
  for (const element of [viewport.value, toolbar.value]) if (element) observer.observe(element)
  measure()
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <main ref="viewport" class="outdoor-explorer" :class="{ expanded, 'sheet-full': snap === 'full', dragging, 'tour-mode': tourMode }" :style="{ '--toolbar-height': `${measurements.toolbar}px` }" aria-label="地图探索">
    <CulturalMap immersive :places="places" :selected-place-id="selectedPlace?.id ?? ''" :route="route" :insets="insets" @select="selectPlace" @tour-mode-change="tourMode = $event" />
    <div v-show="!tourMode" ref="toolbar" class="map-toolbar"><MapDiscoveryBar :places="places" :selected-place-id="selectedPlace?.id ?? ''" @select="selectPlace" /></div>
    <MapQuickActions v-show="!tourMode" @ask="emit('ask')" />
    <button v-if="sheetDocked && !tourMode" class="sheet-dock" type="button" :aria-label="`展开${title ?? '地点'}详情`" aria-controls="map-sheet" :aria-expanded="false" @click="sheetDocked = false">
      <Headphones :size="19" /><span>{{ title ?? '地点详情' }}</span><ChevronRight :size="16" />
    </button>
    <section v-show="!tourMode && !sheetDocked" id="map-sheet" class="map-sheet" :style="{ height: `${height}px` }" aria-label="地图浮动详情" @keydown.esc="dockSheet">
      <button class="sheet-handle" aria-label="拖动或点击调整详情高度" aria-controls="map-sheet-details" :aria-expanded="expanded" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerCancel" @lostpointercapture="pointerCancel" @click="cycle" @keydown.up.prevent="setSnap('full')" @keydown.down.prevent="setSnap('collapsed')"><span /></button>
      <header class="sheet-header">
        <div class="sheet-title"><h2>{{ title ?? '探索这里的故事' }}</h2><p>{{ subtitle }}</p></div>
        <button class="sheet-toggle" type="button" aria-label="收起到左侧" title="收起到左侧" aria-controls="map-sheet" @click="dockSheet"><ChevronLeft :size="19" /></button>
        <button class="sheet-toggle" :aria-label="expanded ? '收起详情，查看地图' : '展开地点详情'" :aria-expanded="expanded" aria-controls="map-sheet-details" @click="expanded ? setSnap('collapsed') : open(detailTab)"><ChevronDown v-if="expanded" :size="19" /><ChevronUp v-else :size="19" /></button>
      </header>
      <div v-if="!expanded" class="sheet-actions"><button @click="open('place')"><Headphones :size="15" />听这里的故事</button><button @click="open('route')"><Route :size="15" />游览路线</button></div>
      <div id="map-sheet-details" class="sheet-details" :inert="!expanded" :aria-hidden="!expanded">
        <slot :open-tab="open" :select-route="selectRoute" :catalog-open="catalogOpen" />
      </div>
    </section>
  </main>
</template>

<style scoped>
.outdoor-explorer{position:relative;flex:1;min-height:0;isolation:isolate;overflow:hidden;background:var(--mist)}
.outdoor-explorer.tour-mode{position:fixed;inset:0;z-index:1000;background:#dcebee}
.outdoor-explorer>:deep(.map-frame){position:absolute;inset:0;height:100%;min-height:0;border-radius:0}
.map-toolbar{position:absolute;top:22px;left:24px;width:380px;max-width:calc(100% - 48px);z-index:4;transition:opacity .2s,visibility .2s}
.map-sheet{position:absolute;left:24px;bottom:24px;width:380px;max-width:calc(100% - 48px);z-index:5;display:flex;flex-direction:column;background:#fcfdfc;border:1px solid #ffffffd9;border-radius:24px;box-shadow:0 8px 35px #183e4324;overflow:hidden;transition:height .28s cubic-bezier(.22,.8,.25,1)}
.dragging .map-sheet{transition:none}
.sheet-dock{position:absolute;left:12px;bottom:28px;z-index:5;display:flex;align-items:center;gap:8px;max-width:calc(100% - 88px);min-height:46px;padding:10px 12px;border:1px solid #dce6df;border-radius:16px;background:#fcfdfcf5;color:var(--lake);box-shadow:0 4px 18px #183e4324}
.sheet-dock span{max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600}
.sheet-handle{height:23px;min-height:23px;display:grid;place-items:center;width:100%;border:0;padding:0;background:transparent;touch-action:none;cursor:ns-resize}
.sheet-handle span{width:34px;height:4px;border-radius:8px;background:#ccd7cf;transition:width .2s,background .2s}
.sheet-handle:hover span,.sheet-handle:focus-visible span{width:46px;background:#879f91}
.sheet-header{display:flex;align-items:center;gap:12px;padding:0 18px 10px;flex-shrink:0}
.sheet-title{min-width:0;flex:1}.sheet-title h2{font:600 21px/1.3 var(--display);margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sheet-title p{font-size:10px;color:#75857b;margin:6px 0 0}
.sheet-toggle{display:grid;place-items:center;border:0;border-radius:50%;width:31px;height:31px;background:#eef3ef;color:var(--lake);flex-shrink:0}
.sheet-actions{display:flex;gap:9px;padding:0 16px 12px;flex-shrink:0}
.sheet-actions button{display:flex;align-items:center;justify-content:center;gap:7px;flex:1;padding:9px 6px;border:1px solid #dce6df;background:white;color:var(--lake);border-radius:12px;font-size:11px}
.sheet-actions button:first-child{background:var(--lake);border-color:var(--lake);color:white}
.sheet-details{min-height:0;flex:1;overflow:hidden;visibility:hidden;opacity:0;transition:opacity .18s}
.expanded .sheet-details{visibility:visible;opacity:1}
.sheet-details :deep(.detail-panel){height:100%;min-height:0;border:0;border-radius:0;background:transparent}
.outdoor-explorer :deep(.map-caption),.outdoor-explorer :deep(.map-legend),.outdoor-explorer :deep(.north-indicator){display:none}
.outdoor-explorer :deep(.map-tools){right:24px;bottom:147px}
.outdoor-explorer :deep(.map-message){left:auto;right:24px;top:22px;max-width:min(340px,calc(100% - 48px))}
.tour-mode :deep(.map-message){display:none}
@media(max-width:760px){
  .map-toolbar{top:12px;left:12px;max-width:none;width:calc(100% - 24px)}
  .map-sheet{left:8px;bottom:24px;width:calc(100% - 76px);max-width:none;border-radius:20px}
  .sheet-header{gap:6px;padding-right:10px;padding-left:12px}
  .sheet-title h2{font-size:18px}
  .sheet-title p{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sheet-actions{gap:6px;padding-right:10px;padding-left:10px}
  .sheet-actions button{font-size:10px;gap:4px}
  .outdoor-explorer :deep(.map-quick-actions){right:12px;top:auto;bottom:28px}
  .sheet-full .map-toolbar{opacity:0;visibility:hidden;pointer-events:none}
  .outdoor-explorer :deep(.map-tools){right:12px;top:calc(var(--toolbar-height) + 24px);bottom:auto}
  .outdoor-explorer :deep(.map-tools button){width:36px;height:36px}
  .outdoor-explorer :deep(.map-message){top:calc(var(--toolbar-height) + 24px);left:12px;right:60px;max-width:none;font-size:11px}
  .sheet-details :deep(.detail-content){overflow:auto}
}
@media(prefers-reduced-motion:reduce){.map-sheet,.map-toolbar,.sheet-details,.sheet-handle span{transition:none}}
</style>
