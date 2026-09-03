<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resolveHeritageAssetTypeName } from '@path-seeker/ts-shared'
import OutdoorMapCanvas from '@/components/map/OutdoorMapCanvas.vue'
import MapRouteControl from '@/components/map/MapRouteControl.vue'
import MapLocationControl from '@/components/map/MapLocationControl.vue'
import CurrentRoutePreview from '@/components/map/CurrentRoutePreview.vue'
import RouteSelectionPanel from '@/components/map/RouteSelectionPanel.vue'
import { useBrowserLocation } from '@/composables/useBrowserLocation'
import { useOutdoorMapStore } from '@/stores/useOutdoorMapStore'

const route = useRoute()
const router = useRouter()
const store = useOutdoorMapStore()
const locationState = useBrowserLocation()
const museumId = computed(() => String(route.params.museumId || route.query.museumId || '').trim())
const selectedId = shallowRef<string | null>(String(route.query.assetId || '').trim() || null)
const routeId = computed(() => String(route.query.routeId || '').trim())
const mapError = shallowRef<string | null>(null)
const routePanelOpen = shallowRef(false)
const assetTypes = [1, 2, 3, 4, 5, 6, 7, 8]

async function loadPage() {
  await Promise.all([store.load(museumId.value), store.loadRoutes(museumId.value)])
}
function selectAsset(id: string) {
  selectedId.value = id
  void router.replace({ query: { ...route.query, assetId: id } })
}
function selectStation(id: string) {
  const station = store.routeMap?.stations.find(item => item.id === id)
  if (station?.assetId) selectAsset(station.assetId)
}
function selectRoute(id: string) {
  routePanelOpen.value = false
  void router.replace({ query: { ...route.query, routeId: id } })
}
function clearRoute() {
  const query = { ...route.query }
  delete query.routeId
  void router.replace({ query })
}
function openAssetDetail(id: string) { void router.push(`/museums/${encodeURIComponent(museumId.value)}/assets/${encodeURIComponent(id)}`) }
function openRouteDetail(id: string) { void router.push(`/missions/${encodeURIComponent(id)}/map`) }

onMounted(() => void loadPage())
watch(museumId, () => void loadPage())
watch(routeId, id => { if (id) void store.loadRoute(id); else store.clearRoute() }, { immediate: true })
</script>

<template>
  <main class="outdoor-map-page">
    <header class="outdoor-map-header"><button type="button" @click="router.back()">返回</button><div><p>古镇地图</p><h1>{{ store.scene?.museum?.name || '地点地图' }}</h1></div><span>{{ store.assets.length }} 处</span></header>
    <nav class="outdoor-map-filters" aria-label="资产类型筛选"><button type="button" :class="{ active: store.selectedAssetType === null }" @click="store.selectedAssetType = null">全部</button><button v-for="type in assetTypes" :key="type" type="button" :class="{ active: store.selectedAssetType === type }" @click="store.selectedAssetType = type">{{ resolveHeritageAssetTypeName(type) }}</button></nav>
    <section class="outdoor-map-stage" aria-label="古镇地图">
      <div v-if="store.pending" class="map-state">正在加载地图…</div>
      <div v-else-if="store.error" class="map-state"><p>{{ store.error }}</p><button type="button" @click="store.load(museumId)">重试</button></div>
      <div v-else-if="!store.scene" class="map-state">暂无地图数据</div>
      <template v-else>
        <OutdoorMapCanvas :scene="store.scene" :route-map="store.routeMap" :focused-asset-id="selectedId" :user-location="locationState.location.value" @asset-select="selectAsset" @station-select="selectStation" @error="mapError = $event" />
        <MapRouteControl class="route-control" :count="store.routes.length" :selected="Boolean(store.routeMap)" @open="routePanelOpen = true" />
        <MapLocationControl class="location-control" :pending="locationState.pending.value" @locate="locationState.locate" />
        <p v-if="mapError || store.routeError || locationState.error.value" class="map-error">{{ mapError || store.routeError || locationState.error.value }}</p>
        <CurrentRoutePreview v-if="store.routeMap" class="route-summary" :route-map="store.routeMap" @clear="clearRoute" @detail="openRouteDetail" />
      </template>
    </section>
    <section v-if="selectedId" class="asset-summary"><template v-if="store.assets.find(item => item.id === selectedId)"><div><p>文化资产</p><h2>{{ store.assets.find(item => item.id === selectedId)?.name }}</h2><span>{{ resolveHeritageAssetTypeName(store.assets.find(item => item.id === selectedId)?.assetType) }}</span></div><button type="button" @click="openAssetDetail(selectedId)">查看详情</button></template></section>
    <RouteSelectionPanel v-model:open="routePanelOpen" :routes="store.routes" :selected-route-id="routeId" :pending="store.routesPending" :error="store.routesError" @select="selectRoute" @retry="store.loadRoutes(museumId)" />
  </main>
</template>

<style scoped>
.outdoor-map-page{min-height:100vh;background:#11100d;color:#f8f0df;padding:.8rem;display:grid;grid-template-rows:auto auto minmax(31rem,1fr) auto;gap:.7rem}.outdoor-map-header{display:flex;align-items:center;justify-content:space-between;gap:.8rem}.outdoor-map-header>button,.asset-summary>button{min-height:40px;border:1px solid rgba(222,180,98,.4);border-radius:999px;padding:.45rem .7rem;color:#e7c37c;font-size:.72rem}.outdoor-map-header p,.asset-summary p{margin:0;color:#d4a85a;font-size:.62rem;letter-spacing:.12em}.outdoor-map-header h1,.asset-summary h2{margin:.12rem 0;font-size:1.1rem}.outdoor-map-header>span{color:rgba(248,240,223,.55);font-size:.7rem}.outdoor-map-filters{display:flex;gap:.38rem;overflow:auto;padding-bottom:.1rem}.outdoor-map-filters button{white-space:nowrap;border:1px solid rgba(248,240,223,.12);border-radius:999px;padding:.38rem .58rem;color:rgba(248,240,223,.6);font-size:.68rem}.outdoor-map-filters button.active{border-color:rgba(224,180,96,.6);background:rgba(224,180,96,.12);color:#ebcb8a}.outdoor-map-stage{position:relative;min-height:31rem;overflow:hidden;border:1px solid rgba(224,180,96,.28);border-radius:1rem;background:#d8d0be}.map-state{position:absolute;inset:0;z-index:2;display:grid;place-content:center;gap:.65rem;background:#17140f;color:rgba(248,240,223,.65);text-align:center}.map-state button{color:#e7c37c}.route-control{position:absolute;z-index:3;left:16px;top:16px}.location-control{position:absolute;z-index:3;right:16px;top:16px}.map-error{position:absolute;z-index:3;top:72px;left:16px;right:16px;margin:0;border:1px solid rgba(202,114,76,.35);border-radius:.65rem;background:rgba(49,24,17,.9);padding:.55rem .7rem;color:#f0b59b;font-size:.7rem}.route-summary{position:absolute;z-index:3;right:12px;bottom:12px;left:12px}.asset-summary{display:flex;align-items:center;justify-content:space-between;gap:1rem;border:1px solid rgba(224,180,96,.25);border-radius:.85rem;background:#191610;padding:.75rem .9rem}.asset-summary span{color:rgba(248,240,223,.55);font-size:.7rem}
</style>
