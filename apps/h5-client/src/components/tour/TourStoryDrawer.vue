<script setup lang="ts">
import { computed } from 'vue'
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-vue-next'
import type { ClientStopExtraAudio, ClientTourStop, TourGuideNarration } from '@/types/clientCatalog'
import type { TourMessages } from '@/utils/tourMessages'

/**
 * 站点内容抽屉（方案 §3、§4.1）：
 * - 控制行的播放／暂停与 ±15 秒与底部迷你控制条**同源**：都由父级下发的 speech 状态与 seekBy 驱动；
 * - 抽屉展示的节点可能是"接近但还没切站"的节点（matchesPlaying=false），此时播放控制仍作用于正在播放的节点；
 * - "跳过额外音频"开关只影响队列构成，不写回 B 端配置。
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
  skipExtraAudio: boolean
  /** 浏览器阻止自动播放，等待用户点击"继续播放" */
  blocked: boolean
  /** 系统语音按句恢复，位置为近似值 */
  restoreApproximate: boolean
  /** 当前正在播放的条目（用于列表高亮） */
  playingItemId: string | null
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
  replay: []
  seek: [deltaSeconds: number]
  select: [index: number]
  guide: [id: string | null]
  complete: []
  skipExtraAudio: [value: boolean]
  playExtra: [id: string]
}>()

const extraAudios = computed(() => props.stop?.extraAudios ?? [])
const beforeAudios = computed(() => sortGroup('before'))
const afterAudios = computed(() => sortGroup('after'))
const hasPlayableChapter = computed(() => Boolean(props.narration?.chapters?.length))
const hasPlayableExtra = computed(() => extraAudios.value.some(item => item.url))
// 主按钮对应"整站队列"的内容：跳过额外音频时只看讲解章节；单条额外音频另有独立按钮
const canPlay = computed(() => hasPlayableChapter.value || (!props.skipExtraAudio && hasPlayableExtra.value))
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

function sortGroup(position: 'before' | 'after') {
  return extraAudios.value
    .filter(item => item.position === position)
    .slice()
    .sort((left, right) => (left.order - right.order) || left.id.localeCompare(right.id))
}

function toggleExtraAudio(event: Event) {
  emit('skipExtraAudio', (event.target as HTMLInputElement).checked)
}

function durationText(item: ClientStopExtraAudio) {
  return item.durationSeconds == null ? '' : `${item.durationSeconds} ${props.messages.secondsShort}`
}

function itemLabel(item: ClientStopExtraAudio, index: number) {
  return item.title || `${props.messages.extraAudio} ${index + 1}`
}
</script>

<template>
  <aside v-if="stop" class="tour-story" role="dialog" aria-modal="false" :aria-label="stop.name || messages.content">
    <header><h2>{{ stop.name }}</h2><button type="button" @click="emit('close')">{{ messages.close }}</button></header>
    <nav class="tour-stop-tabs"><button v-for="(item, index) in stops" :key="item.id" type="button" :class="{ active: item.id === stop.id }" :disabled="pending" @click="emit('select', index)">{{ item.order }}. {{ item.name }}</button></nav>
    <p v-if="!matchesPlaying && playingStopName" class="tour-story-alert" role="status">{{ messages.drawerNotPlaying }}{{ playingStopName }}</p>
    <p v-if="browsing" class="tour-story-alert" role="status">{{ messages.browsingNoProgress }}</p>
    <img v-if="stop.images?.[0]?.url" class="tour-story-cover" :src="stop.images[0].url" :alt="stop.images[0].altText || stop.name || ''">
    <p v-if="stop.images?.[0]?.caption" class="tour-image-caption">{{ stop.images[0].caption }}</p>
    <div class="tour-story-controls">
      <button type="button" :disabled="(!canPlay && matchesPlaying) || pending" @click="emit('play')"><Play v-if="!playing || !matchesPlaying" :size="14" aria-hidden="true" /><Pause v-else :size="14" aria-hidden="true" />{{ playLabel }}</button>
      <button type="button" class="tour-seek" :disabled="seekDisabled" :aria-label="messages.rewind15" :title="messages.rewind15" @click="emit('seek', -15)"><SkipBack :size="14" aria-hidden="true" />{{ messages.rewind15 }}</button>
      <button type="button" class="tour-seek" :disabled="seekDisabled" :aria-label="messages.forward15" :title="messages.forward15" @click="emit('seek', 15)"><SkipForward :size="14" aria-hidden="true" />{{ messages.forward15 }}</button>
      <button type="button" :disabled="!canPlay || pending" @click="emit('replay')"><RotateCcw :size="14" aria-hidden="true" />{{ messages.replayStop }}</button>
      <select v-if="narrations.length > 1" :value="narration?.guideId || ''" :aria-label="messages.guide" @change="emit('guide', ($event.target as HTMLSelectElement).value)"><option v-for="item in narrations" :key="item.id" :value="item.guideId || ''">{{ item.guideName }} · {{ item.specialty }}</option></select>
    </div>
    <p v-if="progressText" class="tour-queue-status" role="status">{{ messages.playbackProgress }}：{{ progressText }}</p>
    <p v-if="playingLabel" class="tour-queue-status" role="status" aria-live="polite">
      {{ messages.playingNow }}：{{ playingLabel }}<small v-if="restoreApproximate"> · {{ messages.approximateResume }}</small>
    </p>
    <p v-if="blocked" class="tour-queue-status is-blocked" role="status">{{ messages.autoplayBlocked }}</p>
    <p v-if="stop.arrivalNote" class="tour-arrival">{{ stop.arrivalNote }}</p>

    <section v-if="extraAudios.length" class="tour-extra">
      <h3>{{ messages.extraAudio }}</h3>
      <label class="tour-extra-toggle">
        <input type="checkbox" :checked="skipExtraAudio" :disabled="pending" @change="toggleExtraAudio">
        <span>{{ messages.skipExtraAudio }}</span>
      </label>
      <div v-if="beforeAudios.length" class="tour-extra-group">
        <h4>{{ messages.beforeAudio }}</h4>
        <ul>
          <li v-for="(item, index) in beforeAudios" :key="item.id" :class="{ 'is-playing': item.id === playingItemId }">
            <button type="button" :disabled="pending || !item.url" @click="emit('playExtra', item.id)">
              <Play :size="13" aria-hidden="true" />
              <span>{{ itemLabel(item, index) }}</span>
              <small v-if="durationText(item)">{{ durationText(item) }}</small>
            </button>
          </li>
        </ul>
      </div>
      <div v-if="afterAudios.length" class="tour-extra-group">
        <h4>{{ messages.afterAudio }}</h4>
        <ul>
          <li v-for="(item, index) in afterAudios" :key="item.id" :class="{ 'is-playing': item.id === playingItemId }">
            <button type="button" :disabled="pending || !item.url" @click="emit('playExtra', item.id)">
              <Play :size="13" aria-hidden="true" />
              <span>{{ itemLabel(item, index) }}</span>
              <small v-if="durationText(item)">{{ durationText(item) }}</small>
            </button>
          </li>
        </ul>
      </div>
    </section>

    <div v-if="hasPlayableChapter" class="tour-story-text"><section v-for="chapter in narration?.chapters" :key="chapter.id || chapter.order"><h3 v-if="chapter.title">{{ chapter.title }}</h3><p>{{ chapter.text }}</p></section></div>
    <p v-else class="tour-story-text">{{ messages.noNarration }}</p>
    <details v-if="stop.video"><summary>{{ messages.video }}</summary><video :src="stop.video" controls playsinline preload="none" /></details>
    <div v-if="(stop.images?.length ?? 0) > 1" class="tour-story-images"><figure v-for="image in stop.images?.slice(1)" :key="image.id"><img v-if="image.url" :src="image.url" :alt="image.altText || ''" loading="lazy"><figcaption v-if="image.caption">{{ image.caption }}</figcaption></figure></div>
    <button class="tour-complete" type="button" :disabled="pending" @click="emit('complete')">{{ messages.complete }}</button>
  </aside>
</template>

<style scoped>
.tour-story{position:absolute;right:12px;top:76px;bottom:168px;z-index:6;width:min(380px,calc(100% - 24px));overflow:auto;overscroll-behavior:contain;border-radius:12px;background:#fffef8f5;color:#273744;padding:16px;box-shadow:0 4px 24px #0003}.tour-story header{display:flex;align-items:center;justify-content:space-between;gap:12px}.tour-story h2{font-size:20px;margin:0}.tour-story header button{font-size:12px;color:#647382}.tour-stop-tabs{display:flex;gap:6px;overflow:auto;margin:14px 0}.tour-stop-tabs button{white-space:nowrap;border:1px solid #bcc8ce;border-radius:20px;padding:6px 10px;font-size:12px}.tour-stop-tabs button.active{background:#263f55;color:#fff}.tour-story-cover{width:100%;height:190px;object-fit:cover;border-radius:8px}.tour-image-caption{font-size:11px;color:#69777e;margin:6px 0}.tour-story-controls{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}.tour-story-controls button,.tour-complete{display:flex;align-items:center;justify-content:center;gap:6px;background:#263f55;color:#fff;border-radius:8px;padding:10px 16px;font-size:13px}.tour-story-controls button.tour-seek{min-width:84px;min-height:44px;background:#eef3f0;color:#263f55;padding:10px 12px}.tour-story-controls button:disabled,.tour-complete:disabled{opacity:.5}.tour-story-controls select{max-width:100%;background:#e9ede9;padding:8px;border-radius:6px}.tour-queue-status{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 12px;padding:8px 10px;border-radius:8px;background:#eef3f0;color:#41565f;font-size:12px}.tour-queue-status small{color:#6b7d84}.tour-queue-status.is-blocked{background:#fdf1e3;color:#8a5a24}.tour-story-alert{margin:0 0 10px;padding:8px 10px;border-radius:8px;background:#fdf1e3;color:#8a5a24;font-size:12px}.tour-story-text{font-size:14px;line-height:1.9;white-space:pre-wrap}.tour-story-text h3{font-size:16px;margin:16px 0 6px}.tour-arrival{font-size:12px;color:#647382}.tour-story video,.tour-story-images img{width:100%;border-radius:8px}.tour-story summary{font-size:13px;cursor:pointer;margin:12px 0}.tour-story-images figure{margin:16px 0}.tour-story-images figcaption{font-size:11px;color:#69777e}.tour-complete{width:100%;margin-top:18px}
.tour-extra{margin:16px 0;padding:12px;border:1px solid #dbe5df;border-radius:10px;background:#f6faf7}.tour-extra h3{margin:0 0 8px;font-size:14px}.tour-extra-toggle{display:flex;align-items:center;gap:7px;font-size:12px;color:#41565f}.tour-extra-group{margin-top:10px}.tour-extra-group h4{margin:0 0 6px;color:#647382;font-size:11px;font-weight:600}.tour-extra-group ul{display:grid;gap:6px;margin:0;padding:0;list-style:none}.tour-extra-group button{display:flex;align-items:center;gap:7px;width:100%;padding:8px 10px;border:1px solid #dbe5df;border-radius:8px;background:#fff;color:#263f55;font-size:12px;text-align:left}.tour-extra-group button span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tour-extra-group button small{color:#78878f;font-size:11px}.tour-extra-group li.is-playing button{border-color:#263f55;background:#e4f0ea}
</style>
