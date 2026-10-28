<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore'
import { fetchPostcards, fetchPostcard } from '@/services/postcards'
import type { Postcard } from '@/types/postcard'
import PostcardImage from './PostcardImage.vue'

const auth = useAuthStore()
const cards = shallowRef<Postcard[]>([])
const page = shallowRef(1)
const total = shallowRef(0)
const pending = shallowRef(false)
const error = shallowRef('')
const selected = shallowRef<Postcard | null>(null)
const view = shallowRef<'cards' | 'albums'>('cards')
const albums = computed(() => {
  const groups = new Map<string, { id: string; title: string; cards: Postcard[] }>()
  for (const card of cards.value) { if (!groups.has(card.visitId)) groups.set(card.visitId, { id: card.visitId, title: card.routeTitle, cards: [] }); groups.get(card.visitId)!.cards.push(card) }
  return [...groups.values()]
})
let version = 0
async function load(more = false) {
  if (!auth.isAccountLoggedIn || pending.value) return
  const token = version
  pending.value = true; error.value = ''
  try { const data = await fetchPostcards(more ? page.value + 1 : 1); if (token !== version) return; cards.value = more ? [...cards.value, ...data.list] : data.list; page.value = data.page; total.value = data.total }
  catch (e) { if (token === version) error.value = e instanceof Error ? e.message : '明信片加载失败' }
  finally { if (token === version) pending.value = false }
}
async function open(card: Postcard) {
  const token = version
  try { const latest = await fetchPostcard(card.id); if (token !== version) return; cards.value = cards.value.map(item => item.id === latest.id ? latest : item); selected.value = latest }
  catch (e) { if (token === version) error.value = e instanceof Error ? e.message : '明信片加载失败' }
}
watch(() => [auth.profile?.id, auth.isAccountLoggedIn], () => { version++; pending.value = false; cards.value = []; selected.value = null; void load() }, { immediate: true })
onBeforeUnmount(() => { version++ })
</script>

<template>
  <section class="postcard-history client-panel p-4">
    <div class="history-heading"><h2>我的电子明信片</h2><button v-if="auth.isAccountLoggedIn" type="button" :disabled="pending" @click="load()">刷新</button></div>
    <p v-if="!auth.isAccountLoggedIn" class="hint">注册或登录后，生成的电子明信片会保存在这里。</p>
    <template v-else>
      <nav class="history-tabs" aria-label="明信片视图"><button type="button" :aria-pressed="view === 'cards'" @click="view = 'cards'">明信片</button><button type="button" :aria-pressed="view === 'albums'" @click="view = 'albums'">路线旅行册</button></nav>
      <p v-if="error" role="alert">{{ error }} <button type="button" @click="load()">重试</button></p>
      <p v-if="pending && !cards.length" role="status">正在取出你的旅行记忆…</p>
      <p v-else-if="!cards.length && !error" class="hint">还没有明信片。在开放制作的景点，留下你的第一张。</p>
      <div v-if="view === 'cards'" class="history-grid"><article v-for="card in cards" :key="card.id" class="history-card"><PostcardImage v-if="card.status === 'completed'" :id="card.id" :title="card.stageTitle" thumbnail /><button type="button" class="card-open" @click="open(card)"><span class="card-stamp">寻迹 · 留影</span><strong>{{ card.stageTitle }}</strong><span>{{ card.routeTitle }}</span><small>{{ new Date(card.createdAt).toLocaleDateString() }} · {{ card.status === 'completed' ? '查看明信片' : card.status === 'failed' ? '生成失败' : '查看生成进度' }}</small></button></article></div>
      <div v-else class="album-list"><details v-for="album in albums" :key="album.id"><summary>{{ album.title }} · {{ album.cards.length }} 张</summary><button v-for="card in album.cards" :key="card.id" type="button" @click="open(card)">{{ card.stageTitle }} →</button></details></div>
      <p v-if="view === 'albums' && cards.length < total" class="hint">已载入 {{ cards.length }} / {{ total }} 张，继续加载可补齐旅行册。</p>
      <button v-if="cards.length < total" type="button" :disabled="pending" @click="load(true)">{{ pending ? '正在加载…' : '加载更多' }}</button>
    </template>
    <div v-if="selected" class="history-overlay" @click.self="selected = null"><section role="dialog" aria-modal="true" aria-label="明信片详情" class="history-detail"><header><h3>{{ selected.stageTitle }}</h3><button type="button" @click="selected = null">关闭 ×</button></header><PostcardImage v-if="selected.status === 'completed'" :id="selected.id" :title="selected.stageTitle" /><template v-else><p role="status">{{ selected.error || '正在制作，稍后再来看看。' }}</p><button type="button" @click="open(selected!)">刷新进度</button></template><p>{{ selected.caption }}</p></section></div>
  </section>
</template>

<style scoped>
.postcard-history{background:#fffef8;color:#243d37;border:1px solid #d4dfd3;box-shadow:none;color-scheme:light}
.card-open{display:grid;gap:10px;text-align:left}.history-card:focus-within{outline:2px solid #246859;outline-offset:2px}
.history-heading,.history-detail header{display:flex;justify-content:space-between;gap:12px;align-items:center}.history-heading h2{font-size:16px;font-weight:500}.postcard-history button{min-height:36px;color:#246859}.hint{font-size:13px;color:#687b72;margin-top:12px}.history-tabs{display:flex;gap:16px;margin:12px 0}.history-tabs button[aria-pressed=true]{border-bottom:2px solid #246859}.history-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:12px}.history-card{display:grid;gap:10px;text-align:left;padding:16px;background:#f5f8f1;border:1px solid #d4dfd3;border-radius:8px;overflow-wrap:anywhere}.history-card span,.history-card small{font-size:12px}.card-stamp{color:#8d7150;font-family:serif;letter-spacing:2px}.album-list details{padding:12px 0;border-bottom:1px solid #d4dfd3}.album-list button{display:block;margin:6px 0}.history-overlay{position:fixed;inset:0;z-index:80;background:#183d3b77;padding:16px;display:grid;place-items:center}.history-detail{background:#fffef8;border-radius:14px;padding:20px;width:min(460px,100%);max-height:90dvh;overflow:auto}.history-detail h3{margin:0;font-size:20px}.history-detail header{margin-bottom:16px}
</style>
