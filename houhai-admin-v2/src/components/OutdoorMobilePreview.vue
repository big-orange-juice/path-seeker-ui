<script setup lang="ts">
import { computed, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { ArrowLeft, ChevronLeft, ChevronRight, Focus, Headphones, Landmark, MapPin, MessageCircle, Minus, Navigation, Pause, Play, Plus, Video, X } from 'lucide-vue-next'
import type { ArtifactStage, CulturalPlace, Destination, TourRoute } from '../types'
import MapCanvas from './MapCanvas.vue'

const props = defineProps<{ route: TourRoute; destination: Destination; places: CulturalPlace[]; stages: ArtifactStage[]; activeStopId: string }>()
const emit = defineEmits<{ selectStop: [id: string]; editStop: [id: string] }>()
const phoneMap = useTemplateRef<InstanceType<typeof MapCanvas>>('phoneMap')
/** 与 C 端一致：默认收起讲解面板，先看地图与讲解悬浮条；点“查看内容”再展开。 */
const storyOpen = shallowRef(false)
const chapterIndex = shallowRef(0)
const elapsed = shallowRef(0)
const playing = shallowRef(false)
const finished = shallowRef(false)
const expanded = shallowRef(false)
let timer: ReturnType<typeof setInterval> | undefined

const routeStops = computed(() => props.route.stops.flatMap(stop => {
  const place = props.places.find(item => item.id === stop.placeId)
  return place ? [{ stop, place }] : []
}))
const stopIndex = computed(() => Math.max(0, props.route.stops.findIndex(item => item.id === props.activeStopId)))
const activeStop = computed(() => props.route.stops[stopIndex.value] ?? null)
const activeEntry = computed(() => routeStops.value.find(item => item.stop.id === activeStop.value?.id) ?? routeStops.value[0] ?? null)
const activeStage = computed(() => props.stages.find(item => item.placeId === activeEntry.value?.place.id) ?? null)
const nextPlace = computed(() => props.places.find(item => item.id === props.route.stops[stopIndex.value + 1]?.placeId) ?? null)
const segment = computed(() => activeStage.value?.segments[chapterIndex.value] ?? null)
const segmentSeconds = computed(() => segment.value?.durationSeconds ?? 0)
const cover = computed(() => activeStage.value?.images[0] ?? null)
const isLastSegment = computed(() => chapterIndex.value >= (activeStage.value?.segments.length ?? 1) - 1)
const playLabel = computed(() => playing.value ? '暂停讲解' : elapsed.value > 0 ? '继续讲解' : '播放讲解')
const playbackNote = computed(() => {
  if (playing.value) return ''
  if (elapsed.value > 0) return '已暂停，点击继续后恢复讲解'
  if (finished.value && !nextPlace.value) return '这一程的故事已讲完，感谢同行。'
  return '留意沿途风景，到下一站附近继续讲解。'
})

watch(() => activeStage.value?.id, () => { chapterIndex.value = 0; elapsed.value = 0; playing.value = false; finished.value = false; expanded.value = false; syncTimer() })
onUnmounted(() => clearInterval(timer))

function syncTimer() {
  clearInterval(timer)
  if (!playing.value) return
  timer = setInterval(() => {
    elapsed.value += 1
    if (elapsed.value < segmentSeconds.value) return
    elapsed.value = 0
    if (!isLastSegment.value) { chapterIndex.value += 1; return }
    playing.value = false
    finished.value = true
    syncTimer()
  }, 1000)
}
function togglePlay() {
  if (!segmentSeconds.value) return
  playing.value = !playing.value
  if (playing.value) finished.value = false
  syncTimer()
}
function pickStop(stopId: string) {
  emit('selectStop', stopId)
}
/** 站点名称跟随站点语言内容。 */
function stopName(placeId: string) {
  return props.stages.find(item => item.placeId === placeId)?.name ?? props.places.find(item => item.id === placeId)?.name ?? ''
}
function selectPlace(placeId: string) {
  const stop = props.route.stops.find(item => item.placeId === placeId)
  if (stop) pickStop(stop.id)
}
function editPlace(placeId: string) {
  const stop = props.route.stops.find(item => item.placeId === placeId)
  if (!stop) return
  emit('selectStop', stop.id)
  emit('editStop', stop.id)
}
</script>

<template>
  <section class="outdoor-phone" aria-label="移动端路线预览">
    <div class="phone-screen-map">
      <div class="phone-status"><strong>9:41</strong><span>▮▮▮</span></div><div class="phone-island" />
      <header class="client-head">
        <button class="head-button"><ArrowLeft :size="14" />返回地图</button>
        <span class="head-route">{{ route.name }}</span>
        <button class="head-button end">结束行程</button>
      </header>
      <main class="client-journey">
        <div class="journey-stage">
          <MapCanvas ref="phoneMap" show-marker-labels route-style="journey" view-mode="3D" :pitch="50" :zoom="17" hide-zoom-controls :destination="destination" :places="places" :route="route" :active-place-id="activeEntry?.place.id" :max-fit-zoom="16" @select-place="selectPlace" @edit-place="editPlace" />
          <nav class="journey-toolbar" aria-label="路线工具">
            <button aria-label="缩小地图" @click="phoneMap?.zoomBy(-1)"><Minus :size="15" /></button>
            <button aria-label="路线全览" @click="phoneMap?.fit()"><Focus :size="15" /></button>
            <button disabled aria-label="跟随视角"><Navigation :size="15" /></button>
            <button aria-label="放大地图" @click="phoneMap?.zoomBy(1)"><Plus :size="15" /></button>
            <span class="toolbar-divider" aria-hidden="true" />
            <button disabled aria-label="问一问"><MessageCircle :size="16" /></button>
          </nav>
          <div class="story-dock">
            <button type="button" class="dock-play" :aria-label="playLabel" @click="togglePlay"><Pause v-if="playing" :size="15" fill="currentColor" /><Play v-else :size="15" fill="currentColor" /></button>
            <button type="button" class="dock-open" aria-controls="preview-story" :aria-expanded="storyOpen" @click="storyOpen = !storyOpen">
              <span class="dock-heading"><Headphones :size="11" /><small>{{ storyOpen ? '正在查看' : '查看内容' }}</small></span>
              <span class="dock-line"><strong>{{ activeStage?.name ?? activeEntry?.place.name }}</strong><span>{{ stopIndex + 1 }} / {{ route.stops.length }}</span></span>
              <ChevronLeft v-if="storyOpen" :size="14" /><ChevronRight v-else :size="14" />
            </button>
          </div>
          <aside id="preview-story" class="story-panel" :class="{ open: storyOpen }" aria-label="此刻，听这里">
            <header class="story-head">
              <div class="story-head-main"><span class="story-eyebrow"><Headphones :size="14" />此刻，听这里</span><button type="button" class="story-close" aria-label="收起内容，看看路线" @click="storyOpen = false"><X :size="16" /></button></div>
              <nav class="story-stops" aria-label="途经点"><button v-for="(item, index) in routeStops" :key="item.stop.id" type="button" :class="{ active: item.stop.id === activeStop?.id }" @click="pickStop(item.stop.id)"><span>{{ index + 1 }}</span>{{ stopName(item.place.id) }}</button></nav>
            </header>
            <div class="story-body">
              <figure class="story-photo">
                <img v-if="cover" :src="cover.url" :alt="cover.caption" />
                <div v-else class="story-artwork"><Landmark :size="42" :stroke-width="1" /></div>
                <div class="photo-shade" />
                <figcaption><span>{{ activeStage?.guideStyle ?? '讲解导览' }}</span><h2>{{ activeStage?.name ?? activeEntry?.place.name }}</h2></figcaption>
                <span v-if="cover" class="photo-credit">{{ cover.caption }}</span>
              </figure>
              <button type="button" class="story-play" :aria-label="playLabel" @click="togglePlay"><Pause v-if="playing" :size="14" fill="currentColor" /><Play v-else :size="14" fill="currentColor" /><span>{{ playLabel }}</span></button>
              <p class="story-text" :class="{ expanded }">{{ segment?.text ?? '该站点还没有解说词，可在编辑弹窗中补充。' }}</p>
              <div class="story-links">
                <button type="button" @click="expanded = !expanded">{{ expanded ? '收起介绍' : '展开介绍' }}</button>
                <button v-if="activeStage?.videoUrl" type="button"><Video :size="14" />观看视频</button>
              </div>
              <p v-if="playbackNote" class="playback-note">{{ playbackNote }}</p>
              <p v-if="nextPlace" class="next-stop"><span>接下来看</span><strong>{{ nextPlace.name }}</strong></p>
            </div>
          </aside>
        </div>
        <div class="location-bar" role="status"><MapPin :size="13" /><span>沿途定位已开启</span></div>
      </main>
    </div>
  </section>
</template>

<style scoped>
.outdoor-phone{height:100%;min-height:0;border:1px solid #373b41;border-radius:34px;background:#20242a;padding:8px;box-shadow:inset 0 0 0 2px #090b0d,0 16px 38px #0006;overflow:hidden}
.phone-screen-map{position:relative;isolation:isolate;height:100%;display:flex;flex-direction:column;border-radius:27px;background:#f8faf9;color:#2b4039;overflow:hidden}
.phone-status{position:absolute;z-index:30;top:8px;left:16px;right:16px;display:flex;justify-content:space-between;color:#263b35;font-size:8px}
.phone-island{position:absolute;z-index:31;top:6px;left:50%;width:70px;height:17px;transform:translateX(-50%);border-radius:12px;background:#080909}
.client-head{height:50px;flex:none;padding:20px 11px 6px;display:flex;align-items:center;justify-content:space-between;gap:9px;background:#f8faf9;border-bottom:1px solid #e5eae7}
.head-button{display:flex;align-items:center;gap:5px;border:0;background:none;color:#183e43;font-size:10px;padding:4px 0}
.head-button.end{color:#697e71}
.head-route{flex:1;min-width:0;text-align:center;font-size:10.5px;color:#617a6b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.client-journey{flex:1;min-height:0;display:flex;flex-direction:column}
.journey-stage{position:relative;isolation:isolate;flex:1;min-height:0;overflow:hidden}
.journey-stage :deep(.map-canvas){position:absolute;inset:0}
.journey-stage :deep(.map-zoom){display:none}
.journey-stage :deep(.map-marker-wrap){position:relative;display:flex;justify-content:center}
.journey-stage :deep(.map-pin){width:24px;height:24px;border-width:2px;background:#183e43;font-size:7px}
.journey-stage :deep(.map-pin.is-active){background:#e5b957;color:#493f24;transform:scale(1.08)}
.journey-stage :deep(.map-pin-label){position:absolute;top:27px;left:50%;transform:translateX(-50%);padding:3px 5px;border:1px solid #dce5de;border-radius:4px;background:#ffffffed;color:#355149;font-size:6.5px;font-weight:600;white-space:nowrap;box-shadow:0 2px 7px #183e4315}
.journey-stage :deep(.map-pin-label.is-active){background:#183e43;color:#fff;border-color:#183e43}
.journey-toolbar{position:absolute;left:9px;top:50%;z-index:10;display:flex;flex-direction:column;align-items:center;gap:2px;width:40px;padding:3px;border:1px solid #dbe5df;border-radius:13px;background:#fffffff2;box-shadow:0 6px 20px #183e4330;transform:translateY(-50%)}
.journey-toolbar button{display:flex;align-items:center;justify-content:center;width:32px;height:29px;border:0;border-radius:8px;background:transparent;color:#183e43;padding:0}
.journey-toolbar button:disabled{opacity:.45}
.toolbar-divider{width:22px;height:1px;background:#dbe5df;margin:2px 0}
.story-dock{position:absolute;left:9px;bottom:14px;z-index:8;display:flex;align-items:stretch;overflow:hidden;border:1px solid #c8ddd2;border-radius:13px;background:#fffffff5;box-shadow:0 6px 20px #183e4330}
.dock-play{display:grid;place-items:center;width:38px;border:0;background:#183e43;color:#fff}
.dock-open{position:relative;display:flex;align-items:flex-start;gap:8px;min-width:126px;padding:17px 25px 7px 9px;border:0;background:none;color:#183e43;text-align:left}
.dock-heading{position:absolute;left:9px;top:4px;display:flex;align-items:center;gap:3px;font-size:8.5px;color:#5e7b6c}
.dock-line{display:flex;align-items:baseline;gap:6px;min-width:0}
.dock-line strong{max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}
.dock-line span{font:9px monospace;color:#6b8377}
.dock-open>svg{position:absolute;right:7px;top:50%;transform:translateY(-50%)}
.story-panel{position:absolute;right:0;top:0;bottom:0;z-index:7;display:flex;flex-direction:column;width:min(88%,286px);background:#f7faf8;box-shadow:-14px 0 36px #0d252b4d;transform:translateX(101%);visibility:hidden;transition:transform .24s ease,visibility 0s linear .24s}
.story-panel.open{transform:translateX(0);visibility:visible;transition:transform .24s ease}
.story-head{padding:9px 9px 7px 14px;border-bottom:1px solid #dbe5df}
.story-head-main{display:flex;align-items:center;justify-content:space-between;gap:10px}
.story-eyebrow{display:flex;align-items:center;gap:6px;color:#183e43;font-size:10px}
.story-close{display:grid;place-items:center;width:28px;height:28px;border:0;background:none;color:#183e43}
.story-stops{display:flex;gap:5px;overflow-x:auto;padding:7px 0 1px;scrollbar-width:none}
.story-stops::-webkit-scrollbar{display:none}
.story-stops button{display:flex;align-items:center;gap:4px;flex:0 0 auto;max-width:132px;padding:5px 8px;border:1px solid #d4e1d9;border-radius:999px;background:#fff;color:#5c776a;font-size:9px;white-space:nowrap}
.story-stops button span{display:grid;place-items:center;width:15px;height:15px;border-radius:50%;background:#e6eee8;font:9px monospace}
.story-stops button.active{border-color:#183e43;background:#e4f0ea;color:#183e43;font-weight:700}
.story-stops button.active span{background:#183e43;color:#fff}
.story-body{flex:1;min-height:0;overflow-y:auto;padding:12px 13px 14px}
.story-photo{position:relative;margin:0 0 11px;height:132px;border-radius:12px;overflow:hidden;background:#dfe9e4}
.story-photo img{display:block;width:100%;height:100%;object-fit:cover}
.story-artwork{display:grid;place-items:center;height:100%;background:radial-gradient(circle at 50% 30%,#e8f0ea,#d7e4dc 70%);color:#5d7d6d}
.photo-shade{position:absolute;inset:0;background:linear-gradient(#123b3800 40%,#173f39cc)}
.story-photo figcaption{position:absolute;left:0;right:0;bottom:0;padding:10px 12px;color:#fff}
.story-photo figcaption span{font-size:9px;opacity:.88}
.story-photo figcaption h2{margin:4px 0 0;font-size:16px}
.photo-credit{position:absolute;right:8px;top:7px;padding:2px 6px;border-radius:4px;background:#0d252bb8;color:#e9f1ed;font-size:8px}
.story-play{display:flex;align-items:center;gap:6px;margin:0 0 10px;padding:7px 13px;border:0;border-radius:999px;background:#183e43;color:#fff;font-size:11px}
.story-text{margin:0 0 7px;max-height:118px;overflow-y:auto;font-size:11px;line-height:1.8;color:#4c6156;scrollbar-width:thin}
.story-text.expanded{max-height:none}
.story-links{display:flex;gap:14px;margin-bottom:8px}
.story-links button{display:flex;align-items:center;gap:4px;padding:0;border:0;background:none;color:#3f6956;font-size:10.5px}
.playback-note{margin:8px 0 0;font-size:9.5px;line-height:1.7;color:#597164}
.next-stop{display:flex;gap:10px;align-items:baseline;margin:11px 0 0;padding-top:10px;border-top:1px solid #e2ebe5;font-size:10px;color:#4f6b5d}
.next-stop strong{font-weight:600;color:#172522}
.location-bar{display:flex;align-items:center;gap:7px;padding:9px 14px max(11px,env(safe-area-inset-bottom));border-top:1px solid #e5eae7;background:#f8faf9;font-size:9.5px;color:#587367}
</style>
