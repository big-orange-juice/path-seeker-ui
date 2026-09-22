<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, useTemplateRef, watch, shallowRef } from 'vue'
import { ChevronLeft, ChevronRight, Focus, Images, Minus, Navigation, Plus, X } from 'lucide-vue-next'
import { createAmap, type MapAdapter } from '../../services/mapAdapter'
import { message } from '../../ride/i18n'
import type { Locale, RideRoute } from '../../ride/types'
import type { LiveLocation } from '../../types'

const props = defineProps<{ route: RideRoute; locale: Locale; selectedId?: string; location?: LiveLocation; overview?: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
const canvas = useTemplateRef<HTMLDivElement>('canvas')
const failed = shallowRef(false)
const loading = shallowRef(true)
const following = shallowRef(false)
const gallery = shallowRef(false)
const galleryIndex = shallowRef(0)
const galleryTrack = useTemplateRef<HTMLDivElement>('galleryTrack')
const galleryPhotos = computed(() => props.route.stops.flatMap(stop => stop.photo ? [{ id: stop.id, name: stop.name, photo: stop.photo }] : []))
let adapter: MapAdapter | undefined
let observer: ResizeObserver | undefined
let generation = 0

function update() {
  const compact = (canvas.value?.clientWidth ?? 400) < 760
  adapter?.update({ places: props.route.stops, route: props.route, selectedPlaceId: props.selectedId ?? '',
    tilt: props.overview ? 0 : 45,
    insets: props.overview ? { top: 90, right: compact ? 45 : 100, bottom: 290, left: compact ? 45 : 100 } : { top: 45, right: 60, bottom: 60, left: 60 } })
}
function toggleFollow() {
  if (!adapter) return
  const next = !following.value
  following.value = adapter.setTourMode(next) ? next : false
}
function showOverview() {
  if (following.value) toggleFollow()
  else adapter?.fit()
}
function openGallery() {
  gallery.value = true
  galleryIndex.value = Math.max(0, galleryPhotos.value.findIndex(item => item.id === props.selectedId))
  void nextTick(() => {
    const track = galleryTrack.value
    if (track) track.scrollTo({ left: galleryIndex.value * track.clientWidth })
  })
}
function closeGallery() { gallery.value = false }
function syncGallery() {
  const track = galleryTrack.value
  if (!track || !track.clientWidth) return
  galleryIndex.value = Math.min(Math.max(Math.round(track.scrollLeft / track.clientWidth), 0), Math.max(0, galleryPhotos.value.length - 1))
}
function moveGallery(direction: number) {
  const track = galleryTrack.value
  if (!track || !track.clientWidth) return
  const target = Math.min(Math.max(galleryIndex.value + direction, 0), galleryPhotos.value.length - 1)
  track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' })
}
function onGalleryKey(event: KeyboardEvent) { if (event.key === 'Escape') closeGallery() }
watch(gallery, value => {
  if (value) window.addEventListener('keydown', onGalleryKey)
  else window.removeEventListener('keydown', onGalleryKey)
})
async function initialize() {
  const token = ++generation
  adapter?.destroy()
  adapter = undefined
  following.value = false
  loading.value = true
  failed.value = false
  try {
    if (!canvas.value) return
    const instance = await createAmap(canvas.value, id => emit('select', id))
    if (token !== generation) { instance.destroy(); return }
    adapter = instance
    update()
    adapter.setLocation(props.location)
    adapter.fit()
    if (!props.overview) following.value = instance.setTourMode(true)
  } catch { if (token === generation) failed.value = true }
  finally { if (token === generation) loading.value = false }
}
watch(() => [props.route, props.selectedId, props.overview], update)
watch(() => props.location, value => adapter?.setLocation(value))
onMounted(() => {
  void initialize()
  observer = new ResizeObserver(() => { adapter?.resize(); update() })
  if (canvas.value) observer.observe(canvas.value)
})
onUnmounted(() => { generation += 1; observer?.disconnect(); adapter?.destroy(); window.removeEventListener('keydown', onGalleryKey) })
</script>

<template>
  <section class="ride-map" :aria-label="message(locale, 'mapLabel')">
    <div ref="canvas" class="map-canvas" />
    <div v-if="failed || loading" class="map-feedback" role="status">
      <span>{{ message(locale, failed ? 'mapError' : 'loading') }}</span>
      <button v-if="failed" @click="initialize">{{ message(locale, 'retry') }}</button>
    </div>
    <div class="map-tools" v-if="!failed && !loading">
      <button :aria-label="message(locale, 'zoomIn')" @click="adapter?.zoom(1)"><Plus :size="18" /></button>
      <button :aria-label="message(locale, 'zoomOut')" @click="adapter?.zoom(-1)"><Minus :size="18" /></button>
      <button :aria-label="message(locale, 'overview')" @click="showOverview"><Focus :size="18" /></button>
      <button v-if="!overview" :class="{ 'is-active': following }" :aria-label="message(locale, following ? 'unfollow' : 'follow')" @click="toggleFollow"><Navigation :size="18" /></button>
      <button v-if="!overview" :aria-label="message(locale, 'gallery')" @click="openGallery"><Images :size="18" /></button>
    </div>
    <Teleport to="body">
      <div v-if="gallery" class="gallery-layer" @click.self="closeGallery">
        <aside class="gallery-drawer" role="dialog" aria-modal="true" :aria-label="message(locale, 'gallery')">
          <header class="gallery-head">
            <span class="gallery-title">{{ message(locale, 'gallery') }}<span>{{ galleryIndex + 1 }} / {{ galleryPhotos.length }}</span></span>
            <button :aria-label="message(locale, 'close')" @click="closeGallery"><X :size="18" /></button>
          </header>
          <div ref="galleryTrack" class="gallery-track" @scroll="syncGallery">
            <figure v-for="item in galleryPhotos" :key="item.id" class="gallery-card" :class="{ current: item.id === selectedId }">
              <img :src="item.photo.url" :alt="item.name" />
              <figcaption><strong>{{ item.name }}</strong><a :href="item.photo.source" target="_blank" rel="noopener noreferrer">{{ item.photo.credit }}</a></figcaption>
            </figure>
          </div>
          <footer class="gallery-nav">
            <button @click="moveGallery(-1)"><ChevronLeft :size="17" />{{ message(locale, 'previousPhoto') }}</button>
            <button @click="moveGallery(1)">{{ message(locale, 'nextPhoto') }}<ChevronRight :size="17" /></button>
          </footer>
        </aside>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.ride-map{position:relative;min-height:260px;background:#dce8e3;isolation:isolate}.map-canvas{position:absolute;inset:0}.map-feedback{position:absolute;top:12px;left:14px;right:14px;z-index:1;max-width:500px;padding:12px 16px;display:flex;align-items:center;gap:12px;border-radius:12px;background:#fffffff2;box-shadow:0 4px 20px #183e4310;color:var(--lake);font-size:12px;line-height:1.6}.map-feedback button{border:0;border-radius:8px;padding:8px;background:#e5efea;color:var(--lake);white-space:nowrap}.map-tools{position:absolute;right:14px;top:90px;display:grid;border-radius:12px;overflow:hidden;box-shadow:0 3px 14px #183e4320}.map-tools button{display:grid;place-items:center;width:40px;height:40px;border:0;border-bottom:1px solid var(--line);background:white;color:var(--lake)}.map-tools button.is-active{background:#dcebee}.gallery-layer{position:fixed;inset:0;z-index:60;background:#0d252bb3;display:flex;justify-content:flex-end}.gallery-drawer{display:flex;flex-direction:column;width:min(88vw,400px);height:100%;background:#f7faf8;box-shadow:-16px 0 44px #0d252b4d;animation:gallery-in .22s ease-out}.gallery-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;border-bottom:1px solid #dbe5df}.gallery-title{display:flex;align-items:baseline;gap:10px;font:600 15px var(--display);color:var(--ink)}.gallery-title span{font:11px monospace;color:#6b8377}.gallery-head button{display:grid;place-items:center;width:34px;height:34px;border:0;background:none;color:var(--lake)}.gallery-track{flex:1;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior:contain}.gallery-track::-webkit-scrollbar{display:none}.gallery-card{flex:0 0 100%;scroll-snap-align:start;margin:0;padding:16px 18px;display:flex;flex-direction:column;gap:12px}.gallery-card img{width:100%;height:min(52dvh,400px);object-fit:cover;border-radius:14px;background:#dce8e3}.gallery-card.current img{box-shadow:0 0 0 3px var(--lake)}.gallery-card figcaption{display:flex;justify-content:space-between;gap:12px;font-size:12px;line-height:1.5;color:#3f6956}.gallery-card figcaption a{color:#587a6b;flex-shrink:0}.gallery-nav{display:flex;gap:12px;padding:14px 18px max(16px,env(safe-area-inset-bottom));border-top:1px solid #dbe5df}.gallery-nav button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;border:1px solid #c9dbd1;border-radius:12px;background:white;color:var(--lake);font-size:12px}@keyframes gallery-in{from{transform:translateX(26px);opacity:.45}}
</style>
