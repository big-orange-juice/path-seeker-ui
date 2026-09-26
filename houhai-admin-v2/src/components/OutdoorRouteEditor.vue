<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { Map, Pencil, Save } from 'lucide-vue-next'
import type { ArtifactStage, CulturalPlace, Destination, TourRoute } from '../types'
import MapCanvas from './MapCanvas.vue'
import OutdoorMobilePreview from './OutdoorMobilePreview.vue'
import OutdoorRouteChat from './OutdoorRouteChat.vue'
import StageEditDialog from './StageEditDialog.vue'

const props = defineProps<{ route: TourRoute; destination: Destination; places: CulturalPlace[]; stages: ArtifactStage[] }>()
const emit = defineEmits<{ close: []; save: []; saveStage: [value: ArtifactStage]; removeStage: [id: string] }>()
const activeStopId = shallowRef(props.route.stops[0]?.id ?? '')
const editingStageId = shallowRef('')
const activeStop = computed(() => props.route.stops.find((item) => item.id === activeStopId.value) ?? props.route.stops[0] ?? null)
const activePlace = computed(() => props.places.find((item) => item.id === activeStop.value?.placeId) ?? null)
const activeStage = computed(() => props.stages.find((item) => item.placeId === activePlace.value?.id) ?? null)
const editingStage = computed(() => props.stages.find((item) => item.id === editingStageId.value) ?? null)

function selectPlace(placeId: string) {
  activeStopId.value = props.route.stops.find((item) => item.placeId === placeId)?.id ?? activeStopId.value
}
/** 站点内容编辑：地图双击、预览站点列表或工具条入口都走这里。 */
function editStop(stopId: string) {
  const stop = props.route.stops.find((item) => item.id === stopId)
  if (!stop) return
  activeStopId.value = stop.id
  const stage = props.stages.find((item) => item.placeId === stop.placeId)
  if (stage) editingStageId.value = stage.id
}
function editPlace(placeId: string) {
  const stop = props.route.stops.find((item) => item.placeId === placeId)
  if (stop) editStop(stop.id)
}
</script>

<template>
  <div class="outdoor-editor">
    <div class="outdoor-editor__main">
      <section class="outdoor-editor__map">
        <MapCanvas :destination="destination" :places="places" :route="route" :active-place-id="activePlace?.id" @select-place="selectPlace" @edit-place="editPlace" />
        <div class="outdoor-map-toolbar"><Map :size="14" /><span>高德地图路线</span><b>{{ route.distanceKm }} km</b><b>{{ route.estimatedMinutes }} min</b><button :disabled="!activeStop" @click="activeStop && editStop(activeStop.id)"><Pencil :size="12" />编辑这一站</button></div>
        <div v-if="activePlace" class="outdoor-map-active"><span>当前预览 · 双击站点打开编辑</span><strong>{{ activeStage?.name ?? activePlace.name }}</strong><small>{{ activeStage?.summary || '尚未维护站点内容' }}</small><button @click="editStop(activeStop!.id)"><Pencil :size="12" />编辑站点内容</button></div>
      </section>

      <OutdoorMobilePreview
        :route="route"
        :destination="destination"
        :places="places"
        :stages="stages"
        :active-stop-id="activeStopId"
        @select-stop="activeStopId = $event"
        @edit-stop="editStop($event)"
      />

      <OutdoorRouteChat :route="route" :active-place="activePlace" />
    </div>
    <footer class="outdoor-editor__footer">
      <button class="button ghost" @click="emit('close')">关闭</button>
      <button class="button primary" @click="emit('save')"><Save :size="15" />{{ route.status === 'published' ? '保存编排' : '上架' }}</button>
    </footer>

    <StageEditDialog v-if="editingStage" :key="editingStage.id" :stage="editingStage" @close="editingStageId = ''" @save="emit('saveStage', $event)" />
  </div>
</template>

<style scoped>
.outdoor-editor{flex:1;min-height:0;display:flex;flex-direction:column;background:#111418}.outdoor-editor__main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(500px,1.55fr) 350px minmax(270px,.72fr);gap:14px;padding:14px}.outdoor-editor__map{position:relative;min-width:0;overflow:hidden;border:1px solid #2b2f34;border-radius:10px;background:#101317}.outdoor-map-toolbar{position:absolute;z-index:700;top:13px;left:13px;display:flex;align-items:center;gap:8px;padding:8px 11px;border-radius:7px;background:#15181ce8;color:#f0f1f2;box-shadow:0 4px 16px #0004;font-size:9px}.outdoor-map-toolbar b{padding-left:8px;border-left:1px solid #383c42}.outdoor-map-toolbar button{height:24px;margin-left:4px;padding:0 9px;border:1px solid #8a733f;border-radius:5px;background:#806b39;color:#fff;font-size:9px;display:flex;align-items:center;gap:5px}.outdoor-map-toolbar button:disabled{opacity:.45;cursor:not-allowed}.outdoor-map-active{position:absolute;z-index:700;left:13px;bottom:13px;width:min(288px,calc(100% - 26px));padding:10px 11px 11px;border:1px solid #ffffff1a;border-radius:7px;background:#15181ce8;color:#f0f1f2;box-shadow:0 5px 18px #0004}.outdoor-map-active span,.outdoor-map-active strong,.outdoor-map-active small{display:block}.outdoor-map-active span{color:#d7b45d;font-size:7px;letter-spacing:.12em}.outdoor-map-active strong{font-size:11px;margin-top:3px}.outdoor-map-active small{margin-top:3px;color:#a5adb3;font-size:8px}.outdoor-map-active button{margin-top:8px;height:26px;padding:0 10px;border:1px solid #3a3f45;border-radius:5px;background:#1c2025;color:#e6e8ea;font-size:9px;display:flex;align-items:center;gap:6px}.outdoor-editor__footer{height:58px;flex:none;border-top:1px solid #2c3035;display:flex;justify-content:flex-end;align-items:center;gap:9px;padding:0 18px}@media(max-width:1250px){.outdoor-editor__main{grid-template-columns:minmax(440px,1.35fr) 320px 270px;gap:10px;padding:10px}}
</style>
