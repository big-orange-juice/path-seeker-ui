<script setup lang="ts">
import { computed, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { ChevronDown, ChevronUp, Headphones, Pause, Play, Video, X } from 'lucide-vue-next'
import PlaceArtwork from '../PlaceArtwork.vue'
import { message } from '../../ride/i18n'
import type { Locale, RideRoute, RideStop } from '../../ride/types'
import type { JourneyPlayback } from '../../ride/progression'

const props = defineProps<{ route: RideRoute; stop: RideStop; next?: RideStop; locale: Locale; playback: JourneyPlayback; speechError?: 'speechError' | 'voiceMissing' }>()
const emit = defineEmits<{ toggle: []; select: [id: string] }>()
const open = defineModel<boolean>('open', { default: false })
const expanded = shallowRef(false)
const photoFailed = shallowRef(false)
const videoFailed = shallowRef(false)
const dialog = useTemplateRef<HTMLDialogElement>('videoDialog')
const video = useTemplateRef<HTMLVideoElement>('videoPlayer')
const buttonLabel = computed(() => props.playback.status === 'playing' ? 'pause' : props.playback.status === 'paused' ? 'resume' : 'play')
const statusLabel = computed(() => props.playback.manualPause ? 'paused' : props.playback.finished && !props.next ? 'complete' : 'waiting')
watch(() => props.stop.id, () => { expanded.value = false; photoFailed.value = false; closeVideo() })
watch(open, value => {
  if (value) window.addEventListener('keydown', onKey)
  else { window.removeEventListener('keydown', onKey); closeVideo() }
})
onUnmounted(() => window.removeEventListener('keydown', onKey))

function close() { open.value = false }
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') close() }
function openVideo() {
  if (props.playback.status === 'playing') emit('toggle')
  videoFailed.value = false
  dialog.value?.showModal()
}
function closeVideo() { video.value?.pause(); dialog.value?.close() }
</script>

<template>
  <aside id="story-layer" class="story-panel" :class="{ open }" role="dialog" :aria-label="message(locale, 'now')">
        <header class="story-head">
          <div class="story-head-main"><span class="story-eyebrow"><Headphones :size="15" />{{ message(locale, 'now') }}</span><button class="story-close" :aria-label="message(locale, 'hideContent')" @click="close"><X :size="18" /></button></div>
          <nav class="story-stops" :aria-label="message(locale, 'stops')">
            <button v-for="(item, index) in route.stops" :key="item.id" type="button" :class="{ active: item.id === stop.id }" :aria-current="item.id === stop.id ? 'step' : undefined" @click="emit('select', item.id)"><span>{{ index + 1 }}</span>{{ item.name }}</button>
          </nav>
        </header>
        <div class="story-body">
          <figure class="story-photo">
            <img v-if="stop.photo && !photoFailed" :src="stop.photo.url" alt="" @error="photoFailed = true" />
            <PlaceArtwork v-else class="story-artwork" :kind="stop.artwork" :accent="stop.accent" compact />
            <div class="photo-shade" />
            <figcaption><span>{{ route.specialty }}</span><h2>{{ stop.name }}</h2></figcaption>
            <span v-if="stop.photo" class="photo-credit"><a :href="stop.photo.source" target="_blank" rel="noopener noreferrer">{{ stop.photo.credit }}</a><a :href="stop.photo.license" target="_blank" rel="noopener noreferrer">↗</a></span>
          </figure>
          <button class="story-play" :aria-label="message(locale, buttonLabel)" @click="$emit('toggle')"><Pause v-if="playback.status === 'playing'" :size="15" fill="currentColor" /><Play v-else :size="15" fill="currentColor" /><span>{{ message(locale, buttonLabel) }}</span></button>
          <p class="story-text" :class="{ expanded }">{{ stop.intro }}</p>
          <div class="story-links"><button @click="expanded = !expanded" :aria-expanded="expanded">{{ message(locale, expanded ? 'collapse' : 'expand') }}<ChevronUp v-if="expanded" :size="14" /><ChevronDown v-else :size="14" /></button><button v-if="stop.video" @click="openVideo"><Video :size="16" />{{ message(locale, 'video') }}</button></div>
          <p v-if="photoFailed" class="media-error">{{ message(locale, 'photoUnavailable') }}</p>
          <p v-if="speechError" class="playback-note" role="alert">{{ message(locale, speechError) }}</p>
          <p v-else-if="playback.status !== 'playing'" class="playback-note" role="status">{{ message(locale, statusLabel) }}</p>
          <p v-if="next" class="next-stop"><span>{{ message(locale, 'next') }}</span><strong>{{ next.name }}</strong></p>
        </div>
  </aside>
  <dialog ref="videoDialog" class="video-dialog" @click="($event.target === dialog) && closeVideo()" @close="video?.pause()" @cancel="video?.pause()">
    <button class="close-video" :aria-label="message(locale, 'close')" @click="closeVideo"><X :size="22" /></button>
    <video v-if="stop.video" ref="videoPlayer" :src="stop.video.url" :poster="stop.video.poster" controls playsinline preload="none" @error="videoFailed = true"><track kind="captions" /></video>
    <p v-if="videoFailed" role="alert">{{ message(locale, 'videoUnavailable') }}</p>
  </dialog>
</template>

<style scoped>
.story-panel{position:absolute;right:0;top:0;bottom:0;z-index:7;display:flex;flex-direction:column;width:min(86%,430px);background:#f7faf8;box-shadow:-16px 0 44px #0d252b4d;transform:translateX(101%);visibility:hidden;transition:transform .26s ease,visibility 0s linear .26s}.story-panel.open{transform:translateX(0);visibility:visible;transition:transform .26s ease}.story-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 10px 12px 18px;border-bottom:1px solid #dbe5df}.story-eyebrow{display:flex;align-items:center;gap:8px;color:var(--lake);font-size:11.5px;letter-spacing:.5px}.story-count{font:11px monospace;color:#6b8377}.story-close{display:grid;place-items:center;width:34px;height:34px;border:0;background:none;color:var(--lake)}.story-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px 16px max(20px,env(safe-area-inset-bottom))}.story-photo{position:relative;isolation:isolate;margin:0 0 14px;height:min(38dvh,260px);min-height:170px;border-radius:14px;overflow:hidden;background:#dfe9e4}.story-photo img,.story-photo .story-artwork{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.photo-shade{position:absolute;inset:0;background:linear-gradient(#123b3800 40%,#173f39cc)}.story-photo figcaption{position:absolute;left:0;right:0;bottom:0;padding:14px 16px;color:white}.story-photo figcaption span{font-size:11px;letter-spacing:.5px;opacity:.88}.story-photo figcaption h2{margin:5px 0 0;font:600 clamp(20px,5.6vw,24px)/1.3 var(--display)}.photo-credit{position:absolute;right:10px;top:9px;display:flex;gap:8px;font-size:10px}.photo-credit a{color:#ffffffd9}.story-play{display:flex;align-items:center;gap:7px;margin:0 0 12px;padding:9px 15px;border:0;border-radius:30px;background:var(--lake);color:white;font-size:12px}.story-text{font-size:13.5px;line-height:1.8;margin:0 0 8px;max-height:200px;overflow-y:auto;scrollbar-width:thin}.story-text.expanded{max-height:none}.story-links{display:flex;gap:18px;margin:0 0 10px}.story-links button{display:flex;align-items:center;gap:5px;border:0;padding:0;background:none;color:#3f6956;font-size:12px}.playback-note,.media-error{font-size:11px;line-height:1.6;color:#597164;margin:8px 0 0}.next-stop{display:flex;gap:12px;align-items:baseline;margin:14px 0 0;padding-top:12px;border-top:1px solid #e2ebe5;font-size:12px;color:#4f6b5d}.next-stop strong{font-weight:600;color:var(--ink)}.video-dialog{width:min(90vw,850px);padding:46px 14px 16px;background:#102f30;color:white;border:0;border-radius:18px}.video-dialog::backdrop{background:#0d252bd9}.video-dialog video{width:100%;max-height:70dvh}.close-video{position:absolute;right:10px;top:9px;border:0;background:transparent;color:white}.video-dialog p{font-size:13px}@media(max-width:760px){.story-body{padding-bottom:max(86px,env(safe-area-inset-bottom))}}
</style>

<style scoped>
.story-head{padding:10px 10px 8px 18px!important;display:block!important}
.story-head-main{display:flex;align-items:center;justify-content:space-between;gap:12px}
.story-stops{display:flex;gap:6px;overflow-x:auto;padding:8px 0 2px;scrollbar-width:none}
.story-stops::-webkit-scrollbar{display:none}
.story-stops button{display:flex;align-items:center;gap:5px;flex:0 0 auto;max-width:150px;padding:6px 9px;border:1px solid #d4e1d9;border-radius:999px;background:white;color:#5c776a;font-size:10px;white-space:nowrap}
.story-stops button span{display:grid;place-items:center;width:17px;height:17px;border-radius:50%;background:#e6eee8;font:10px monospace}
.story-stops button.active{border-color:var(--lake);background:#e4f0ea;color:var(--lake);font-weight:700}
.story-stops button.active span{background:var(--lake);color:white}
</style>
