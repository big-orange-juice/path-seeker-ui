<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Clock3, MapPin } from 'lucide-vue-next'
import ShellHallPage from '@/pages/ShellHallPage.vue'
import { useVenueStore } from '@/stores/useVenueStore'
import { useMissionStore } from '@/stores/useMissionStore'

const route = useRoute()
const router = useRouter()
const venueStore = useVenueStore()
const missionStore = useMissionStore()
const venueId = computed(() => String(route.params.venueId || '').trim())
const venue = computed(() => venueStore.current?.id === venueId.value ? venueStore.current : null)

async function load() {
  const next = await venueStore.loadOne(venueId.value)
  if (next && (next.venueType === 2 || next.venueType === 3)) {
    await router.replace(`/museums/${encodeURIComponent(next.id)}/map`)
    return
  }
  if (next) await missionStore.ensureRouteCards({ museumId: next.id, force: true })
}
onMounted(() => void load())
watch(venueId, () => void load())
</script>

<template>
  <section v-if="venue" class="venue-detail">
    <article class="venue-hero">
      <img v-if="venue.coverImageUrl" :src="venue.coverImageUrl" :alt="venue.name">
      <div class="venue-hero-copy"><p>展馆</p><h2>{{ venue.name }}</h2><div class="venue-meta"><span v-if="venue.openingHours"><Clock3 />{{ venue.openingHours }}</span><span v-if="venue.address"><MapPin />{{ venue.address }}</span></div><details v-if="venue.intro"><summary>了解展馆</summary><p>{{ venue.intro }}</p></details></div>
    </article>
    <div class="route-heading"><div><p>推荐路线</p><h3>沿着故事开始探索</h3></div><span>{{ missionStore.routeTotal }} 条路线</span></div>
    <ShellHallPage />
  </section>
  <div v-else-if="venueStore.pending" class="venue-detail-state">正在加载地点详情…</div>
  <div v-else class="venue-detail-state"><p>{{ venueStore.error || '地点不存在' }}</p><button type="button" @click="router.push('/venues')">返回探索地点</button></div>
</template>

<style scoped>
.venue-detail{display:grid;gap:1.4rem}.venue-hero{position:relative;min-height:18rem;overflow:hidden;border:1px solid rgba(213,173,98,.22);border-radius:1.2rem;background:radial-gradient(circle at 70% 20%,#49391f,#15120e 68%)}.venue-hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.68}.venue-hero:after{position:absolute;inset:0;content:"";background:linear-gradient(180deg,rgba(7,6,5,.1),rgba(7,6,5,.95) 78%)}.venue-hero-copy{position:relative;z-index:1;display:flex;min-height:18rem;flex-direction:column;justify-content:flex-end;padding:1.2rem}.venue-hero-copy>p,.route-heading p{margin:0;color:#dfb76c;font-size:.7rem;letter-spacing:.14em}.venue-hero h2{margin:.35rem 0 .55rem;font-family:var(--font-display);font-size:1.75rem;font-weight:500}.venue-meta{display:flex;flex-wrap:wrap;gap:.45rem 1rem;color:rgba(255,248,233,.7);font-size:.75rem}.venue-meta span{display:flex;align-items:flex-start;gap:.35rem}.venue-meta svg{width:.85rem;height:.85rem;flex:none;margin-top:.1rem}.venue-hero details{margin-top:.8rem;color:rgba(255,248,233,.72);font-size:.78rem}.venue-hero details p{margin:.55rem 0 0;line-height:1.65}.route-heading{display:flex;align-items:end;justify-content:space-between;border-bottom:1px solid rgba(255,248,230,.1);padding-bottom:.7rem}.route-heading h3{margin:.22rem 0 0;font-size:1.12rem}.route-heading>span{color:var(--muted-foreground);font-size:.75rem}.venue-detail-state{display:grid;min-height:20rem;place-content:center;gap:.8rem;text-align:center;color:var(--muted-foreground)}.venue-detail-state button{color:#dfb76c}
</style>
