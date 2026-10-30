<script setup lang="ts">
import { computed } from 'vue'
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-vue-next'
import type { ClientTourStop, TourGuideNarration } from '@/types/clientCatalog'
import type { TourMessages } from '@/utils/tourMessages'
import TourImageCarousel from './TourImageCarousel.vue'

/**
 * 站点内容抽屉（方案 §3、§4.1）：
 * - 控制行的播放／暂停与 ±15 秒与底部迷你控制条**同源**：都由父级下发的 speech 状态与 seekBy 驱动；
 * - 抽屉展示的节点可能是"接近但还没切站"的节点（matchesPlaying=false），此时播放控制仍作用于正在播放的节点；
 */
const props = defineProps<{
  stop: ClientTourStop | null
  narration: TourGuideNarration | null
  narrations: TourGuideNarration[]
  stops: ClientTourStop[]
  playing: boolean
  paused: boolean
  pending: boolean
  messages: TourMessages
  /** 浏览器阻止自动播放，等待用户点击"继续播放" */
  blocked: boolean
  /** 系统语音按句恢复，位置为近似值 */
  restoreApproximate: boolean
  playingLabel: string | null
  /** 抽屉展示的节点是否就是正在播放的节点 */
  matchesPlaying: boolean
  /** 正在播放的节点名称（抽屉展示别的节点时用于提示） */
  playingStopName: string | null
  /** 是否处于"上一／下一节点"浏览模式 */
  browsing: boolean
  /** 当前条目是否可定位（队列空闲时置灰 ±15 秒） */
  canSeek: boolean
  /** 已播秒数与总时长，用于展示进度（系统语音无精确时长时总时长为 0） */
  playedSeconds: number
  durationSeconds: number
}>()
const emit = defineEmits<{
  close: []
  play: []
  keepPlaying: []
  replay: []
  seek: [deltaSeconds: number]
  select: [index: number]
  guide: [id: string | null]
  contentLock: [value: boolean]
  postcard: []
  playVideo: []
}>()

const extraAudios = computed(() => props.stop?.extraAudios ?? [])
const hasPlayableChapter = computed(() => Boolean(props.narration?.chapters?.length))
const hasPlayableExtra = computed(() => extraAudios.value.some(item => item.url))
// 整站播放包含额外音频、讲解章节与节点视频。
const canPlay = computed(() => hasPlayableChapter.value || Boolean(props.stop?.video) || hasPlayableExtra.value)
/** 播放主按钮：展示别的节点时是"进入本节点播放"，同节点时是播放/暂停切换 */
const playLabel = computed(() => {
  if (!props.matchesPlaying) return props.messages.enterStopPlay
  if (props.playing) return props.messages.pause
  if (props.paused) return props.messages.resume
  return props.messages.play
})
const seekDisabled = computed(() => props.pending || !props.matchesPlaying || !props.canSeek)
const progressText = computed(() => {
  if (!props.matchesPlaying || props.durationSeconds <= 0) return ''
  return `${formatSeconds(props.playedSeconds)} / ${formatSeconds(props.durationSeconds)}`
})

function formatSeconds(value: number) {
  const total = Math.max(0, Math.floor(value))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function stopNumber(order: number) {
  return String(order).padStart(2, '0')
}
</script>

<template>
  <aside v-if="stop" class="tour-story" role="dialog" aria-modal="false" :aria-label="stop.name || messages.content">
    <header><h2>{{ stop.name }}</h2><button type="button" @click="emit('close')">{{ messages.close }}</button></header>
    <div class="tour-stop-switcher">
      <div class="tour-stop-switcher-heading"><span>{{ messages.stops }}</span><strong>{{ stop.order }} / {{ stops.length }}</strong></div>
      <nav class="tour-stop-tabs" :aria-label="messages.stops"><button v-for="(item, index) in stops" :key="item.id" type="button" :class="{ active: item.id === stop.id }" :disabled="pending" :aria-current="item.id === stop.id ? 'step' : undefined" @click="emit('select', index)"><small>{{ stopNumber(item.order) }}</small><span>{{ item.name }}</span></button></nav>
    </div>
    <p v-if="!matchesPlaying && playingStopName" class="tour-story-alert" role="status">{{ messages.drawerNotPlaying }}{{ playingStopName }}</p>
    <p v-if="browsing" class="tour-story-alert" role="status">{{ messages.browsingNoProgress }}</p>
    <TourImageCarousel :key="stop.id" :images="stop.images" :title="stop.name || messages.content" :previous-label="messages.previousImage" :next-label="messages.nextImage" />
    <div class="tour-story-controls">
      <button type="button" :disabled="(!canPlay && matchesPlaying) || pending" @click="emit('play')"><Play v-if="!playing || !matchesPlaying" :size="14" aria-hidden="true" /><Pause v-else :size="14" aria-hidden="true" />{{ playLabel }}</button>
      <button type="button" :disabled="!matchesPlaying || !canPlay || pending" @click="emit('replay')"><RotateCcw :size="14" aria-hidden="true" />{{ messages.replayStop }}</button>
      <div class="tour-seek-controls">
        <button type="button" class="tour-seek" :disabled="seekDisabled" :aria-label="messages.rewind15" :title="messages.rewind15" @click="emit('seek', -15)"><SkipBack :size="14" aria-hidden="true" />{{ messages.rewind15 }}</button>
        <button type="button" class="tour-seek" :disabled="seekDisabled" :aria-label="messages.forward15" :title="messages.forward15" @click="emit('seek', 15)"><SkipForward :size="14" aria-hidden="true" />{{ messages.forward15 }}</button>
      </div>
      <button v-if="!matchesPlaying" type="button" :disabled="pending" @click="emit('keepPlaying')">{{ messages.keepNarration }}</button>
      <select v-if="narrations.length > 1" :disabled="!matchesPlaying || pending" :value="narration?.guideId || ''" :aria-label="messages.guide" @change="emit('guide', ($event.target as HTMLSelectElement).value)"><option v-for="item in narrations" :key="item.id" :value="item.guideId || ''">{{ item.guideName }} · {{ item.specialty }}</option></select>
    </div>
    <p v-if="progressText" class="tour-queue-status" role="status">{{ messages.playbackProgress }}：{{ progressText }}</p>
    <p v-if="playingLabel" class="tour-queue-status" role="status" aria-live="polite">
      {{ messages.playingNow }}：{{ playingLabel }}<small v-if="restoreApproximate"> · {{ messages.approximateResume }}</small>
    </p>
    <p v-if="blocked" class="tour-queue-status is-blocked" role="status">{{ messages.autoplayBlocked }}</p>
    <p v-if="stop.arrivalNote" class="tour-arrival">{{ stop.arrivalNote }}</p>



    <button v-if="stop.experience?.enabled" type="button" class="tour-complete" @click="emit('postcard')">制作电子明信片</button>
    <div v-if="hasPlayableChapter" class="tour-story-text"><section v-for="chapter in narration?.chapters" :key="chapter.id || chapter.order"><h3 v-if="chapter.title">{{ chapter.title }}</h3><p>{{ chapter.text }}</p><p v-for="media in chapter.interludes" :key="media.id">{{ media.kind === 'video' ? '视频' : '音乐' }} · {{ media.title }}</p></section></div>
    <p v-else class="tour-story-text">{{ messages.noNarration }}</p>
    <button v-if="stop.video" type="button" class="tour-story-video" :disabled="pending || !matchesPlaying" @click="emit('playVideo')"><Play :size="16" aria-hidden="true" />{{ messages.video }}</button>
  </aside>
</template>

<style scoped>
.tour-story-video{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;margin-top:16px;padding:10px 16px;border:1px solid var(--tour-line);border-radius:10px;background:var(--tour-selected);color:var(--tour-lake);font:inherit;font-size:13px}.tour-story-video:disabled{opacity:.5}
.tour-content-lock{display:flex;align-items:center;gap:7px;margin-top:10px;min-height:36px;padding:7px 10px;border:1px solid var(--tour-line);border-radius:8px;background:var(--tour-selected);color:var(--tour-lake);font-size:12px;text-align:left}.tour-content-lock svg{flex-shrink:0}.tour-story button:focus-visible,.tour-story select:focus-visible{outline:2px solid var(--tour-lake);outline-offset:2px}.tour-story header h2{overflow-wrap:anywhere;min-width:0}.tour-story header button{flex-shrink:0}
.tour-story{position:absolute;right:12px;top:76px;bottom:168px;z-index:6;width:min(380px,calc(100% - 24px));overflow:auto;overscroll-behavior:contain;border-radius:12px;background:#fffef8f5;color:#273744;padding:16px;box-shadow:0 4px 24px #0003}.tour-story header{display:flex;align-items:center;justify-content:space-between;gap:12px}.tour-story h2{font-size:20px;margin:0}.tour-story header button{font-size:12px;color:#647382}.tour-stop-tabs{display:flex;gap:6px;overflow:auto;margin:14px 0}.tour-stop-tabs button{white-space:nowrap;border:1px solid #bcc8ce;border-radius:20px;padding:6px 10px;font-size:12px}.tour-stop-tabs button.active{background:#263f55;color:#fff}.tour-story-cover{width:100%;height:190px;object-fit:cover;border-radius:8px}.tour-image-caption{font-size:11px;color:#69777e;margin:6px 0}.tour-story-controls{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}.tour-story-controls button,.tour-complete{display:flex;align-items:center;justify-content:center;gap:6px;background:#263f55;color:#fff;border-radius:8px;padding:10px 16px;font-size:13px}.tour-story-controls button.tour-seek{min-width:84px;min-height:44px;background:#eef3f0;color:#263f55;padding:10px 12px}.tour-story-controls button:disabled,.tour-complete:disabled{opacity:.5}.tour-story-controls select{max-width:100%;background:#e9ede9;padding:8px;border-radius:6px}.tour-queue-status{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 12px;padding:8px 10px;border-radius:8px;background:#eef3f0;color:#41565f;font-size:12px}.tour-queue-status small{color:#6b7d84}.tour-queue-status.is-blocked{background:#fdf1e3;color:#8a5a24}.tour-story-alert{margin:0 0 10px;padding:8px 10px;border-radius:8px;background:#fdf1e3;color:#8a5a24;font-size:12px}.tour-story-text{font-size:14px;line-height:1.9;white-space:pre-wrap}.tour-story-text h3{font-size:16px;margin:16px 0 6px}.tour-arrival{font-size:12px;color:#647382}.tour-story video,.tour-story-images img{width:100%;border-radius:8px}.tour-story summary{font-size:13px;cursor:pointer;margin:12px 0}.tour-story-images figure{margin:16px 0}.tour-story-images figcaption{font-size:11px;color:#69777e}.tour-complete{width:100%;margin-top:18px}
.tour-story{border:1px solid var(--tour-line);background:var(--tour-paper-strong);color:var(--tour-ink);box-shadow:0 6px 24px #183e4320}.tour-stop-tabs button.active,.tour-story-controls button,.tour-complete{background:var(--tour-lake);color:#fff}.tour-stop-tabs button{border-color:var(--tour-line)}.tour-story-controls button.tour-seek,.tour-queue-status{background:var(--tour-selected);color:var(--tour-lake)}.tour-story header button{min-height:36px;border:0;background:transparent;padding:4px;color:var(--tour-muted)}
@media(min-width:900px){.tour-story{width:clamp(380px,32vw,440px)}}
.tour-story{bottom:max(20px,env(safe-area-inset-bottom))}
@media(max-width:760px){.tour-story{left:10px;right:10px;top:72px;bottom:max(18px,env(safe-area-inset-bottom));width:auto;padding:14px;border-radius:14px}.tour-story-cover{height:150px}.tour-story-controls{gap:7px;margin:12px 0}.tour-story-controls button{flex:1;min-width:calc(50% - 7px);padding:9px 10px}.tour-story-controls button.tour-seek{min-width:calc(50% - 7px)}}
.tour-stop-switcher{display:grid;gap:7px;margin:14px 0 16px}.tour-stop-switcher-heading{display:flex;align-items:center;justify-content:space-between;color:var(--tour-muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase}.tour-stop-switcher-heading strong{color:var(--tour-lake);font-size:12px;letter-spacing:0}.tour-stop-tabs{display:flex;gap:7px;overflow-x:auto;margin:0;padding:2px 2px 8px;scroll-snap-type:x proximity;scrollbar-width:thin}.tour-stop-tabs button{display:flex;align-items:center;gap:8px;flex:0 0 auto;min-width:112px;padding:9px 11px;border:1px solid var(--tour-line);border-radius:10px;background:#fff;color:var(--tour-ink);font-size:12px;text-align:left;scroll-snap-align:start}.tour-stop-tabs button small{display:grid;place-items:center;width:23px;height:23px;border-radius:7px;background:var(--tour-selected);color:var(--tour-muted);font-size:10px;font-weight:700}.tour-stop-tabs button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tour-stop-tabs button.active{border-color:var(--tour-lake);background:var(--tour-lake);color:#fff;box-shadow:0 5px 12px #183e4322}.tour-stop-tabs button.active small{background:#ffffff22;color:#fff}
.tour-seek-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:inherit;width:100%}.tour-seek-controls button.tour-seek{min-width:0}
@media(max-width:960px){.tour-story{bottom:calc(var(--tour-dock-height,220px) + max(16px,env(safe-area-inset-bottom)) + 12px)}}
</style>
