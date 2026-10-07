<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { isTourLocale } from '@path-seeker/ts-shared'
import { ArrowLeft, ChevronRight, Focus, Headphones, ListOrdered, MessageCircle, Minus, Navigation, Pause, Pencil, Play, Plus, X } from 'lucide-vue-next'
import RouteMapCanvas from '@/components/routes/RouteMapCanvas.vue'
import { useTourPreviewPlayback } from '@/composables/useTourPreviewPlayback'
import type { CulturalPlaceRecord } from '@/types/cultural-place'
import type { NarrationDetailResponse } from '@/types/narration'
import type { RouteNodeResponse } from '@/types/route'
import type { RouteMapDetail } from '@/types/route-map'

const props = defineProps<{ routeId: string; title: string; locale: string; nodes: RouteNodeResponse[]; selectedStageId: string; narration: NarrationDetailResponse | null; detail: RouteMapDetail | null; canEdit: boolean; places?: CulturalPlaceRecord[] }>()
const emit = defineEmits<{ select: [stageId: string]; edit: [stageId: string] }>()
const canvas = shallowRef<{ zoomBy: (delta: number) => void; fit: () => void; focus: () => void } | null>(null)
const storyOpen = shallowRef(false)
const error = shallowRef('')
const selected = computed(() => props.nodes.find(node => node.stageId === props.selectedStageId) ?? props.nodes[0] ?? null)
const currentIndex = computed(() => props.nodes.findIndex(node => node.stageId === selected.value?.stageId))
const chunks = computed(() => props.narration?.segments?.length
  ? props.narration.segments.map(segment => ({ text: segment.text || '', audioUrl: segment.audioUrl }))
  : [{ text: props.narration?.narrationText || '', audioUrl: props.narration?.audioUrl || null }])
let autoplayStageId = ''
const playback = useTourPreviewPlayback(() => {
  const next = props.nodes[currentIndex.value + 1]
  if (next?.stageId) { autoplayStageId = next.stageId; emit('select', next.stageId) }
})

function play() {
  if (playback.playing.value) playback.pause()
  else if (playback.paused.value) playback.resume()
  else playback.play(chunks.value, isTourLocale(props.locale) ? props.locale : 'zh')
}

function select(id: string) { autoplayStageId = ''; emit('select', id); storyOpen.value = true }
watch(() => props.selectedStageId, id => { playback.stop(); if (id !== autoplayStageId) autoplayStageId = '' })
watch(() => props.routeId, () => { autoplayStageId = ''; storyOpen.value = false; playback.stop() })
watch(() => props.narration, narration => {
  if (autoplayStageId && autoplayStageId === props.selectedStageId && narration) { autoplayStageId = ''; playback.play(chunks.value, isTourLocale(props.locale) ? props.locale : 'zh') }
})
</script>

<template>
  <section class="outdoor-phone" aria-label="户外路线手机预览">
    <div class="phone-screen">
      <div class="phone-status"><span>9:41</span><span>▮▮▮ ▰</span></div><div class="phone-island" />
      <header class="client-head"><button type="button" @click="storyOpen = false; canvas?.fit()"><ArrowLeft class="h-3 w-3" />返回地图</button><strong>{{ title }}</strong><button type="button" @click="autoplayStageId = ''; playback.stop(); storyOpen = false">结束行程</button></header>
      <div class="journey-stage">
        <RouteMapCanvas ref="canvas" :detail="detail" :places="places" :focused-stage-id="selected?.stageId || ''" presentation="workspace" journey @select="select" @edit="canEdit && emit('edit', $event)" @error="error = $event" />
        <p v-if="error || playback.error.value" class="preview-error">{{ error || playback.error.value }}</p>
        <div class="journey-toolbar"><button type="button" aria-label="缩小地图" @click="canvas?.zoomBy(-1)"><Minus class="h-4 w-4" /></button><button type="button" aria-label="查看全线" @click="canvas?.fit()"><Focus class="h-4 w-4" /></button><button type="button" aria-label="定位当前站点" @click="canvas?.focus()"><Navigation class="h-4 w-4" /></button><button type="button" aria-label="放大地图" @click="canvas?.zoomBy(1)"><Plus class="h-4 w-4" /></button><button type="button" aria-label="查看站点内容" @click="storyOpen = !storyOpen"><MessageCircle class="h-4 w-4" /></button></div>
        <aside v-if="storyOpen" class="preview-story"><header><h3><Headphones class="h-4 w-4" />此刻，听这里</h3><button type="button" aria-label="收起内容" @click="storyOpen = false"><X class="h-4 w-4" /></button></header><nav aria-label="途经站点"><button v-for="(node, index) in nodes" :key="node.stageId || index" type="button" :class="{ active: node.stageId === selected?.stageId }" @click="node.stageId && select(node.stageId)" @dblclick="canEdit && node.stageId && emit('edit', node.stageId)">{{ index + 1 }}. {{ node.title }}</button></nav><img v-if="narration?.images?.[0]?.imageUrl" :src="narration.images[0].imageUrl" alt="讲解配图"><h2>{{ selected?.title }}</h2><button type="button" class="preview-play" @click="play"><Pause v-if="playback.playing.value" class="h-3.5 w-3.5" /><Play v-else class="h-3.5 w-3.5" />{{ playback.playing.value ? '暂停' : '播放讲解' }}</button><p v-for="(chunk, index) in chunks" :key="index">{{ chunk.text || '该站点还没有解说词，可在编辑弹窗中补充。' }}</p><button v-if="canEdit" type="button" class="story-edit" :disabled="!selected?.stageId" @click="selected?.stageId && emit('edit', selected.stageId)"><Pencil class="h-3.5 w-3.5" />编辑这一站</button><video v-if="narration?.videoUrl" :src="narration.videoUrl" controls playsinline preload="none" /></aside>
        <footer class="preview-dock"><button type="button" :aria-label="playback.playing.value ? '暂停讲解' : '播放讲解'" @click="play"><Pause v-if="playback.playing.value" class="h-4 w-4" fill="currentColor" /><Play v-else class="h-4 w-4" fill="currentColor" /></button><button type="button" @click="storyOpen = !storyOpen"><small><Headphones class="h-3 w-3" />{{ storyOpen ? '正在查看' : '查看内容' }}</small><span><strong>{{ selected?.title || '选择站点' }}</strong><em>{{ Math.max(0, currentIndex + 1) }} / {{ nodes.length }}</em></span><ChevronRight class="h-3.5 w-3.5" /></button></footer>
      </div>
      <div class="location-bar"><ListOrdered class="h-3.5 w-3.5" /><span>路线预览 · {{ nodes.length }} 个站点</span></div>
    </div>
  </section>
</template>

<style scoped>
.outdoor-phone{height:100%;min-height:0;min-width:0;border:1px solid #373b41;border-radius:34px;background:#20242a;padding:8px;box-shadow:inset 0 0 0 2px #090b0d,0 16px 38px #0006;overflow:hidden}
.phone-screen{position:relative;isolation:isolate;height:100%;display:flex;flex-direction:column;border-radius:27px;background:#f8faf9;color:#2b4039;overflow:hidden}.phone-status{position:absolute;z-index:30;top:9px;left:17px;right:17px;display:flex;justify-content:space-between;font-size:9px}.phone-island{position:absolute;z-index:31;top:7px;left:50%;width:76px;height:18px;transform:translateX(-50%);border-radius:12px;background:#080909}
.client-head{height:62px;flex:none;padding:28px 12px 7px;display:flex;align-items:center;gap:7px;border-bottom:1px solid #e5eae7}.client-head button{display:flex;align-items:center;gap:4px;font-size:10px;white-space:nowrap;color:#183e43}.client-head strong{flex:1;min-width:0;text-align:center;font-size:11px;font-weight:500;color:#617a6b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.journey-stage{position:relative;isolation:isolate;flex:1;min-height:0;overflow:hidden}.journey-toolbar{position:absolute;left:10px;top:48%;z-index:10;display:flex;flex-direction:column;align-items:center;gap:2px;width:40px;padding:4px;border:1px solid #dbe5df;border-radius:13px;background:#fffffff2;box-shadow:0 6px 20px #183e4330;transform:translateY(-50%)}.journey-toolbar button{display:grid;place-items:center;width:30px;height:30px;color:#183e43}
.preview-error{position:absolute;z-index:20;top:10px;left:10px;right:10px;background:#fffef8ed;padding:8px;border-radius:6px;font-size:10px;color:#9b442a}.preview-story{position:absolute;z-index:15;inset:0 0 0 auto;width:88%;overflow:auto;background:#f7faf8;padding:12px 14px 85px;box-shadow:-12px 0 30px #0d252b4d;font-size:12px}.preview-story header{display:flex;align-items:center;justify-content:space-between}.preview-story h3{display:flex;align-items:center;gap:6px;font-size:12px;margin:0}.preview-story h2{font-size:17px;margin:10px 0}.preview-story nav{display:flex;gap:5px;overflow:auto;margin:12px 0}.preview-story nav button{flex-shrink:0;border:1px solid #d4e1d9;border-radius:15px;padding:5px 8px;font-size:10px}.preview-story nav button.active{border-color:#183e43;background:#e4f0ea}.preview-story img,.preview-story video{width:100%;border-radius:10px}.preview-story p{line-height:1.8;white-space:pre-wrap}.preview-play,.story-edit{display:flex;align-items:center;gap:6px;padding:8px 12px;background:#183e43;color:#fff;border-radius:20px;margin:10px 0}.story-edit{background:#e4f0ea;color:#183e43}
.preview-dock{position:absolute;z-index:18;left:10px;bottom:14px;display:flex;overflow:hidden;max-width:calc(100% - 20px);border:1px solid #c8ddd2;border-radius:13px;background:#fffffff5;box-shadow:0 6px 20px #183e4330}.preview-dock>button:first-child{display:grid;place-items:center;width:42px;flex-shrink:0;background:#183e43;color:#fff}.preview-dock>button:last-child{position:relative;display:grid;gap:4px;text-align:left;min-width:0;padding:8px 28px 8px 10px}.preview-dock>button:last-child>svg{position:absolute;right:8px;top:50%;transform:translateY(-50%)}.preview-dock span{display:flex;align-items:center;gap:7px;min-width:0}.preview-dock strong{max-width:125px;font-size:11px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.preview-dock small{display:flex;align-items:center;gap:4px;font-size:9px;color:#647382}.preview-dock em{font-style:normal;font-size:10px;color:#6b8377;white-space:nowrap}.location-bar{display:flex;align-items:center;gap:7px;padding:10px 14px 13px;border-top:1px solid #e5eae7;background:#f8faf9;font-size:10px;color:#587367}
</style>
