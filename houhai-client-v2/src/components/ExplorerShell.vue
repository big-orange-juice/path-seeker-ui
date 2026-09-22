<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { ArrowLeft, Bookmark, Compass, Footprints, MessageCircle } from 'lucide-vue-next'
import { useExplorer } from '../composables/useExplorer'
import { provideGuidePlayback } from '../composables/useGuidePlayback'
import SceneHeader from './SceneHeader.vue'
import OutdoorExplorer from './OutdoorExplorer.vue'
import ExplorerDetails from './ExplorerDetails.vue'
import CollectionView from './CollectionView.vue'
import MuseumRouteGallery from './MuseumRouteGallery.vue'
import AskPanel from './AskPanel.vue'
import type { Scene } from '../types'

const explorer = useExplorer()
const { loading, error, scene, destinations, currentDestination, destinationNotice, section, detailTab, places, routes, selectedPlace, selectedRoute, relatedRoutes, routeStops, journey, favorites, favoritePlaces, visitedPlaces, completedRoutes, storageWarning } = explorer
const mapMode = computed(() => section.value === 'explore' && scene.value === 'rickshaw' && !loading.value && !error.value)
provideGuidePlayback(() => selectedPlace.value)
const askOpen = shallowRef(false)
const museumDetailOpen = shallowRef(false)

function selectRoute(id: string) {
  explorer.selectRoute(id)
  if (scene.value === 'museum') {
    museumDetailOpen.value = true
    window.scrollTo({ top: 0 })
  }
}

function selectPlace(id: string) {
  explorer.selectPlace(id)
  if (scene.value === 'museum') museumDetailOpen.value = true
}

watch(() => currentDestination.value?.id, () => { museumDetailOpen.value = false }, { flush: 'sync' })

function changeScene(value: Scene) {
  explorer.switchScene(value)
  section.value = 'explore'
}

watch([section, scene], () => window.scrollTo({ top: 0 }))

</script>

<template>
  <div class="app-shell" :class="{ 'map-shell': mapMode }">
    <SceneHeader :scene="scene" :current-destination="currentDestination" :destinations="destinations" @change="changeScene" @select-destination="explorer.switchDestination" />
    <div v-if="loading" class="loading-screen" role="status"><span class="loading-ring" /><p>正在准备这一程的故事…</p></div>
    <div v-else-if="error" class="loading-screen" role="alert"><p>{{ error }}</p><button class="primary-button" @click="explorer.load">重新加载</button></div>
    <template v-else>
      <p v-if="storageWarning" class="storage-warning" role="status">{{ storageWarning }}</p>
      <p v-if="destinationNotice" class="destination-warning" role="status">{{ destinationNotice }}</p>
      <OutdoorExplorer v-if="mapMode" :key="currentDestination?.id" :places="places" :routes="routes" :destination-name="currentDestination?.name ?? '当前目的地'" :selected-place="selectedPlace" :route="selectedRoute" :detail-tab="detailTab" @select-place="selectPlace" @select-route="selectRoute" @change-tab="detailTab = $event" @ask="askOpen = true">
        <template #default="{ openTab, selectRoute: selectOutdoorRoute, catalogOpen }"><ExplorerDetails compact :catalog-open="catalogOpen" :all-routes="routes" :all-places="places" :tab="detailTab" :place="selectedPlace" :route="selectedRoute" :related-routes="relatedRoutes" :stops="routeStops" :journey="journey" :favorite="!!selectedPlace && favorites.includes(selectedPlace.id)" @change-tab="openTab" @favorite="explorer.toggleFavorite" @select-place="selectPlace" @select-route="selectOutdoorRoute" @start="explorer.startJourney" @complete="explorer.finishStop" /></template>
      </OutdoorExplorer>
      <main v-else-if="section === 'explore'" class="explorer-layout" :class="{ 'museum-layout': scene === 'museum', 'museum-detail-open': scene === 'museum' && museumDetailOpen }">
        <MuseumRouteGallery v-if="scene === 'museum'" :key="currentDestination?.id" :routes="routes" :destination-name="currentDestination?.name ?? '场馆'" :selected-route-id="museumDetailOpen ? selectedRoute?.id ?? '' : ''" @select="selectRoute" />
        <button v-if="scene === 'museum' && museumDetailOpen" class="back-to-gallery text-button" @click="museumDetailOpen = false"><ArrowLeft :size="15" />返回路线展厅</button>
        <template v-if="museumDetailOpen"><ExplorerDetails :tab="detailTab" :place="selectedPlace" :route="selectedRoute" :related-routes="relatedRoutes" :stops="routeStops" :journey="journey" :favorite="!!selectedPlace && favorites.includes(selectedPlace.id)" @change-tab="detailTab = $event" @favorite="explorer.toggleFavorite" @select-place="selectPlace" @select-route="selectRoute" @start="explorer.startJourney" @complete="explorer.finishStop" /></template>
      </main>
      <CollectionView v-else :kind="section" :places="section === 'favorites' ? favoritePlaces : visitedPlaces" :completed-routes="completedRoutes" @select="selectPlace" @explore="section = 'explore'" />
    </template>
    <AskPanel v-if="askOpen" :destination-name="currentDestination?.name ?? '当前路线'" :selected-place-name="selectedPlace?.name" :scene="scene" @close="askOpen = false" @select-place="askOpen = false" />
    <footer class="app-footer"><span class="footer-signature">每一段路，都有故事。</span><nav aria-label="主导航"><button :class="{ active: section === 'explore' && !askOpen }" :aria-current="section === 'explore' && !askOpen ? 'page' : undefined" @click="askOpen = false; section = 'explore'"><Compass :size="18" /><span>发现</span></button><button :class="{ active: section === 'favorites' && !askOpen }" :aria-current="section === 'favorites' && !askOpen ? 'page' : undefined" @click="askOpen = false; section = 'favorites'"><Bookmark :size="17" /><span>我的收藏</span><small v-if="favorites.length">{{ favorites.length }}</small></button><button :class="{ active: section === 'journeys' && !askOpen }" :aria-current="section === 'journeys' && !askOpen ? 'page' : undefined" @click="askOpen = false; section = 'journeys'"><Footprints :size="18" /><span>我的足迹</span></button><button :class="{ active: askOpen }" :aria-pressed="askOpen" @click="askOpen = true"><MessageCircle :size="18" /><span>问</span></button></nav><span class="footer-edition">后海慢游 · 体验版</span></footer>
  </div>
</template>

<style scoped>
.app-shell{min-height:100dvh;padding-bottom:66px}.explorer-layout{display:grid;grid-template-columns:280px minmax(320px,1fr) 340px;gap:20px;padding:26px 30px 18px;max-width:1800px;margin:0 auto}.experience-column{display:flex;flex-direction:column;min-width:0;height:calc(100dvh - 200px);min-height:650px}.experience-topline{display:flex;justify-content:space-between;gap:12px;font-size:10px;color:var(--muted);padding:8px 3px 17px}.experience-topline>span{display:flex;align-items:center;gap:6px}.experience-topline>span:last-child{color:#849782}.experience-column :deep(.map-frame){flex:1}.experience-column :deep(.museum-gallery){overflow:auto}.experience-footer{display:flex;align-items:center;justify-content:center;gap:6px;padding:16px 0 0;color:var(--muted);font-size:10px}.detail-panel{background:white;border:1px solid var(--line);border-radius:17px;overflow:hidden;display:flex;flex-direction:column;height:calc(100dvh - 174px);min-height:677px}.detail-tabs{display:flex;gap:23px;padding:0 20px;border-bottom:1px solid var(--line);min-height:54px}.detail-tabs button{position:relative;border:0;background:none;font-size:12px;color:var(--muted);padding:16px 0}.detail-tabs .active{color:var(--lake);font-weight:700}.detail-tabs .active::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--lake)}.detail-content{overflow:auto;scrollbar-width:thin;scrollbar-color:#dbe3dc transparent}.journey-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--ochre);margin-left:6px;vertical-align:middle}.app-footer{position:fixed;bottom:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;gap:20px;height:65px;background:#f8faf9f5;border-top:1px solid var(--line);padding:0 34px;z-index:20;backdrop-filter:blur(16px)}.footer-signature{font:11px var(--display);letter-spacing:3px;color:#8f9c90;min-width:225px}.footer-edition{font-size:10px;color:#8f9c90;min-width:225px;text-align:right}.app-footer nav{display:flex;gap:48px;height:100%}.app-footer button{display:flex;align-items:center;gap:8px;font-size:11px;border:0;background:none;color:#8c998f;position:relative}.app-footer button.active{color:var(--lake);font-weight:600}.app-footer button.active::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--lake)}.app-footer small{font-size:9px;background:#e5ede5;border-radius:5px;padding:2px 4px}.loading-screen{min-height:70vh;display:flex;flex-direction:column;justify-content:center;align-items:center;color:var(--muted);gap:15px;font-size:13px}.loading-screen .primary-button{width:auto}.loading-ring{width:30px;height:30px;border:2px solid var(--line);border-top-color:var(--lake);border-radius:50%;animation:spin 1s linear infinite}.storage-warning,.destination-warning{margin:12px 30px;font-size:12px;color:#8b733b}.destination-warning{color:var(--lake)}.experience-topline>span:last-child{white-space:nowrap}@keyframes spin{to{transform:rotate(360deg)}}
@media(min-width:981px){.explorer-layout{height:calc(100dvh - 153px);min-height:480px}.explorer-layout>:deep(.discovery){height:100%;overflow:auto;scrollbar-width:thin;scrollbar-color:#dbe3dc transparent}.experience-column,.detail-panel{height:100%;min-height:0}.experience-column :deep(.map-frame){min-height:0}}
@media(min-width:1600px){.explorer-layout{grid-template-columns:300px minmax(320px,1fr) 375px;gap:27px}}
@media(max-width:1220px) and (min-width:761px){.explorer-layout{grid-template-columns:235px minmax(260px,1fr) 310px;gap:12px;padding:22px 20px}.experience-topline>span:last-child{display:none}.footer-signature,.footer-edition{min-width:170px}.app-footer nav{gap:30px}}
@media(max-width:980px) and (min-width:761px){.explorer-layout{grid-template-columns:220px minmax(0,1fr)}.experience-column{min-height:600px;height:650px}.detail-panel{grid-column:2;height:700px;min-height:0}.footer-signature{display:none}.app-footer{justify-content:center}.footer-edition{display:none}}
@media(max-width:760px){.app-shell{padding-bottom:calc(73px + env(safe-area-inset-bottom))}.explorer-layout{display:flex;flex-direction:column;padding:18px 15px 22px;gap:0}.experience-column{height:auto;min-height:0}.experience-topline{display:none}.experience-footer{padding:12px 0 21px;font-size:9px}.detail-panel{height:auto;min-height:0;border-radius:15px}.detail-content{overflow:visible}.detail-tabs{min-height:50px;justify-content:space-around;gap:15px}.detail-tabs button{flex:1}.app-footer{height:calc(65px + env(safe-area-inset-bottom));padding:0 15px env(safe-area-inset-bottom)}.footer-signature,.footer-edition{display:none}.app-footer nav{width:100%;gap:0;justify-content:space-around}.app-footer button{flex-direction:column;justify-content:center;gap:5px;padding:0 15px;font-size:10px}.app-footer button.active::before{left:15px;right:15px}.app-footer small{position:absolute;top:8px;right:0}.storage-warning{margin:10px 18px}}
.museum-layout{display:grid;grid-template-columns:minmax(0,900px);justify-content:center;height:auto;min-height:0;max-width:1340px;align-items:start}.museum-layout.museum-detail-open{grid-template-columns:minmax(0,1fr) 340px}.museum-layout .detail-panel{position:sticky;top:20px;height:calc(100dvh - 120px);min-height:0;grid-column:2;grid-row:1 / span 2}.back-to-gallery{grid-column:1;justify-self:start;margin-bottom:12px;grid-row:1}.museum-detail-open :deep(.museum-route-gallery){grid-column:1;grid-row:2}
@media(max-width:760px){.museum-layout,.museum-layout.museum-detail-open{display:flex;flex-direction:column;gap:12px}.museum-layout .detail-panel{position:static;width:100%;height:auto}.museum-detail-open :deep(.museum-route-gallery){display:none}.back-to-gallery{order:-1}}
.map-shell{height:100dvh;min-height:0;display:flex;flex-direction:column;overflow:hidden;padding-bottom:65px}.map-shell>:deep(.site-header){flex-shrink:0;z-index:10}.map-shell .storage-warning,.map-shell .destination-warning{flex-shrink:0;margin:0;padding:8px 20px;background:#f8faf9;font-size:11px}.map-shell :deep(.destination-popover){z-index:30}
@media(max-width:760px){.map-shell{padding-bottom:calc(65px + env(safe-area-inset-bottom))}.map-shell>:deep(.site-header){padding:10px 14px 8px;gap:9px}.map-shell :deep(.scene-switch button){padding:8px}.map-shell :deep(.brand-mark){width:31px;height:33px;font-size:23px}.map-shell :deep(.brand strong){font-size:17px}.map-shell :deep(.destination-popover){top:110px}}
</style>
