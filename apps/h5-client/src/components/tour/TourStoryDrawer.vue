<script setup lang="ts">
import type { ClientTourStop, TourGuideNarration } from '@/types/clientCatalog'
import type { TourMessages } from '@/utils/tourMessages'

defineProps<{ stop: ClientTourStop; narration: TourGuideNarration | null; narrations: TourGuideNarration[]; stops: ClientTourStop[]; playing: boolean; pending: boolean; messages: TourMessages }>()
const emit = defineEmits<{ close: []; play: []; select: [index: number]; guide: [id: string | null]; complete: [] }>()
</script>

<template>
  <aside class="tour-story" :aria-label="stop.name || messages.content">
    <header><h2>{{ stop.name }}</h2><button type="button" @click="emit('close')">{{ messages.close }}</button></header>
    <nav class="tour-stop-tabs"><button v-for="(item, index) in stops" :key="item.id" type="button" :class="{ active: item.id === stop.id }" :disabled="pending" @click="emit('select', index)">{{ item.order }}. {{ item.name }}</button></nav>
    <img v-if="stop.images?.[0]?.url" class="tour-story-cover" :src="stop.images[0].url" :alt="stop.images[0].altText || stop.name || ''">
    <p v-if="stop.images?.[0]?.caption" class="tour-image-caption">{{ stop.images[0].caption }}</p>
    <div class="tour-story-controls"><button type="button" :disabled="!narration?.chapters?.length || pending" @click="emit('play')">{{ playing ? messages.pause : messages.play }}</button><select v-if="narrations.length > 1" :value="narration?.guideId || ''" :aria-label="messages.guide" @change="emit('guide', ($event.target as HTMLSelectElement).value)"><option v-for="item in narrations" :key="item.id" :value="item.guideId || ''">{{ item.guideName }} · {{ item.specialty }}</option></select></div>
    <p v-if="stop.arrivalNote" class="tour-arrival">{{ stop.arrivalNote }}</p>
    <div v-if="narration?.chapters?.length" class="tour-story-text"><section v-for="chapter in narration.chapters" :key="chapter.id || chapter.order"><h3 v-if="chapter.title">{{ chapter.title }}</h3><p>{{ chapter.text }}</p></section></div>
    <p v-else class="tour-story-text">{{ messages.noNarration }}</p>
    <details v-if="stop.video"><summary>{{ messages.video }}</summary><video :src="stop.video" controls playsinline preload="none" /></details>
    <div v-if="(stop.images?.length ?? 0) > 1" class="tour-story-images"><figure v-for="image in stop.images?.slice(1)" :key="image.id"><img v-if="image.url" :src="image.url" :alt="image.altText || ''" loading="lazy"><figcaption v-if="image.caption">{{ image.caption }}</figcaption></figure></div>
    <button class="tour-complete" type="button" :disabled="pending" @click="emit('complete')">{{ messages.complete }}</button>
  </aside>
</template>

<style scoped>
.tour-story{position:absolute;right:12px;top:76px;bottom:105px;z-index:6;width:min(380px,calc(100% - 24px));overflow:auto;overscroll-behavior:contain;border-radius:12px;background:#fffef8f5;color:#273744;padding:16px;box-shadow:0 4px 24px #0003}.tour-story header{display:flex;align-items:center;justify-content:space-between;gap:12px}.tour-story h2{font-size:20px;margin:0}.tour-story header button{font-size:12px;color:#647382}.tour-stop-tabs{display:flex;gap:6px;overflow:auto;margin:14px 0}.tour-stop-tabs button{white-space:nowrap;border:1px solid #bcc8ce;border-radius:20px;padding:6px 10px;font-size:12px}.tour-stop-tabs button.active{background:#263f55;color:#fff}.tour-story-cover{width:100%;height:190px;object-fit:cover;border-radius:8px}.tour-image-caption{font-size:11px;color:#69777e;margin:6px 0}.tour-story-controls{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}.tour-story-controls button,.tour-complete{background:#263f55;color:#fff;border-radius:8px;padding:10px 16px;font-size:13px}.tour-story-controls select{max-width:100%;background:#e9ede9;padding:8px;border-radius:6px}.tour-story-text{font-size:14px;line-height:1.9;white-space:pre-wrap}.tour-story-text h3{font-size:16px;margin:16px 0 6px}.tour-arrival{font-size:12px;color:#647382}.tour-story video,.tour-story-images img{width:100%;border-radius:8px}.tour-story summary{font-size:13px;cursor:pointer;margin:12px 0}.tour-story-images figure{margin:16px 0}.tour-story-images figcaption{font-size:11px;color:#69777e}.tour-complete{width:100%;margin-top:18px}.tour-complete:disabled{opacity:.5}
</style>
