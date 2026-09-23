<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef, watch, shallowRef } from 'vue'
import { Focus, ListOrdered, Minus, Navigation, Plus } from 'lucide-vue-next'
import { createAmap, type MapAdapter } from '../../services/mapAdapter'
import { message } from '../../ride/i18n'
import type { Locale, RideRoute } from '../../ride/types'
import type { LiveLocation } from '../../types'

const props = defineProps<{ route: RideRoute; locale: Locale; selectedId?: string; location?: LiveLocation; overview?: boolean; stopsOpen?: boolean; hideTools?: boolean }>()
const emit = defineEmits<{ select: [id: string]; stops: [] }>()
const canvas = useTemplateRef<HTMLDivElement>('canvas')
const failed = shallowRef(false)
const loading = shallowRef(true)
const following = shallowRef(false)
let adapter: MapAdapter | undefined
let observer: ResizeObserver | undefined
let generation = 0

function update() {
  const compact = (canvas.value?.clientWidth ?? 400) < 760
  adapter?.update({ places: props.route.stops, route: props.route, selectedPlaceId: props.selectedId ?? '',
    tilt: props.overview ? 0 : 45,
    insets: props.overview ? { top: 90, right: compact ? 45 : 100, bottom: 290, left: compact ? 45 : 100 } : { top: 70, right: 80, bottom: 120, left: 80 } })
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
function zoomIn() { adapter?.zoom(1) }
function zoomOut() { adapter?.zoom(-1) }
function overviewMap() { showOverview() }
function toggleFollowing() { toggleFollow() }
defineExpose({ zoomIn, zoomOut, overviewMap, toggleFollowing, following })
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
onUnmounted(() => { generation += 1; observer?.disconnect(); adapter?.destroy() })
</script>

<template>
  <section class="ride-map" :aria-label="message(locale, 'mapLabel')">
    <div ref="canvas" class="map-canvas" />
    <div v-if="failed || loading" class="map-feedback" role="status">
      <span>{{ message(locale, failed ? 'mapError' : 'loading') }}</span>
      <button v-if="failed" @click="initialize">{{ message(locale, 'retry') }}</button>
    </div>
    <div class="map-tools" v-if="!hideTools && (!overview || (!failed && !loading))">
      <button type="button" :disabled="failed || loading" :aria-label="message(locale, 'zoomIn')" @click="adapter?.zoom(1)"><Plus :size="18" /></button>
      <button type="button" :disabled="failed || loading" :aria-label="message(locale, 'zoomOut')" @click="adapter?.zoom(-1)"><Minus :size="18" /></button>
      <button type="button" :disabled="failed || loading" :aria-label="message(locale, 'overview')" @click="showOverview"><Focus :size="18" /></button>
      <button v-if="!overview" type="button" :disabled="failed || loading" :aria-pressed="following" :class="{ 'is-active': following }" :aria-label="message(locale, following ? 'unfollow' : 'follow')" @click="toggleFollow"><Navigation :size="18" /></button>
      <button v-if="!overview" :class="{ 'is-active': stopsOpen }" :aria-label="message(locale, 'stops')" :aria-expanded="Boolean(stopsOpen)" aria-controls="stop-drawer-panel" @click="emit('stops')"><ListOrdered :size="18" /></button>
    </div>
  </section>
</template>

<style scoped>
.ride-map{position:relative;min-height:260px;background:#dce8e3;isolation:isolate}.map-canvas{position:absolute;inset:0}.map-feedback{position:absolute;top:12px;left:14px;right:14px;z-index:1;max-width:500px;padding:12px 16px;display:flex;align-items:center;gap:12px;border-radius:12px;background:#fffffff2;box-shadow:0 4px 20px #183e4310;color:var(--lake);font-size:12px;line-height:1.6}.map-feedback button{border:0;border-radius:8px;padding:8px;background:#e5efea;color:var(--lake);white-space:nowrap}.map-tools{position:absolute;right:14px;top:90px;display:grid;border-radius:12px;overflow:hidden;box-shadow:0 3px 14px #183e4320}.map-tools button{display:grid;place-items:center;width:40px;height:40px;border:0;border-bottom:1px solid var(--line);background:white;color:var(--lake)}.map-tools button.is-active{background:#dcebee}
</style>
