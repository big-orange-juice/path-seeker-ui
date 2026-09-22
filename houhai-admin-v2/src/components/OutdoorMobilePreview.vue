<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { Bike, Bookmark, ChevronDown, ChevronUp, Compass, Focus, Footprints, Headphones, Landmark, LocateFixed, MapPin, MessageCircle, Minus, Music2, Pause, Play, Plus, Route, Search, SlidersHorizontal } from 'lucide-vue-next'
import type { CulturalPlace, Destination, TourRoute } from '../types'
import MapCanvas from './MapCanvas.vue'

type SheetView = 'collapsed' | 'story' | 'route'
const props = defineProps<{ route: TourRoute; destination: Destination; places: CulturalPlace[]; activeStopId: string }>()
const emit = defineEmits<{ selectStop: [id: string] }>()
const sheetView = shallowRef<SheetView>('collapsed')
const selectedNarrationId = shallowRef('')
const isPlaying = shallowRef(false)
const query = shallowRef('')
const routePlaces = computed(() => props.route.stops.flatMap((stop) => {
  const place = props.places.find((item) => item.id === stop.placeId)
  return place ? [{ stop, place }] : []
}))
const visiblePlaces = computed(() => {
  const keyword = query.value.trim()
  return keyword ? routePlaces.value.filter(({ place }) => `${place.name}${place.category}${place.address}`.includes(keyword)) : routePlaces.value
})
const activeEntry = computed(() => routePlaces.value.find((item) => item.stop.id === props.activeStopId) ?? routePlaces.value[0] ?? null)
const activeNarration = computed(() => activeEntry.value?.place.narrations.find((item) => item.id === selectedNarrationId.value) ?? activeEntry.value?.place.narrations[0] ?? null)
const activePlaceId = computed(() => activeEntry.value?.place.id)

watch(activeEntry, (entry) => {
  selectedNarrationId.value = entry?.place.narrations[0]?.id ?? ''
  isPlaying.value = false
}, { immediate: true })

function selectPlace(placeId: string) {
  const stopId = props.route.stops.find((stop) => stop.placeId === placeId)?.id
  if (stopId) emit('selectStop', stopId)
}
function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
</script>

<template>
  <section class="outdoor-phone" aria-label="移动端路线预览">
    <div class="phone-screen-map">
      <div class="phone-status"><strong>9:41</strong><span>▮▮▮</span></div><div class="phone-island" />
      <header class="client-header">
        <div class="client-brand"><span>径</span><div><strong>秘径寻踪</strong><small>PATH SEEKER</small></div></div>
        <button class="destination-button"><MapPin :size="12" /><span><small>当前探索地</small><strong>{{ destination.name.replace('北京·', '北京 · ') }}</strong></span><ChevronDown :size="12" /></button>
        <nav class="scene-switch"><button class="active"><Bike :size="14" />黄包车慢游<i>新</i></button><button><Landmark :size="13" />场馆探索</button></nav>
      </header>
      <main class="client-map">
        <MapCanvas show-marker-labels :destination="destination" :places="places" :route="route" :active-place-id="activePlaceId" @select-place="selectPlace" />
        <div class="discovery-tools">
          <label><Search :size="15" /><input v-model="query" aria-label="搜索文化地点" placeholder="寻找一处风景、一段故事" /></label><button aria-label="地点分类筛选"><SlidersHorizontal :size="16" /></button>
          <div class="place-chips"><button v-for="entry in visiblePlaces" :key="entry.stop.id" :class="{ active: entry.stop.id === activeEntry?.stop.id }" @click="emit('selectStop', entry.stop.id)"><MapPin v-if="entry.stop.id === activeEntry?.stop.id" :size="10" />{{ entry.place.name }}</button></div>
        </div>
        <div class="map-controls"><button aria-label="显示完整路线"><Focus :size="15" /></button><button aria-label="开启实时定位"><LocateFixed :size="15" /></button><button aria-label="放大地图"><Plus :size="15" /></button><button aria-label="缩小地图"><Minus :size="15" /></button></div>
        <div class="quick-actions"><button :class="{ playing: isPlaying }" :aria-label="isPlaying ? '暂停当前讲解' : '播放当前讲解'" @click="isPlaying = !isPlaying"><Music2 :size="16" /></button><button aria-label="打开聊天对话框"><MessageCircle :size="16" /></button></div>
        <section v-if="activeEntry" :class="['client-sheet', { expanded: sheetView !== 'collapsed' }]">
          <button class="sheet-handle" aria-label="调整详情高度" @click="sheetView = sheetView === 'collapsed' ? 'story' : 'collapsed'"><span /></button>
          <div class="sheet-heading"><div><h3>{{ activeEntry.place.name }}</h3><p>{{ activeEntry.place.category }} · {{ activeEntry.place.narrations.length }} 位导游，听不同的故事</p></div><button @click="sheetView = sheetView === 'collapsed' ? 'story' : 'collapsed'"><ChevronDown v-if="sheetView !== 'collapsed'" :size="16" /><ChevronUp v-else :size="16" /></button></div>
          <div v-if="sheetView === 'collapsed'" class="sheet-actions"><button @click="sheetView = 'story'"><Headphones :size="14" />听这里的故事</button><button @click="sheetView = 'route'"><Route :size="14" />游览路线</button></div>
          <div v-else-if="sheetView === 'story'" class="story-panel">
            <div class="guide-options"><button v-for="narration in activeEntry.place.narrations" :key="narration.id" :class="{ active: narration.id === activeNarration?.id }" @click="selectedNarrationId = narration.id; isPlaying = false"><span>{{ narration.guideName.slice(0, 1) }}</span><div><strong>{{ narration.guideName }}</strong><small>{{ narration.guideStyle }}</small></div></button></div>
            <div v-if="activeNarration" class="audio-card"><button @click="isPlaying = !isPlaying"><Pause v-if="isPlaying" :size="15" fill="currentColor" /><Play v-else :size="15" fill="currentColor" /></button><div><small>{{ isPlaying ? '正在讲解' : '点击播放讲解' }}</small><strong>{{ activeNarration.title }}</strong></div><span>{{ formatDuration(activeNarration.durationSeconds) }}</span></div><p class="story-script">{{ activeNarration?.script }}</p>
          </div>
          <div v-else class="route-panel"><div class="route-summary"><strong>{{ route.name }}</strong><span>{{ route.distanceKm }} km · {{ route.estimatedMinutes }} 分钟</span></div><button v-for="(entry, index) in routePlaces" :key="entry.stop.id" :class="{ active: entry.stop.id === activeEntry.stop.id }" @click="emit('selectStop', entry.stop.id)"><span>{{ index + 1 }}</span><div><strong>{{ entry.place.name }}</strong><small>{{ entry.stop.arrivalNote }}</small></div></button></div>
        </section>
      </main>
      <footer class="client-footer"><button class="active"><Compass :size="15" /><span>发现</span></button><button><Bookmark :size="14" /><span>我的收藏</span></button><button><Footprints :size="15" /><span>我的足迹</span></button><button><MessageCircle :size="15" /><span>问</span></button></footer>
    </div>
  </section>
</template>

<style scoped>
.outdoor-phone{height:100%;min-height:0;border:1px solid #373b41;border-radius:34px;background:#20242a;padding:8px;box-shadow:inset 0 0 0 2px #090b0d,0 16px 38px #0006;overflow:hidden}.phone-screen-map{height:100%;position:relative;border-radius:27px;background:#f8faf9;color:#2b4039;overflow:hidden;display:flex;flex-direction:column}.phone-status{position:absolute;z-index:900;top:10px;left:17px;right:16px;display:flex;justify-content:space-between;color:#263b35;font-size:8px}.phone-island{position:absolute;z-index:901;top:7px;left:50%;width:72px;height:18px;transform:translateX(-50%);border-radius:12px;background:#080909}
.client-header{height:105px;flex:none;padding:29px 11px 7px;display:grid;grid-template-columns:1fr auto;gap:7px 8px;background:#f8faf9;border-bottom:1px solid #e5eae7}.client-brand{display:flex;align-items:center;gap:7px;min-width:0}.client-brand>span{width:28px;height:29px;display:grid;place-items:center;border-radius:9px 3px;background:#183e43;color:#fff;font-family:Georgia,serif;font-size:17px}.client-brand strong,.client-brand small{display:block}.client-brand strong{font-family:Georgia,'Noto Serif SC',serif;font-size:12px;letter-spacing:2px;white-space:nowrap}.client-brand small{font-size:5px;letter-spacing:2px;margin-top:2px}.destination-button{height:34px;display:flex;align-items:center;gap:4px;border:0;border-radius:8px;background:#edf2ef;color:#27433b;padding:4px 7px}.destination-button span{text-align:left}.destination-button small,.destination-button strong{display:block;white-space:nowrap}.destination-button small{font-size:5px;color:#89978e}.destination-button strong{font-size:7px;margin-top:1px}.scene-switch{grid-column:1/-1;height:34px;display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px;border-radius:9px;background:#e9efec}.scene-switch button{border:0;border-radius:7px;background:transparent;color:#7b8a80;display:flex;align-items:center;justify-content:center;gap:5px;font-size:8px}.scene-switch button.active{background:#fff;color:#183e43;font-weight:700;box-shadow:0 1px 6px #183e4310}.scene-switch i{padding:1px 3px;border-radius:2px;background:#e5b957;color:#513f18;font-size:5px;font-style:normal}
.client-map{position:relative;flex:1;min-height:0;overflow:hidden}.client-map :deep(.map-canvas){position:absolute;inset:0}.client-map :deep(.leaflet-control-attribution){font-size:5px!important}.client-map :deep(.leaflet-control-container){display:none}.client-map :deep(.map-marker-wrap){position:relative;display:flex;justify-content:center}.client-map :deep(.map-pin){width:26px;height:26px;border-width:2px;background:#183e43;font-size:7px}.client-map :deep(.map-pin.is-active){background:#e5b957;color:#493f24;transform:scale(1.08)}.client-map :deep(.map-pin-label){position:absolute;top:29px;left:50%;transform:translateX(-50%);padding:4px 6px;border:1px solid #dce5de;border-radius:4px;background:#ffffffed;color:#355149;font-size:7px;font-weight:600;white-space:nowrap;box-shadow:0 2px 7px #183e4315}.client-map :deep(.map-pin-label.is-active){background:#183e43;color:#fff;border-color:#183e43}
.discovery-tools{position:absolute;z-index:700;top:8px;left:10px;right:10px;display:grid;grid-template-columns:1fr 35px;gap:6px}.discovery-tools>label{height:35px;display:flex;align-items:center;gap:7px;padding:0 10px;border:1px solid #fff;border-radius:10px;background:#fffffff4;color:#65796e;box-shadow:0 3px 14px #183e4318}.discovery-tools input{min-width:0;width:100%;border:0;outline:0;background:transparent;color:#2b4039;font-size:8px}.discovery-tools>button{border:1px solid #fff;border-radius:10px;background:#fffffff4;color:#183e43;display:grid;place-items:center}.place-chips{grid-column:1/-1;display:flex;gap:5px;overflow:hidden}.place-chips button{flex:none;display:flex;align-items:center;gap:3px;border:1px solid #fff;border-radius:14px;background:#fffffff2;color:#2b4039;padding:6px 8px;font-size:7px;box-shadow:0 2px 8px #183e4312}.place-chips button.active{background:#183e43;color:#fff;border-color:#183e43}.map-controls{position:absolute;z-index:700;right:10px;top:103px;display:flex;flex-direction:column;border-radius:9px;overflow:hidden;box-shadow:0 3px 14px #183e4320}.map-controls button{width:30px;height:30px;border:0;border-bottom:1px solid #edf0ee;background:#fffffff4;color:#40564f;display:grid;place-items:center}.quick-actions{position:absolute;z-index:700;right:10px;top:232px;display:grid;gap:6px}.quick-actions button{width:31px;height:31px;border:1px solid #dce6df;border-radius:50%;background:#fcfdfcf4;color:#183e43;display:grid;place-items:center;box-shadow:0 3px 12px #183e4320}.quick-actions button.playing{background:#183e43;color:#fff}
.client-sheet{position:absolute;z-index:710;left:8px;right:8px;bottom:9px;height:111px;border:1px solid #ffffffd9;border-radius:18px;background:#fcfdfc;box-shadow:0 7px 27px #183e4328;overflow:hidden;transition:height .24s ease}.client-sheet.expanded{height:56%}.sheet-handle{height:18px;width:100%;border:0;background:transparent;display:grid;place-items:center}.sheet-handle span{width:29px;height:3px;border-radius:3px;background:#ccd7cf}.sheet-heading{display:flex;align-items:center;gap:8px;padding:0 12px 7px}.sheet-heading>div{flex:1;min-width:0}.sheet-heading h3{margin:0;font-family:Georgia,'Noto Serif SC',serif;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sheet-heading p{margin:3px 0 0;color:#75857b;font-size:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sheet-heading>button{width:26px;height:26px;border:0;border-radius:50%;display:grid;place-items:center;background:#eef3ef;color:#183e43}.sheet-actions{display:flex;gap:6px;padding:0 10px}.sheet-actions button{height:29px;flex:1;display:flex;align-items:center;justify-content:center;gap:5px;border:1px solid #dce6df;border-radius:9px;background:#fff;color:#183e43;font-size:7px}.sheet-actions button:first-child{background:#183e43;color:#fff;border-color:#183e43}
.story-panel,.route-panel{padding:1px 11px 10px;overflow:auto;height:calc(100% - 61px)}.guide-options{display:flex;gap:5px;overflow-x:auto;padding-bottom:5px}.guide-options button{flex:none;display:flex;align-items:center;gap:5px;border:1px solid #dce3de;border-radius:7px;background:#fff;padding:5px 7px;color:#2b4039}.guide-options button>span{width:21px;height:21px;border-radius:50%;display:grid;place-items:center;background:#e6efea;color:#285b52;font-size:7px}.guide-options strong,.guide-options small{display:block}.guide-options strong{font-size:7px}.guide-options small{font-size:5px;color:#86928a}.guide-options button.active{border-color:#c88c3c;background:#fff8eb}.audio-card{display:grid;grid-template-columns:29px 1fr auto;gap:6px;align-items:center;margin-top:4px;padding:7px;border-radius:8px;background:#183e43;color:#fff}.audio-card>button{width:29px;height:29px;border:0;border-radius:50%;display:grid;place-items:center;background:#e5b957;color:#26372f}.audio-card small,.audio-card strong{display:block}.audio-card small{font-size:5px;color:#aac0b8}.audio-card strong{font-size:7px;margin-top:2px}.audio-card>span{font-size:6px}.story-script{font-size:7px;line-height:1.55;color:#65756d}.route-summary{display:flex;justify-content:space-between;padding:0 2px 5px}.route-summary strong{font-size:8px}.route-summary span{font-size:6px;color:#7b8a80}.route-panel>button{width:100%;display:grid;grid-template-columns:19px 1fr;gap:6px;align-items:center;border:0;border-top:1px solid #e7ebe8;background:transparent;padding:6px 2px;color:#344a42;text-align:left}.route-panel>button>span{width:17px;height:17px;border-radius:50%;display:grid;place-items:center;background:#e6ebe7;font-size:6px}.route-panel>button strong,.route-panel>button small{display:block}.route-panel>button strong{font-size:7px}.route-panel>button small{font-size:6px;color:#87938c;margin-top:2px}.route-panel>button.active>span{background:#e5b957;color:#4b3e1e}
.client-footer{height:51px;flex:none;display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #e5eae7;background:#f8faf9}.client-footer button{position:relative;border:0;background:transparent;color:#8c998f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:6px}.client-footer button.active{color:#183e43;font-weight:700}.client-footer button.active::before{content:'';position:absolute;top:0;left:16px;right:16px;height:2px;background:#183e43}
</style>
