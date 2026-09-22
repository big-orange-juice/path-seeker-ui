<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { ChevronDown, ChevronUp, Headphones, Pause, Play, Video, X } from 'lucide-vue-next'
import PlaceArtwork from '../PlaceArtwork.vue'
import { message } from '../../ride/i18n'
import type { Locale, RideRoute, RideStop } from '../../ride/types'
import type { JourneyPlayback } from '../../ride/progression'

const props = defineProps<{ route: RideRoute; stop: RideStop; next?: RideStop; locale: Locale; playback: JourneyPlayback; speechError?: 'speechError' | 'voiceMissing' }>()
const emit = defineEmits<{ toggle: [] }>()
const collapsed = shallowRef(false)
const expanded = shallowRef(false)
const photoFailed = shallowRef(false)
const videoFailed = shallowRef(false)
const dialog = useTemplateRef<HTMLDialogElement>('videoDialog')
const video = useTemplateRef<HTMLVideoElement>('videoPlayer')
const buttonLabel = computed(() => props.playback.status === 'playing' ? 'pause' : props.playback.status === 'paused' ? 'resume' : 'play')
const statusLabel = computed(() => props.playback.manualPause ? 'paused' : props.playback.finished && !props.next ? 'complete' : 'waiting')
watch(() => props.stop.id, () => { expanded.value = false; photoFailed.value = false; closeVideo() })

function openVideo() {
  if (props.playback.status === 'playing') emit('toggle')
  videoFailed.value = false
  dialog.value?.showModal()
}
function closeVideo() { video.value?.pause(); dialog.value?.close() }
</script>

<template>
  <section class="story-stage" :class="{ collapsed }">
    <img v-if="stop.photo && !photoFailed" class="story-backdrop" :src="stop.photo.url" alt="" @error="photoFailed = true" />
    <PlaceArtwork v-else class="story-backdrop artwork-backdrop" :kind="stop.artwork" :accent="stop.accent" compact />
    <div class="backdrop-shade" />
    <div class="story-stage-inner">
      <p class="story-eyebrow"><Headphones :size="16" />{{ message(locale, 'now') }}<span>{{ route.guideName }}</span></p>
      <article class="story-panel">
        <header class="story-heading"><div><span class="story-style">{{ route.specialty }}</span><h1>{{ stop.name }}</h1></div>
          <button class="collapse-button" :aria-expanded="!collapsed" aria-controls="story-content" :aria-label="message(locale, collapsed ? 'showContent' : 'hideContent')" @click="collapsed = !collapsed"><ChevronDown v-if="collapsed" :size="22" /><ChevronUp v-else :size="22" /></button>
        </header>
        <div v-show="!collapsed" id="story-content" class="story-content">
          <p class="story-text" :class="{ expanded }">{{ stop.intro }}</p>
          <div class="story-links"><button @click="expanded = !expanded" :aria-expanded="expanded">{{ message(locale, expanded ? 'collapse' : 'expand') }}<ChevronUp v-if="expanded" :size="14" /><ChevronDown v-else :size="14" /></button><button v-if="stop.video" @click="openVideo"><Video :size="16" />{{ message(locale, 'video') }}</button></div>
          <p v-if="photoFailed" class="media-error">{{ message(locale, 'photoUnavailable') }}</p>
        </div>
        <footer class="story-player"><button class="play-story" @click="$emit('toggle')" :aria-label="message(locale, buttonLabel)"><Pause v-if="playback.status === 'playing'" :size="21" fill="currentColor" /><Play v-else :size="21" fill="currentColor" /><span>{{ message(locale, buttonLabel) }}</span></button><span class="story-count">{{ playback.current + 1 }} / {{ route.stops.length }}</span></footer>
        <p v-if="speechError" class="playback-note" role="alert">{{ message(locale, speechError) }}</p>
        <p v-else-if="playback.status !== 'playing'" class="playback-note" role="status">{{ message(locale, statusLabel) }}</p>
      </article>
      <p v-if="next" class="next-stop"><span>{{ message(locale, 'next') }}</span><strong>{{ next.name }}</strong></p>
      <div v-if="stop.photo" class="photo-credit"><a :href="stop.photo.source" target="_blank" rel="noopener noreferrer">{{ stop.photo.credit }}</a><a :href="stop.photo.license" target="_blank" rel="noopener noreferrer">↗</a></div>
    </div>
    <dialog ref="videoDialog" class="video-dialog" @click="($event.target === dialog) && closeVideo()" @close="video?.pause()" @cancel="video?.pause()">
      <button class="close-video" :aria-label="message(locale, 'close')" @click="closeVideo"><X :size="22" /></button>
      <video v-if="stop.video" ref="videoPlayer" :src="stop.video.url" :poster="stop.video.poster" controls playsinline preload="none" @error="videoFailed = true"><track kind="captions" /></video>
      <p v-if="videoFailed" role="alert">{{ message(locale, 'videoUnavailable') }}</p>
    </dialog>
  </section>
</template>

<style scoped>
.story-stage{position:relative;isolation:isolate;background:#264d44;overflow:hidden;min-height:420px}.story-backdrop{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-3}.artwork-backdrop{opacity:.55}.backdrop-shade{position:absolute;inset:0;z-index:-2;background:linear-gradient(#123b386b,#183e433d 40%,#173f39b3)}.story-stage-inner{width:min(100%,760px);margin:auto;padding:28px 24px 24px}.story-eyebrow{display:flex;align-items:center;gap:9px;color:white;font-size:12px;letter-spacing:1px;margin:0 0 18px}.story-eyebrow>span{margin-left:auto;letter-spacing:0}.story-panel{background:#fafffbf2;backdrop-filter:blur(14px);border:1px solid #fff;border-radius:24px;padding:26px 30px;box-shadow:0 12px 40px #102d3430}.story-heading{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.story-style{font-size:11px;color:#59786a;line-height:1.6}.story-heading h1{font:600 clamp(24px,4vw,34px)/1.3 var(--display);margin:8px 0 0}.collapse-button{flex-shrink:0;display:grid;place-items:center;width:34px;height:34px;border:1px solid #d5e1d8;border-radius:50%;background:transparent;color:var(--lake)}.story-text{font-size:15px;line-height:1.95;max-height:155px;overflow-y:auto;margin:20px 0 12px;scrollbar-width:thin}.story-text.expanded{max-height:420px}.story-links{display:flex;gap:20px;margin:8px 0 20px}.story-links button{display:flex;align-items:center;gap:5px;border:0;padding:0;background:none;color:#3f6956;font-size:12px}.story-player{display:flex;align-items:center;justify-content:space-between;gap:15px;border-top:1px solid #d3dfd5;padding-top:18px;margin-top:20px}.play-story{display:flex;align-items:center;justify-content:center;gap:12px;padding:13px 21px;background:var(--lake);color:white;border:0;border-radius:30px;font-size:14px}.story-count{font:13px monospace;color:#567163;white-space:nowrap}.playback-note,.media-error{font-size:12px;line-height:1.6;color:#597164;margin:14px 0 0}.next-stop{display:flex;gap:16px;align-items:baseline;color:white;font-size:13px;margin:22px 0 0;line-height:1.5}.next-stop>span{opacity:.75;flex-shrink:0}.next-stop strong{font-weight:500}.photo-credit{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;font-size:10px}.photo-credit a{color:#fff}.collapsed{min-height:0}.collapsed .story-stage-inner{padding-top:20px;padding-bottom:20px}.video-dialog{width:min(90vw,850px);padding:46px 14px 16px;background:#102f30;color:white;border:0;border-radius:18px}.video-dialog::backdrop{background:#0d252bd9}.video-dialog video{width:100%;max-height:70dvh}.close-video{position:absolute;right:10px;top:9px;border:0;background:transparent;color:white}.video-dialog p{font-size:13px}@media(max-width:600px){.story-stage-inner{padding:22px 14px}.story-panel{padding:22px 20px;border-radius:22px}.story-text{font-size:14px;max-height:165px}.story-text.expanded{max-height:350px}.story-heading h1{font-size:27px}.story-eyebrow{font-size:11px}.next-stop{font-size:12px}}
</style>
