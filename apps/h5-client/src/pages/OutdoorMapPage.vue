<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useOutdoorMapStore } from "@/stores/useOutdoorMapStore"
import { resolveHeritageAssetTypeName } from "@path-seeker/ts-shared"

const route = useRoute()
const router = useRouter()
const store = useOutdoorMapStore()
const museumId = computed(() => String(route.params.museumId || route.query.museumId || "").trim())
const selectedId = shallowRef<string | null>(String(route.query.assetId || "").trim() || null)
const assetTypes = [1, 2, 3, 4, 5, 6, 7, 8]

onMounted(() => void store.load(museumId.value))
function selectAsset(id: string) {
  selectedId.value = id
  void router.replace({ query: { ...route.query, assetId: id } })
}
function openDetail(id: string) {
  void router.push(`/museums/${encodeURIComponent(museumId.value)}/assets/${encodeURIComponent(id)}`)
}
</script>

<template>
  <main class="outdoor-map-page">
    <header class="outdoor-map-header">
      <button type="button" @click="router.back()">返回</button>
      <div><p class="eyebrow">场景地图</p><h1>{{ store.scene?.museum?.name || "景区地图" }}</h1></div>
      <span>{{ store.assets.length }} 个资产</span>
    </header>
    <nav class="outdoor-map-filters" aria-label="资产类型筛选">
      <button type="button" :class="{ active: store.selectedAssetType === null }" @click="store.selectedAssetType = null">全部</button>
      <button v-for="type in assetTypes" :key="type" type="button" :class="{ active: store.selectedAssetType === type }" @click="store.selectedAssetType = type">{{ resolveHeritageAssetTypeName(type) }}</button>
    </nav>
    <section class="outdoor-map-stage" aria-label="景区资产分布">
      <div v-if="store.pending" class="outdoor-map-empty">正在加载地图…</div>
      <div v-else-if="store.error" class="outdoor-map-empty">{{ store.error }}<button type="button" @click="store.load(museumId)">重试</button></div>
      <div v-else-if="!store.scene" class="outdoor-map-empty">暂无地图数据</div>
      <template v-else>
        <div class="outdoor-map-grid" aria-hidden="true" />
        <button v-for="asset in store.assets" :key="asset.id" type="button" class="outdoor-map-marker" :class="{ selected: selectedId === asset.id }" @click="selectAsset(asset.id)">
          <span class="marker-dot" /><span>{{ asset.name }}</span>
        </button>
      </template>
    </section>
    <section v-if="selectedId" class="outdoor-map-detail">
      <template v-if="store.assets.find((asset) => asset.id === selectedId)"><div><p class="eyebrow">文化资产</p><h2>{{ store.assets.find((asset) => asset.id === selectedId)?.name }}</h2><p>{{ resolveHeritageAssetTypeName(store.assets.find((asset) => asset.id === selectedId)?.assetType) }}</p></div><button type="button" @click="openDetail(selectedId)">查看详情</button></template>
    </section>
  </main>
</template>

<style scoped>
.outdoor-map-page{min-height:100vh;background:#f5f1e8;color:#29261f;padding:1rem;display:grid;gap:1rem}.outdoor-map-header{display:flex;align-items:center;justify-content:space-between;gap:1rem}.outdoor-map-header button,.outdoor-map-detail button{border:1px solid #b9a77f;background:#fffaf0;border-radius:.5rem;padding:.55rem .8rem}.eyebrow{margin:0;color:#9b7144;font-size:.7rem;letter-spacing:.12em}.outdoor-map-header h1,.outdoor-map-detail h2{margin:.2rem 0;font-size:1.35rem}.outdoor-map-filters{display:flex;gap:.45rem;overflow:auto}.outdoor-map-filters button{white-space:nowrap;border:1px solid #d5c9ae;border-radius:999px;background:#fffaf0;padding:.4rem .65rem;color:#655b4b}.outdoor-map-filters button.active{background:#8d663d;color:#fff;border-color:#8d663d}.outdoor-map-stage{position:relative;min-height:56vh;overflow:hidden;border:1px solid #d8c9aa;border-radius:1rem;background:#e6ddc7}.outdoor-map-grid{position:absolute;inset:0;background-image:linear-gradient(35deg,transparent 48%,#d1c4a8 49%,transparent 51%),linear-gradient(120deg,transparent 48%,#d1c4a8 49%,transparent 51%);background-size:7rem 7rem;opacity:.7}.outdoor-map-marker{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;gap:.25rem;justify-items:center;border:0;background:transparent;color:#463d2e;font-size:.7rem}.outdoor-map-marker:nth-of-type(3n){left:25%;top:30%}.outdoor-map-marker:nth-of-type(4n){left:75%;top:65%}.outdoor-map-marker.selected{font-weight:700;color:#7c4c2b}.marker-dot{width:1rem;height:1rem;border:3px solid #fff;border-radius:50%;background:#a85e36;box-shadow:0 1px 5px #6e5538}.outdoor-map-empty{position:absolute;inset:0;display:grid;place-content:center;gap:.75rem;text-align:center;color:#766d5f}.outdoor-map-detail{display:flex;align-items:center;justify-content:space-between;border:1px solid #d8c9aa;border-radius:.8rem;background:#fffaf0;padding:.8rem 1rem}.outdoor-map-detail p{margin:.25rem 0;color:#766d5f}
</style>
