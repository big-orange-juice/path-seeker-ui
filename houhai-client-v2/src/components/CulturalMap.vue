<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { ArrowUp, Focus, LocateFixed, Minus, Navigation, Plus, RotateCw, X } from 'lucide-vue-next'
import type { CulturalPlace, TourRoute } from '../types'
import type { MapInsets } from '../domain/mapViewport'
import { createAmap, type MapAdapter } from '../services/mapAdapter'
import { useLiveLocation } from '../composables/useLiveLocation'
import TourControls from './TourControls.vue'

const props = defineProps<{ places: CulturalPlace[]; selectedPlaceId: string; route?: TourRoute; insets?: MapInsets; immersive?: boolean }>()
const emit = defineEmits<{ select: [id: string]; tourModeChange: [enabled: boolean] }>()
const mapElement = useTemplateRef<HTMLDivElement>('mapElement')
const loading = shallowRef(true)
const error = shallowRef('')
const tourMode = shallowRef(false)
const liveLocation = useLiveLocation()
let adapter: MapAdapter | undefined
let observer: ResizeObserver | undefined
let generation = 0
let focusNextLocation = false

const routeStops = computed(() => props.route?.stopIds.flatMap(id => props.places.find(place => place.id === id) ?? []) ?? [])
const nextStop = computed(() => {
  const selectedIndex = routeStops.value.findIndex(place => place.id === props.selectedPlaceId)
  return routeStops.value[Math.min(Math.max(selectedIndex + 1, 0), routeStops.value.length - 1)]
})
const nextStopDistance = computed(() => {
  const target = nextStop.value?.coordinate
  const routeStart = props.route?.geometry[0]
  const liveCoordinate = liveLocation.location.value?.coordinate
  const origin = liveCoordinate && props.route?.geometry.some(point => coordinateDistance(liveCoordinate, point) <= 2000) ? liveCoordinate : routeStart
  if (!target || !origin) return null
  return Math.round(coordinateDistance(origin, target))
})
function coordinateDistance(origin: [number, number], target: [number, number]) {
  const latitudeDelta = (target[1] - origin[1]) * Math.PI / 180
  const longitudeDelta = (target[0] - origin[0]) * Math.PI / 180
  const startLatitude = origin[1] * Math.PI / 180
  const endLatitude = target[1] * Math.PI / 180
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}
const distanceLabel = computed(() => {
  if (nextStopDistance.value == null) return '距离计算中'
  return nextStopDistance.value >= 1000 ? `${(nextStopDistance.value / 1000).toFixed(1)} 公里` : `${nextStopDistance.value} 米`
})
const locationLabel = computed(() => {
  const coordinate = liveLocation.location.value?.coordinate
  return coordinate && props.route?.geometry.some(point => coordinateDistance(coordinate, point) <= 2000) ? '实时位置' : '路线预览'
})

function update() { adapter?.update({ places: props.places, selectedPlaceId: props.selectedPlaceId, route: props.route, insets: props.insets }) }

function locate() {
  if (adapter?.focusLocation()) return
  focusNextLocation = true
  liveLocation.start()
}

function toggleTourMode() {
  const next = !tourMode.value
  if (!adapter?.setTourMode(next)) return
  tourMode.value = next
  emit('tourModeChange', next)
  if (next && !liveLocation.location.value) liveLocation.start()
}

async function initialize() {
  const currentGeneration = ++generation
  adapter?.destroy()
  adapter = undefined
  tourMode.value = false
  emit('tourModeChange', false)
  if (!mapElement.value) return
  loading.value = true
  error.value = ''
  try {
    const instance = await createAmap(mapElement.value, id => emit('select', id))
    if (currentGeneration !== generation) { instance.destroy(); return }
    adapter = instance
    update()
    adapter.setLocation(liveLocation.location.value)
    adapter.fit()
  } catch (reason) {
    if (currentGeneration === generation) error.value = reason instanceof Error ? reason.message : '地图加载失败，请重试。'
  } finally {
    if (currentGeneration === generation) loading.value = false
  }
}

watch(() => [props.places, props.selectedPlaceId, props.route, props.insets], update)
watch(liveLocation.location, location => {
  adapter?.setLocation(location)
  if (location && focusNextLocation) {
    adapter?.focusLocation()
    focusNextLocation = false
  }
})
onMounted(() => {
  void initialize()
  observer = new ResizeObserver(() => {
    adapter?.resize()
    if (!tourMode.value) adapter?.fit()
  })
  if (mapElement.value) observer.observe(mapElement.value)
})
onUnmounted(() => { generation += 1; observer?.disconnect(); adapter?.destroy() })
</script>

<template>
  <section class="map-frame" :class="{ immersive, 'tour-mode': tourMode }" aria-label="后海文化地点地图">
    <div ref="mapElement" class="map-canvas" />
    <div class="map-caption"><span class="live-dot" />北京 · 什刹海 <span class="map-caption-divider">/</span> 后海文化漫游</div>
    <div v-if="loading" class="map-message" role="status">正在展开后海地图…</div>
    <div v-if="error" class="map-message map-error" role="alert">
      <p>{{ error }}</p>
      <button class="text-button" :disabled="loading" @click="initialize()"><RotateCw :size="14" />重新加载</button>
    </div>
    <aside v-if="tourMode" class="navigation-card" aria-live="polite">
      <div class="navigation-main">
        <ArrowUp :size="48" :stroke-width="2.8" />
        <div><small>{{ props.route?.title }}</small><strong>前往 {{ nextStop?.name ?? '下一站' }}</strong></div>
      </div>
      <div class="navigation-meta"><span>距下一站直线 {{ distanceLabel }}</span><span>{{ locationLabel }}</span></div>
    </aside>
    <TourControls v-if="tourMode" @zoom="adapter?.zoom($event)" @recenter="adapter?.focusLocation()" />
    <button
      v-if="route"
      type="button"
      class="tour-mode-button"
      :class="{ active: tourMode }"
      :aria-label="tourMode ? '退出游览模式' : '开启游览模式'"
      :aria-pressed="tourMode"
      :title="tourMode ? '退出游览模式' : '开启游览模式'"
      @click="toggleTourMode"
    >
      <X v-if="tourMode" :size="22" />
      <Navigation v-else :size="19" />
    </button>
    <div class="map-tools">
      <button aria-label="显示完整路线" title="显示完整路线" @click="adapter?.fit()"><Focus :size="19" /></button>
      <button :class="{ active: liveLocation.tracking.value }" :aria-label="liveLocation.tracking.value ? '回到当前位置' : '开启实时定位'" :aria-pressed="liveLocation.tracking.value" :title="liveLocation.tracking.value ? '回到当前位置' : '开启实时定位，每秒刷新'" :disabled="liveLocation.state.value === 'unsupported'" @click="locate"><LocateFixed :size="19" /></button>
      <button aria-label="放大地图" @click="adapter?.zoom(1)"><Plus :size="19" /></button>
      <button aria-label="缩小地图" @click="adapter?.zoom(-1)"><Minus :size="19" /></button>
    </div>
    <div v-if="liveLocation.tracking.value" class="location-status" role="status"><span /><strong>{{ liveLocation.state.value === 'requesting' ? '正在定位' : '实时定位中' }}</strong><small>{{ liveLocation.updatedLabel.value ? `${liveLocation.updatedLabel.value} 更新` : '每秒刷新' }}</small><button aria-label="停止实时定位" title="停止实时定位" @click="liveLocation.stop"><X :size="13" /></button></div>
    <div v-else-if="liveLocation.error.value" class="location-status location-error" role="alert"><strong>{{ liveLocation.error.value }}</strong><button v-if="liveLocation.state.value !== 'unsupported'" @click="liveLocation.start">重试</button></div>
    <div class="map-legend"><span class="route-line" :style="{ borderColor: route?.color }" />{{ route?.title ?? '文化地点' }}<small>策划路线示意</small></div>
    <span class="north-indicator" aria-hidden="true">N<br />↑</span>
  </section>
</template>

<style scoped>
.map-frame{position:relative;height:100%;min-height:480px;background:#dcebee;isolation:isolate;overflow:hidden;border-radius:20px}
.map-canvas{position:absolute;inset:0;z-index:0}
.map-caption{position:absolute;top:20px;left:20px;display:flex;align-items:center;gap:9px;padding:12px 16px;background:#ffffffed;border-radius:10px;box-shadow:0 3px 20px #193c4010;font-size:12px;font-weight:600;z-index:2}
.map-caption-divider{color:#b0b9b7;margin:0 2px}.live-dot{width:7px;height:7px;background:var(--lake);border-radius:50%}
.map-tools{position:absolute;right:18px;bottom:75px;display:grid;gap:1px;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px #193c401a;z-index:2}
.map-tools button{display:grid;place-items:center;width:40px;height:40px;background:white;border:0;color:var(--ink)}
.map-tools button:hover{background:var(--mist)}
.map-tools button.active{background:var(--lake);color:white}.location-status{position:absolute;right:68px;bottom:75px;z-index:2;display:flex;align-items:center;gap:7px;max-width:280px;padding:8px 10px;border:1px solid #d8e5de;border-radius:12px;background:#fcfdfcf2;color:var(--lake);box-shadow:0 4px 20px #193c401a;font-size:10px}.location-status>span{width:7px;height:7px;border-radius:50%;background:#2b91a2;box-shadow:0 0 0 4px #54a9b72e;animation:location-pulse 1.4s ease-out infinite}.location-status strong{font-size:10px}.location-status small{color:var(--muted);white-space:nowrap}.location-status button{display:grid;place-items:center;border:0;background:transparent;color:var(--lake);padding:3px}.location-error{max-width:320px;line-height:1.5}.location-error button{padding:4px 8px;border-radius:7px;background:#e5eee8;white-space:nowrap}@keyframes location-pulse{50%{box-shadow:0 0 0 7px #54a9b70d}}
.tour-mode-button{position:absolute;left:18px;top:42%;z-index:2;display:grid;place-items:center;width:42px;height:42px;padding:0;border:1px solid #d8e5de;border-radius:50%;background:#fffffff2;color:var(--lake);box-shadow:0 4px 20px #193c4024;backdrop-filter:blur(8px)}
.tour-mode-button:hover,.tour-mode-button:focus-visible{background:#edf4ef;outline:2px solid #ffffff;outline-offset:2px}.tour-mode-button.active{border-color:var(--lake);background:var(--lake);color:white}
.tour-mode .tour-mode-button{left:24px;top:auto;bottom:28px;width:54px;height:54px;border-color:#ffffff80;background:#ffffffeb;color:#132b31;box-shadow:0 8px 28px #102d3b30}
.navigation-card{position:absolute;top:18px;left:50%;z-index:4;width:min(520px,calc(100% - 36px));overflow:hidden;border-radius:24px;background:#101827;color:white;box-shadow:0 12px 38px #0b1b2b40;transform:translateX(-50%)}
.navigation-main{display:flex;align-items:center;gap:18px;padding:17px 22px 15px}.navigation-main svg{flex:0 0 auto}.navigation-main div{display:grid;gap:5px;min-width:0}.navigation-main small{color:#aeb8c7;font-size:12px}.navigation-main strong{overflow:hidden;font-size:22px;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}.navigation-meta{display:flex;justify-content:space-between;gap:16px;padding:10px 22px;background:#ffffff;color:#26333c;font-size:12px}.navigation-meta span:last-child{color:#7b8790}
.tour-mode .map-tools,.tour-mode .location-status{display:none}
.tour-recenter{position:absolute;right:18px;bottom:100px;z-index:3;width:52px;height:52px;display:grid;place-items:center;border:1px solid #ffffffb0;border-radius:50%;background:#f5fbffed;color:#2688d7;box-shadow:0 5px 24px #4278a32b}
.tour-mode .navigation-main{min-height:104px;padding:20px;gap:20px}.tour-mode .navigation-main svg{width:48px;height:58px}.tour-mode .navigation-main strong{font-size:24px;line-height:1.4}.tour-mode .navigation-main small{font-size:13px}.tour-mode .navigation-meta{padding:14px 18px;font-size:12px}
.map-legend{position:absolute;left:18px;bottom:30px;max-width:calc(100% - 85px);display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#fffffff2;padding:11px 13px;border-radius:10px;font-size:11px;z-index:2}
.map-legend small{color:var(--muted);font-size:10px}.route-line{width:25px;border-top:3px dashed var(--lake)}
.north-indicator{position:absolute;right:28px;top:22px;text-align:center;font:11px/1.6 monospace;color:var(--ink);z-index:2}
.map-message{position:absolute;left:18px;right:18px;top:80px;padding:15px;background:#fffffff5;border-radius:12px;z-index:3;font-size:13px;box-shadow:0 4px 20px #193c4015}
.map-message p{margin:0 0 8px}.map-error{border-left:3px solid var(--ochre)}
@media(max-width:760px){.map-frame{height:420px;min-height:420px;border-radius:16px}.map-caption{left:12px;top:12px;padding:10px;font-size:11px}.map-legend{left:12px;bottom:25px}.north-indicator{right:20px;top:13px}}
@media(max-width:760px){.tour-mode-button{left:12px;top:calc(var(--toolbar-height, 94px) + 126px);width:36px;height:36px}.tour-mode .tour-mode-button{left:18px;top:auto;bottom:22px;width:52px;height:52px}.navigation-card{top:12px;width:calc(100% - 24px);border-radius:20px}.navigation-main{gap:14px;padding:14px 16px 12px}.navigation-main svg{width:40px;height:40px}.navigation-main strong{font-size:18px}.navigation-meta{padding:9px 16px}}
@media(max-width:760px){.location-status{right:56px;bottom:auto;top:calc(var(--toolbar-height, 94px) + 24px);max-width:calc(100% - 74px)}}
@media(prefers-reduced-motion:reduce){.location-status>span{animation:none}}
</style>
