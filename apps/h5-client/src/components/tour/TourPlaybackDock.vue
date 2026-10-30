<script setup lang="ts">
import { computed } from 'vue'
import { Headphones, ListMusic, MapPin, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward } from 'lucide-vue-next'
import type { TourMessages } from '@/utils/tourMessages'

const props = defineProps<{
  title: string
  itemTitle: string
  stopIndex: number
  stopCount: number
  playing: boolean
  playLabel: string
  canPlay: boolean
  canSeek: boolean
  canPrevious: boolean
  canNext: boolean
  pending: boolean
  playedSeconds: number
  durationSeconds: number
  queuedCount: number
  queueOpen: boolean
  tracking: boolean
  locationStatus: string
  hasRoom: boolean
  messages: TourMessages
}>()

const emit = defineEmits<{
  play: []
  previous: []
  next: []
  seek: [seconds: number]
  seekTo: [seconds: number]
  content: []
  queue: []
  tracking: []
  room: []
}>()
const progress = computed(() => props.durationSeconds > 0 ? Math.min(100, props.playedSeconds / props.durationSeconds * 100) : 0)
function clock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
function seekTo(event: Event) {
  emit('seekTo', Number((event.target as HTMLInputElement).value) / 100 * props.durationSeconds)
}
</script>

<template>
  <section class="tour-playback-dock" :aria-label="messages.playbackProgress">
    <div class="dock-modes">
      <button type="button" class="dock-room" @click="emit('room')"><Headphones :size="16" aria-hidden="true" /><span>{{ hasRoom ? messages.commentaryRoom : messages.liveCommentary }}</span><span v-if="hasRoom" class="dock-live-dot" aria-hidden="true" /></button>
      <button type="button" class="dock-nearby" :class="{ 'is-active': tracking }" :aria-pressed="tracking" :aria-label="tracking ? messages.stopLocate : messages.locate" :title="locationStatus" :disabled="pending" @click="emit('tracking')"><MapPin :size="14" aria-hidden="true" /><span>{{ tracking ? messages.locationReady : messages.locate }}</span><span class="dock-switch" aria-hidden="true" /></button>
    </div>
    <p v-if="locationStatus !== messages.locationReady && locationStatus !== messages.locationOff" class="dock-location-note" role="status">{{ locationStatus }}</p>
    <div class="dock-main">
      <button type="button" class="dock-play" :aria-label="playLabel" :disabled="pending || !canPlay" @click="emit('play')"><Pause v-if="playing" :size="23" aria-hidden="true" /><Play v-else :size="23" aria-hidden="true" /></button>
      <button type="button" class="dock-story" :aria-label="messages.content" @click="emit('content')"><small>{{ stopIndex + 1 }} / {{ stopCount }} · {{ playing ? messages.playingNow : messages.content }}</small><strong>{{ title }}</strong><span v-if="itemTitle">{{ itemTitle }}</span></button>
      <button type="button" class="dock-queue" :class="{ 'is-active': queueOpen }" :aria-label="messages.queueTitle" :aria-expanded="queueOpen" @click="emit('queue')"><ListMusic :size="21" aria-hidden="true" /><span>{{ queuedCount }}</span></button>
    </div>
    <div class="dock-timeline"><span>{{ clock(playedSeconds) }}</span><input type="range" min="0" max="100" step="0.1" :value="progress" :style="{ '--played': `${progress}%` }" :disabled="!canSeek || pending" :aria-label="messages.playbackProgress" @change="seekTo" /><span>{{ clock(durationSeconds) }}</span></div>
    <div class="dock-transport">
      <button type="button" :disabled="pending || !canPrevious" :aria-label="messages.prevStop" @click="emit('previous')"><SkipBack :size="17" aria-hidden="true" /><span>{{ messages.prevStop }}</span></button>
      <button type="button" :disabled="pending || !canSeek" :aria-label="messages.rewind15" @click="emit('seek', -15)"><RotateCcw :size="16" aria-hidden="true" /><span>15</span></button>
      <button type="button" :disabled="pending || !canSeek" :aria-label="messages.forward15" @click="emit('seek', 15)"><span>15</span><RotateCw :size="16" aria-hidden="true" /></button>
      <button type="button" :disabled="pending || !canNext" :aria-label="messages.nextStop" @click="emit('next')"><span>{{ messages.nextStop }}</span><SkipForward :size="17" aria-hidden="true" /></button>
    </div>
  </section>
</template>

<style scoped>
.dock-location-note{margin:8px 0 0;color:#75897d;font-size:11px;line-height:1.6;overflow-wrap:anywhere}
.tour-playback-dock{position:absolute;left:20px;bottom:max(16px,env(safe-area-inset-bottom));z-index:8;box-sizing:border-box;width:min(460px,calc(100% - 40px));padding:0 16px 8px;border:1px solid var(--tour-line);border-radius:24px;background:#fcfefd;box-shadow:0 12px 40px #183e4324;color:var(--tour-lake);font-family:inherit}
.tour-playback-dock button{font-family:inherit;cursor:pointer}.tour-playback-dock button:disabled{opacity:.4;cursor:default}.tour-playback-dock button:focus-visible,.dock-timeline input:focus-visible{outline:2px solid var(--tour-lake);outline-offset:3px}
.dock-modes{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:46px;border-bottom:1px solid #e3ece7}.dock-modes button{display:flex;align-items:center;gap:6px;min-height:44px;padding:4px 0;border:0;background:transparent;color:var(--tour-lake);font-size:11px;line-height:1.4;text-align:left}.dock-room{font-weight:600}.dock-room span,.dock-nearby span{overflow-wrap:anywhere}.dock-nearby{max-width:62%;color:#74877e!important}.dock-nearby.is-active{color:var(--tour-lake)!important}.dock-switch{position:relative;flex:0 0 26px;height:15px;border-radius:10px;background:#cedbd3}.dock-switch::after{position:absolute;top:3px;left:3px;width:9px;height:9px;border-radius:50%;background:#fff;content:''}.is-active .dock-switch{background:#357a68}.is-active .dock-switch::after{left:14px}.dock-live-dot{width:6px;height:6px;flex:0 0 6px;border-radius:50%;background:#3b9279}
.dock-main{display:flex;align-items:center;gap:12px;padding:14px 0 8px}.dock-play{display:grid;place-items:center;flex:0 0 50px;width:50px;height:50px;padding:0;border:0;border-radius:17px;background:var(--tour-lake);color:#fff;box-shadow:0 4px 12px #183e4320}.dock-story{display:grid;gap:3px;min-width:0;flex:1;padding:0;border:0;background:transparent;color:var(--tour-lake);text-align:left}.dock-story small{color:#71867a;font-size:10px;line-height:1.4}.dock-story strong{overflow:hidden;font:600 18px/1.4 var(--tour-display);text-overflow:ellipsis;white-space:nowrap}.dock-story>span{overflow:hidden;color:#74877e;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.dock-queue{display:flex;align-items:center;justify-content:center;gap:5px;min-width:48px;min-height:44px;padding:8px;border:0;border-radius:12px;background:#edf4ef;color:var(--tour-lake)}.dock-queue span{font-size:11px;font-variant-numeric:tabular-nums}.dock-queue.is-active{background:var(--tour-lake);color:#fff}
.dock-timeline{display:flex;align-items:center;gap:9px;color:#71867a;font-size:10px;font-variant-numeric:tabular-nums}.dock-timeline input{flex:1;min-width:0;height:24px;margin:0;appearance:none;background:transparent;cursor:pointer}.dock-timeline input::-webkit-slider-runnable-track{height:3px;border-radius:3px;background:linear-gradient(to right,#3f7e6f var(--played),#dfe9e3 var(--played))}.dock-timeline input::-webkit-slider-thumb{width:10px;height:10px;margin-top:-3.5px;appearance:none;border:2px solid #fff;border-radius:50%;background:#3f7e6f;box-shadow:0 0 0 1px #3f7e6f}.dock-timeline input::-moz-range-track{height:3px;border-radius:3px;background:#dfe9e3}.dock-timeline input::-moz-range-progress{height:3px;background:#3f7e6f}.dock-timeline input::-moz-range-thumb{width:8px;height:8px;border:2px solid #fff;border-radius:50%;background:#3f7e6f}.dock-timeline input:disabled{opacity:.5;cursor:default}
.dock-transport{display:grid;grid-template-columns:1.5fr 1fr 1fr 1.5fr;gap:4px}.dock-transport button{display:flex;align-items:center;justify-content:center;gap:5px;min-height:40px;padding:4px;border:0;border-radius:10px;background:transparent;color:#536f62;font-size:11px;line-height:1.3}.dock-transport button:hover{background:#edf4ef}
@media(max-width:760px){.tour-playback-dock{left:12px;width:calc(100% - 24px);padding:0 14px 6px;border-radius:22px}.dock-main{padding-top:12px}.dock-story strong{font-size:17px}.dock-modes button{font-size:10px}.dock-nearby{max-width:60%}.dock-transport button{min-height:44px}}
@media(max-height:600px){.dock-main{padding-top:8px}.dock-story>span{display:none}.dock-modes{min-height:40px}.dock-transport button{min-height:36px}.dock-location-note{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}}
</style>
