<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import { fetchHeritageAsset } from "@/services/outdoorMap"
import { resolveHeritageAssetTypeName } from "@path-seeker/ts-shared"
import type { HeritageAssetDetail } from "@path-seeker/ts-shared"

const route = useRoute()
const router = useRouter()
const asset = shallowRef<HeritageAssetDetail | null>(null)
const error = shallowRef("")
const assetId = computed(() => String(route.params.assetId || "").trim())
const museumId = computed(() => String(route.params.museumId || asset.value?.museumId || "").trim())

onMounted(async () => {
  try { asset.value = await fetchHeritageAsset(assetId.value) }
  catch (caught) { error.value = caught instanceof Error ? caught.message : "文化资产加载失败" }
})
</script>

<template>
  <main class="asset-page">
    <button type="button" class="back" @click="router.back()">返回</button>
    <p v-if="error" class="state">{{ error }}</p>
    <article v-else-if="asset">
      <img v-if="asset.imageUrl" :src="asset.imageUrl" :alt="asset.name" class="cover">
      <div class="content">
        <p class="type">{{ resolveHeritageAssetTypeName(asset.assetType) }}</p><h1>{{ asset.name }}</h1><p class="description">{{ asset.description || '暂无详细介绍' }}</p>
        <dl><template v-if="asset.constructionYearText"><dt>建造年代</dt><dd>{{ asset.constructionYearText }}</dd></template><template v-if="asset.currentFunction"><dt>当前功能</dt><dd>{{ asset.currentFunction }}</dd></template><template v-if="asset.protectionLevel"><dt>保护级别</dt><dd>{{ asset.protectionLevel }}</dd></template><template v-if="asset.addressText"><dt>地址</dt><dd>{{ asset.addressText }}</dd></template></dl>
        <button v-if="museumId" type="button" class="map-link" @click="router.push({ path: `/museums/${museumId}/map`, query: { assetId: asset.id } })">在景区地图中查看</button>
      </div>
    </article>
    <p v-else class="state">正在加载文化资产…</p>
  </main>
</template>

<style scoped>
.asset-page{min-height:100vh;background:#f5f1e8;color:#29261f;padding:1rem}.back,.map-link{border:1px solid #b9a77f;border-radius:.55rem;background:#fffaf0;padding:.55rem .8rem}.cover{width:100%;height:38vh;object-fit:cover;border-radius:1rem;margin-top:1rem}.content{padding:1.2rem .25rem}.type{color:#9b7144;font-size:.75rem;letter-spacing:.1em}.content h1{font-size:1.8rem;margin:.4rem 0}.description{line-height:1.8;color:#665e51}.content dl{display:grid;grid-template-columns:5rem 1fr;gap:.65rem;margin:1.2rem 0}.content dt{color:#8a7c66}.content dd{margin:0}.state{display:grid;min-height:70vh;place-content:center;color:#766d5f}
</style>
