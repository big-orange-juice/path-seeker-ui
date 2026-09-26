<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'
import { mapConfig } from '../config/map'
import { toAmapPosition } from '../domain/coordinates'
import { loadAmap, type AmapInstance, type AmapOverlay, type AmapSdk } from '../services/amap'
import type { CulturalPlace, Destination, TourRoute } from '../types'

const props = defineProps<{
  destination: Destination; places: CulturalPlace[]; route?: TourRoute | null; activePlaceId?: string
  showMarkerLabels?: boolean; maxFitZoom?: number
  /** journey 对应 C 端行程态：3D 视角、蓝色导航线并聚焦当前站点；admin 为管理端总览态。 */
  routeStyle?: 'admin' | 'journey'
  viewMode?: '2D' | '3D'; pitch?: number; zoom?: number; hideZoomControls?: boolean
}>()
const emit = defineEmits<{ selectPlace: [id: string]; editPlace: [id: string] }>()
const element = ref<HTMLElement | null>(null)
const error = ref('')
let sdk: AmapSdk | null = null
let map: AmapInstance | null = null
let overlays: AmapOverlay[] = []
let observer: ResizeObserver | null = null
let lastTap = { id: '', at: 0 }

function markerContent(index: number, active: boolean, label: string) {
  const number = props.showMarkerLabels ? String(index + 1).padStart(2, '0') : String(index + 1)
  const caption = props.showMarkerLabels ? `<span class="map-pin-label ${active ? 'is-active' : ''}">${label}</span>` : ''
  return `<span class="map-marker-wrap"><span class="map-pin ${active ? 'is-active' : ''}">${number}</span>${caption}</span>`
}

/** 单击选中站点，快速双击（触屏同样适用）打开站点内容编辑。 */
function handlePlaceTap(id: string) {
  const now = Date.now()
  const isDoubleTap = lastTap.id === id && now - lastTap.at < 380
  lastTap = { id, at: isDoubleTap ? 0 : now }
  if (isDoubleTap) { emit('editPlace', id); return }
  emit('selectPlace', id)
}

function renderLayers() {
  if (!map || !sdk) return
  map.remove(overlays)
  overlays = []
  const journey = props.routeStyle === 'journey'
  const routePlaceIds = props.route?.stops.map(stop => stop.placeId) ?? []
  const visible = props.route ? props.places.filter(place => routePlaceIds.includes(place.id)) : props.places
  if (props.route?.geometry.length) {
    overlays.push(new sdk.Polyline({
      path: props.route.geometry.map(toAmapPosition),
      strokeColor: journey ? '#08a9e6' : '#c58536',
      strokeWeight: journey ? 10 : 5,
      strokeOpacity: 1,
      strokeStyle: journey ? 'solid' : 'dashed',
      showDir: journey,
      outlineColor: '#ffffff', borderWeight: journey ? 3 : 1, isOutline: true,
      lineJoin: 'round', lineCap: 'round', zIndex: journey ? 280 : 50,
    }))
  }
  visible.forEach((place, index) => {
    const marker = new sdk!.Marker({
      position: toAmapPosition(place),
      content: markerContent(index, place.id === props.activePlaceId, place.name),
      offset: new sdk!.Pixel(-14, -14),
      zIndex: place.id === props.activePlaceId ? 200 : 100,
    })
    marker.on('click', () => handlePlaceTap(place.id))
    overlays.push(marker)
  })
  map.add(overlays)
  const focused = journey ? visible.find(place => place.id === props.activePlaceId) : undefined
  if (focused) {
    map.setZoomAndCenter(props.zoom ?? 17, toAmapPosition(focused), false)
    map.setPitch(props.pitch ?? 50, false)
    return
  }
  if (overlays.length) map.setFitView(overlays, true, [46, 46, 46, 46], props.maxFitZoom ?? 17)
  else map.setZoomAndCenter(props.zoom ?? mapConfig.zoom, toAmapPosition(props.destination))
}

function zoomBy(direction: number) {
  if (!map) return
  map.setZoom(map.getZoom() + direction)
}

/** 供父级（手机预览工具条）调用；地图未就绪时静默忽略。 */
defineExpose({ zoomBy, fit: () => renderLayers() })

onMounted(async () => {
  await nextTick()
  if (!element.value) return
  try {
    sdk = await loadAmap()
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : '高德地图加载失败'
    return
  }
  if (!element.value) return
  map = new sdk.Map(element.value, {
    center: toAmapPosition(props.destination), zoom: props.zoom ?? mapConfig.zoom,
    zooms: [mapConfig.minZoom, 20], viewMode: props.viewMode ?? '2D',
    pitch: props.pitch ?? 0, rotation: 0, showBuildingBlock: true,
    wallColor: '#cad6e2', roofColor: '#edf3f8', skyColor: '#a9d8f7', resizeEnable: true,
  })
  // C 端行程态隐藏 POI 文本，画面更接近 C 端导航视角。
  if (props.routeStyle === 'journey') map.setFeatures(['bg', 'road', 'building'])
  renderLayers()
  observer = new ResizeObserver(() => map?.resize())
  observer.observe(element.value)
})

watch(() => [props.route, props.places, props.activePlaceId], renderLayers, { deep: true })
onBeforeUnmount(() => { observer?.disconnect(); observer = null; map?.destroy(); map = null })
</script>

<template>
  <div class="map-canvas-wrap">
    <div ref="element" class="map-canvas" />
    <div v-if="!hideZoomControls" class="map-zoom"><button aria-label="放大地图" @click="zoomBy(1)"><Plus :size="14" /></button><button aria-label="缩小地图" @click="zoomBy(-1)"><Minus :size="14" /></button></div>
    <p v-if="error" class="map-canvas-error" role="status">{{ error }}<span>可复制 .env.example 为 .env.local 后重新启动。</span></p>
  </div>
</template>

<style scoped>
.map-canvas-wrap{position:relative;width:100%;height:100%}
.map-zoom{position:absolute;z-index:600;right:12px;bottom:12px;display:flex;flex-direction:column;overflow:hidden;border:1px solid #292d32;border-radius:8px;background:#101216e6}
.map-zoom button{display:grid;place-items:center;width:30px;height:30px;border:0;border-bottom:1px solid #292d32;background:transparent;color:#e9ecee}
.map-zoom button:last-child{border-bottom:0}
.map-canvas-error{position:absolute;z-index:600;left:50%;top:50%;transform:translate(-50%,-50%);margin:0;padding:14px 16px;border:1px solid #4a3c1f;border-radius:8px;background:#15181ce6;color:#e4bc61;font-size:11px;line-height:1.8;text-align:center;max-width:min(360px,84%)}
.map-canvas-error span{display:block;color:#8e969f;font-size:10px}
</style>
