<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, useTemplateRef } from 'vue'
import { Check, ListMusic, Lock, LockOpen, Play, SkipForward, X } from 'lucide-vue-next'
import type { ClientTourStop } from '@/types/clientCatalog'
import type { PlaybackSequenceItem } from '@/composables/useTourJourney'
import type { TourMessages } from '@/utils/tourMessages'

const props = defineProps<{
  sequence: PlaybackSequenceItem[]
  stops: ClientTourStop[]
  messages: TourMessages
  autoPlayEnabled: boolean
  contentAutoSwitchLocked: boolean
  pending: boolean
}>()

const emit = defineEmits<{
  close: []
  toggleAutoPlay: [value: boolean]
  toggleContentLock: [value: boolean]
  play: [stopId: string]
  skip: [stopId: string]
}>()

const queuedCount = computed(() => props.sequence.filter(item => item.status === 'queued').length)
const panel = useTemplateRef<HTMLElement>('panel')
let previousFocus: HTMLElement | null = null

onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  panel.value?.querySelector<HTMLButtonElement>('.queue-close')?.focus()
})
onBeforeUnmount(() => previousFocus?.focus())

function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const buttons = panel.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
  if (!buttons?.length) return
  const first = buttons[0]
  const last = buttons[buttons.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

function stopName(item: PlaybackSequenceItem) {
  return props.stops.find(stop => stop.id === item.stopId)?.name || item.stopId
}

function statusLabel(status: PlaybackSequenceItem['status']) {
  if (status === 'playing') return props.messages.queuePlaying
  if (status === 'completed') return props.messages.queueCompleted
  if (status === 'skipped') return props.messages.queueSkipped
  return props.messages.queueQueued
}
</script>

<template>
  <aside ref="panel" class="tour-playback-queue" role="dialog" aria-modal="true" :aria-label="messages.queueTitle" @keydown="trapFocus">
    <span class="queue-grip" aria-hidden="true" />
    <header class="queue-header">
      <div class="queue-heading"><ListMusic :size="17" aria-hidden="true" /><div><strong>{{ messages.queueTitle }}</strong><small>{{ queuedCount }} {{ messages.queuePending }}</small></div></div>
      <button type="button" class="queue-close" :aria-label="messages.close" :title="messages.close" @click="emit('close')"><X :size="17" aria-hidden="true" /></button>
    </header>
    <p class="queue-hint">{{ messages.queueHint }}</p>
    <div class="queue-settings">
      <button type="button" class="queue-setting" role="switch" :aria-checked="autoPlayEnabled" :disabled="pending" @click="emit('toggleAutoPlay', !autoPlayEnabled)">
        <Play :size="15" aria-hidden="true" /><span>{{ messages.queueAutoPlay }}</span><span class="queue-toggle" :class="{ 'is-on': autoPlayEnabled }" aria-hidden="true" />
      </button>
      <button type="button" class="queue-setting" role="switch" :aria-checked="!contentAutoSwitchLocked" :disabled="pending" @click="emit('toggleContentLock', !contentAutoSwitchLocked)">
        <Lock v-if="contentAutoSwitchLocked" :size="14" aria-hidden="true" /><LockOpen v-else :size="14" aria-hidden="true" /><span>{{ messages.queueUnlockContent }}</span><span class="queue-toggle" :class="{ 'is-on': !contentAutoSwitchLocked }" aria-hidden="true" />
      </button>
    </div>
    <ol v-if="sequence.length" class="queue-list">
      <li v-for="item in sequence" :key="item.stopId" class="queue-item" :class="`is-${item.status}`">
        <span class="queue-marker" aria-hidden="true"><Check v-if="item.status === 'completed'" :size="13" /><SkipForward v-else-if="item.status === 'skipped'" :size="13" /><span v-else>{{ item.index + 1 }}</span></span>
        <div class="queue-item-copy"><strong>{{ stopName(item) }}</strong><small>{{ statusLabel(item.status) }}</small></div>
        <button v-if="item.status === 'queued'" type="button" class="queue-item-action" :disabled="pending" :aria-label="`${messages.queuePlay}: ${stopName(item)}`" :title="messages.queuePlay" @click="emit('play', item.stopId)"><Play :size="14" aria-hidden="true" /></button>
        <button v-if="item.status === 'queued'" type="button" class="queue-item-action is-muted" :disabled="pending" :aria-label="`${messages.queueSkip}: ${stopName(item)}`" :title="messages.queueSkip" @click="emit('skip', item.stopId)"><X :size="14" aria-hidden="true" /></button>
      </li>
    </ol>
    <p v-else class="queue-empty">{{ messages.queueEmpty }}</p>
  </aside>
</template>

<style scoped>
.tour-playback-queue{position:absolute;left:20px;bottom:20px;box-sizing:border-box;display:flex;flex-direction:column;width:min(460px,calc(100% - 40px));max-height:min(82dvh,680px);padding:8px 20px 20px;border:1px solid var(--tour-line);border-radius:26px;background:#fcfefd;color:var(--tour-lake);box-shadow:0 20px 70px #183e4330}
.queue-grip{align-self:center;flex:0 0 4px;width:32px;margin:0 0 8px;border-radius:4px;background:#d4e2da}
.queue-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.queue-heading{display:flex;align-items:center;gap:12px}.queue-heading>svg{box-sizing:content-box;padding:11px;border-radius:14px;background:#e9f2ed}.queue-heading>div{display:grid;gap:4px}.queue-heading strong{font:600 21px/1.4 var(--tour-display)}.queue-heading small{color:#75897d;font-size:11px}.queue-close,.queue-item-action{display:grid;place-items:center;flex-shrink:0;width:44px;height:44px;padding:0;border:0;border-radius:12px;background:#edf3ef;color:var(--tour-lake);cursor:pointer}
.queue-hint{margin:14px 0;color:#75897d;font-size:12px;line-height:1.7}.queue-settings{display:grid;gap:2px;margin-bottom:16px;padding:4px 12px;border:1px solid #e0e9e3;border-radius:16px;background:#f3f7f4}.queue-setting{display:flex;align-items:center;gap:9px;width:100%;min-height:46px;padding:8px 0;border:0;background:transparent;color:#436354;font-family:inherit;font-size:12px;line-height:1.5;text-align:left;cursor:pointer}.queue-setting+.queue-setting{border-top:1px solid #e0e9e3}.queue-setting>span:first-of-type{flex:1;overflow-wrap:anywhere}.queue-toggle{position:relative;flex:0 0 30px;height:18px;border-radius:12px;background:#ccd9d1}.queue-toggle::after{position:absolute;left:3px;top:3px;width:12px;height:12px;border-radius:50%;background:#fff;content:''}.queue-toggle.is-on{background:#367a68}.queue-toggle.is-on::after{left:15px}
.queue-list{display:grid;gap:0;min-height:0;overflow:auto;overscroll-behavior:contain;margin:0;padding:0;list-style:none;scrollbar-width:thin}.queue-item{display:flex;align-items:center;gap:12px;min-height:68px;padding:10px 8px;border-top:1px solid #e4ece6;border-radius:0}.queue-item:first-child{border-top:0}.queue-item.is-playing{padding-right:10px;padding-left:10px;border-color:transparent;border-radius:16px;background:#e9f2ed}.queue-item.is-playing+.queue-item{border-color:transparent}.queue-marker{display:grid;place-items:center;flex:0 0 32px;height:32px;border:1px solid #dce6df;border-radius:11px;background:#fff;color:#688171;font-size:11px;font-variant-numeric:tabular-nums}.is-playing .queue-marker{border-color:var(--tour-lake);background:var(--tour-lake);color:#fff}.queue-item-copy{display:grid;gap:5px;min-width:0;flex:1}.queue-item-copy strong{overflow:hidden;color:#294b3d;font-size:14px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}.queue-item-copy small{color:#75897d;font-size:11px}.is-playing .queue-item-copy small{color:#357965}.is-completed,.is-skipped{opacity:.6}.queue-item-action{width:40px;height:44px;background:#eaf2ed}.queue-item-action.is-muted{background:transparent;color:#8b9b91}.queue-empty{margin:0;padding:32px 20px;border:1px dashed #d4e2da;border-radius:16px;color:#75897d;font-size:13px;line-height:1.8;text-align:center}
.tour-playback-queue button:disabled{opacity:.45;cursor:default}.tour-playback-queue button:focus-visible{outline:2px solid var(--tour-lake);outline-offset:2px}
@media(max-width:760px){.tour-playback-queue{left:0;bottom:0;width:100%;max-height:80dvh;padding:10px 20px max(20px,env(safe-area-inset-bottom));border-radius:26px 26px 0 0;border-bottom:0}.queue-heading strong{font-size:20px}}
@media(max-height:600px){.tour-playback-queue{max-height:94dvh}.queue-hint{margin:8px 0}.queue-settings{margin-bottom:8px}}
</style>
