<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { isTourLocale } from '@path-seeker/ts-shared'
import RouteMapCanvas from '@/components/routes/RouteMapCanvas.vue'
import { useTourPreviewPlayback } from '@/composables/useTourPreviewPlayback'
import type { NarrationDetailResponse } from '@/types/narration'
import type { RouteNodeResponse } from '@/types/route'
import type { RouteMapDetail } from '@/types/route-map'

const props = defineProps<{ routeId: string; title: string; locale: string; nodes: RouteNodeResponse[]; selectedStageId: string; narration: NarrationDetailResponse | null }>()
const emit = defineEmits<{ select: [stageId: string] }>()
const { request } = useApiClient()
const detail = shallowRef<RouteMapDetail | null>(null)
const storyOpen = shallowRef(false)
const error = shallowRef('')
const selected = computed(() => props.nodes.find(node => node.stageId === props.selectedStageId) ?? props.nodes[0] ?? null)
const currentIndex = computed(() => props.nodes.findIndex(node => node.stageId === selected.value?.stageId))
const chunks = computed(() => props.narration?.segments?.length
  ? props.narration.segments.map(segment => ({ text: segment.text || '', audioUrl: segment.audioUrl }))
  : [{ text: props.narration?.narrationText || '', audioUrl: props.narration?.audioUrl || null }])
let autoplay = false
const playback = useTourPreviewPlayback(() => {
  const next = props.nodes[currentIndex.value + 1]
  if (next?.stageId) { autoplay = true; emit('select', next.stageId) }
})

async function load() {
  try { detail.value = await request<RouteMapDetail>('/api/route-map/get', { query: { routeId: props.routeId } }) }
  catch (caught) { error.value = caught instanceof Error ? caught.message : '地图加载失败。' }
}

function play() {
  if (playback.playing.value) playback.pause()
  else if (playback.paused.value) playback.resume()
  else playback.play(chunks.value, isTourLocale(props.locale) ? props.locale : 'zh')
}

function select(id: string) { autoplay = false; emit('select', id); storyOpen.value = true }
watch(() => props.routeId, () => void load(), { immediate: true })
watch(() => props.selectedStageId, () => playback.stop())
watch(() => props.narration, narration => {
  if (autoplay && narration) { autoplay = false; playback.play(chunks.value, isTourLocale(props.locale) ? props.locale : 'zh') }
})
</script>

<template>
  <div class="outdoor-preview">
    <RouteMapCanvas :detail="detail" :focused-stage-id="selected?.stageId || ''" journey @select="select" @error="error = $event" />
    <header class="preview-top"><span>返回地图</span><strong>{{ title }}</strong><span>结束行程</span></header>
    <p v-if="error || playback.error.value" class="preview-error">{{ error || playback.error.value }}</p>
    <aside v-if="storyOpen" class="preview-story"><header><h3>{{ selected?.title }}</h3><button type="button" @click="storyOpen = false">收起</button></header><nav><button v-for="(node, index) in nodes" :key="node.stageId || index" type="button" @click="node.stageId && select(node.stageId)">{{ index + 1 }}. {{ node.title }}</button></nav><img v-if="narration?.images?.[0]?.imageUrl" :src="narration.images[0].imageUrl" alt="讲解配图"><button type="button" class="preview-play" @click="play">{{ playback.playing.value ? '暂停' : '播放讲解' }}</button><p v-for="(chunk, index) in chunks" :key="index">{{ chunk.text }}</p><video v-if="narration?.videoUrl" :src="narration.videoUrl" controls playsinline preload="none" /></aside>
    <footer class="preview-dock"><button type="button" @click="play">{{ playback.playing.value ? '暂停' : '播放' }}</button><button type="button" @click="storyOpen = !storyOpen"><strong>{{ selected?.title || '选择站点' }}</strong><small>{{ currentIndex + 1 }} / {{ nodes.length }} · 查看内容</small></button></footer>
  </div>
</template>

<style scoped>
.outdoor-preview{position:relative;min-height:480px;height:100%;overflow:hidden;border:7px solid #272b32;border-radius:24px;background:#d9d5c9;color:#263643}.preview-top{position:absolute;left:8px;right:8px;top:12px;display:flex;align-items:center;gap:6px;border-radius:8px;background:#fffef8eb;padding:10px 8px;font-size:9px}.preview-top strong{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.preview-error{position:absolute;top:68px;left:12px;right:12px;background:#fffef8ed;padding:8px;border-radius:6px;font-size:10px}.preview-story{position:absolute;inset:74px 8px 98px 20px;overflow:auto;background:#fffef8f5;padding:12px;border-radius:10px;font-size:12px}.preview-story header{display:flex;justify-content:space-between}.preview-story h3{font-size:16px;margin:0}.preview-story nav{display:flex;gap:5px;overflow:auto;margin:12px 0}.preview-story nav button{flex-shrink:0;border:1px solid #abbcc8;border-radius:15px;padding:5px 8px;font-size:10px}.preview-story img,.preview-story video{width:100%;border-radius:6px}.preview-story p{line-height:1.8;white-space:pre-wrap}.preview-play{padding:8px 12px;background:#263f55;color:#fff;border-radius:6px;margin:10px 0}.preview-dock{position:absolute;left:8px;right:8px;bottom:16px;display:flex;gap:10px;background:#fffef8f5;padding:12px;border-radius:10px}.preview-dock>button:first-child{background:#263f55;color:#fff;border-radius:7px;padding:8px 10px;font-size:11px}.preview-dock>button:last-child{display:grid;gap:4px;text-align:left;min-width:0;flex:1}.preview-dock strong{font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.preview-dock small{font-size:9px;color:#647382}
</style>
