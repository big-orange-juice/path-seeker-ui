<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Map, Building2 } from 'lucide-vue-next'
import { useVenueStore } from '@/stores/useVenueStore'

const router = useRouter()
const store = useVenueStore()
const hasVenues = computed(() => store.venues.length > 0)

function venueTypeName(type: number) {
  return type === 2 ? '古镇' : type === 3 ? '景区' : '展馆'
}
function openVenue(id: string, type: number) {
  const target = type === 2 || type === 3 ? `/museums/${encodeURIComponent(id)}/map` : `/venues/${encodeURIComponent(id)}`
  void router.push(target)
}
onMounted(() => { if (!store.venues.length) void store.loadAll() })
</script>

<template>
  <section class="venue-explorer">
    <header class="venue-intro"><p>选择一处地点</p><h2>今天，去哪里探索？</h2><span>展馆从故事开始，古镇从地图开始。</span></header>
    <p v-if="store.error && hasVenues" class="venue-error">刷新失败，仍显示上次内容。</p>
    <div v-if="hasVenues" class="venue-grid">
      <button v-for="venue in store.venues" :key="venue.id" type="button" class="venue-card" @click="openVenue(venue.id, venue.venueType)">
        <img v-if="venue.coverImageUrl" :src="venue.coverImageUrl" :alt="venue.name">
        <div v-else class="venue-placeholder"><Map v-if="venue.venueType !== 1" /><Building2 v-else /></div>
        <div class="venue-shade"><span>{{ venueTypeName(venue.venueType) }}</span><h3>{{ venue.name }}</h3><p>{{ venue.address || venue.openingHours || '查看地点详情' }}</p></div>
      </button>
    </div>
    <div v-else-if="store.pending" class="venue-state">正在加载地点…</div>
    <div v-else class="venue-state"><p>{{ store.error || '暂无可探索地点' }}</p><button type="button" @click="store.loadAll">重新加载</button></div>
  </section>
</template>

<style scoped>
.venue-explorer{display:grid;gap:1.2rem;padding-bottom:.5rem}.venue-intro p{margin:0;color:#d5ad62;font-size:.72rem;letter-spacing:.16em}.venue-intro h2{margin:.35rem 0 0;font-family:var(--font-display);font-size:1.8rem;font-weight:500}.venue-intro span{display:block;margin-top:.45rem;color:var(--muted-foreground);font-size:.82rem}.venue-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}.venue-card{position:relative;min-height:13.5rem;overflow:hidden;border:1px solid rgba(213,173,98,.22);border-radius:1rem;background:#17140f;text-align:left}.venue-card img,.venue-placeholder{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.venue-placeholder{display:grid;place-items:center;background:radial-gradient(circle at 60% 20%,#4e3e22,#16130f 64%);color:#d5ad62}.venue-placeholder svg{width:2.4rem;height:2.4rem}.venue-shade{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:1rem;background:linear-gradient(180deg,transparent 25%,rgba(9,8,6,.94))}.venue-shade span{align-self:flex-start;border:1px solid rgba(231,195,124,.45);border-radius:999px;padding:.2rem .45rem;color:#e7c37c;font-size:.65rem}.venue-shade h3{margin:.55rem 0 .2rem;color:#fff8e9;font-size:1.05rem}.venue-shade p{margin:0;overflow:hidden;color:rgba(255,248,233,.65);font-size:.72rem;text-overflow:ellipsis;white-space:nowrap}.venue-state{display:grid;min-height:16rem;place-content:center;gap:.75rem;text-align:center;color:var(--muted-foreground)}.venue-state button{color:#d5ad62}.venue-error{color:#dfb76c;font-size:.75rem}
</style>
