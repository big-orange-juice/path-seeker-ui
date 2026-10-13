<script setup lang="ts">
import { computed } from 'vue'
import { Check, Circle, ListMusic, Lock, LockOpen, Play, SkipForward, X } from 'lucide-vue-next'
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
  <aside class="tour-playback-queue" role="dialog" aria-modal="false" :aria-label="messages.queueTitle">
    <header class="queue-header">
      <div class="queue-heading"><ListMusic :size="17" aria-hidden="true" /><div><strong>{{ messages.queueTitle }}</strong><small>{{ queuedCount }} {{ messages.queuePending }}</small></div></div>
      <button type="button" class="queue-close" :aria-label="messages.close" :title="messages.close" @click="emit('close')"><X :size="17" aria-hidden="true" /></button>
    </header>
    <p class="queue-hint">{{ messages.queueHint }}</p>
    <div class="queue-settings">
      <button type="button" class="queue-setting" role="switch" :aria-checked="autoPlayEnabled" :disabled="pending" @click="emit('toggleAutoPlay', !autoPlayEnabled)">
        <Play :size="14" aria-hidden="true" /><span>{{ messages.queueAutoPlay }}</span><strong>{{ autoPlayEnabled ? messages.queueOn : messages.queueOff }}</strong>
      </button>
      <button type="button" class="queue-setting" role="switch" :aria-checked="contentAutoSwitchLocked" @click="emit('toggleContentLock', !contentAutoSwitchLocked)">
        <Lock v-if="contentAutoSwitchLocked" :size="14" aria-hidden="true" /><LockOpen v-else :size="14" aria-hidden="true" /><span>{{ messages.queueLockContent }}</span><span class="queue-toggle" :class="{ 'is-on': contentAutoSwitchLocked }" aria-hidden="true" />
      </button>
    </div>
    <ol v-if="sequence.length" class="queue-list">
      <li v-for="item in sequence" :key="item.stopId" class="queue-item" :class="`is-${item.status}`">
        <span class="queue-marker" aria-hidden="true"><Check v-if="item.status === 'completed'" :size="13" /><SkipForward v-else-if="item.status === 'skipped'" :size="13" /><Circle v-else :size="10" :fill="item.status === 'playing' ? 'currentColor' : 'none'" /></span>
        <div class="queue-item-copy"><strong>{{ stopName(item) }}</strong><small>{{ statusLabel(item.status) }}</small></div>
        <button v-if="item.status === 'queued'" type="button" class="queue-item-action" :disabled="pending" :aria-label="`${messages.queuePlay}: ${stopName(item)}`" :title="messages.queuePlay" @click="emit('play', item.stopId)"><Play :size="14" aria-hidden="true" /></button>
        <button v-if="item.status === 'queued'" type="button" class="queue-item-action is-muted" :disabled="pending" :aria-label="`${messages.queueSkip}: ${stopName(item)}`" :title="messages.queueSkip" @click="emit('skip', item.stopId)"><X :size="14" aria-hidden="true" /></button>
      </li>
    </ol>
    <p v-else class="queue-empty">{{ messages.queueEmpty }}</p>
  </aside>
</template>

<style scoped>
.tour-playback-queue button:disabled{opacity:.45;cursor:wait}.queue-heading strong,.queue-setting span{overflow-wrap:anywhere}.queue-close,.queue-marker,.queue-item-action{flex-shrink:0}
.tour-playback-queue{position:absolute;left:12px;bottom:154px;z-index:10;width:min(360px,calc(100% - 24px));max-height:min(66dvh,520px);overflow:auto;padding:14px;border:1px solid var(--tour-line);border-radius:14px;background:var(--tour-paper-strong);color:var(--tour-ink);box-shadow:0 12px 34px #183e4330;backdrop-filter:blur(16px)}
.queue-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.queue-heading{display:flex;align-items:center;gap:9px;color:var(--tour-lake)}.queue-heading>div{display:grid;gap:2px}.queue-heading strong{font-size:14px}.queue-heading small{color:var(--tour-muted);font-size:11px}.queue-close,.queue-item-action{display:grid;place-items:center;width:30px;height:30px;padding:0;border:1px solid var(--tour-line);border-radius:8px;background:#fff;color:var(--tour-lake)}.queue-close:focus-visible,.queue-item-action:focus-visible,.queue-setting:focus-visible{outline:2px solid var(--tour-lake);outline-offset:2px}.queue-hint{margin:10px 0;padding:8px 10px;border-radius:8px;background:var(--tour-selected);color:var(--tour-muted);font-size:11px;line-height:1.5}.queue-settings{display:grid;gap:6px;margin-bottom:10px}.queue-setting{display:flex;align-items:center;gap:7px;min-height:36px;padding:7px 9px;border:1px solid var(--tour-line);border-radius:9px;background:#fff;color:var(--tour-lake);font-size:11px;text-align:left}.queue-setting span{flex:1}.queue-setting strong{font-size:10px;color:var(--tour-muted);font-weight:600}.queue-list{display:grid;gap:6px;margin:0;padding:0;list-style:none}.queue-item{display:flex;align-items:center;gap:8px;min-height:42px;padding:7px 8px;border:1px solid var(--tour-line);border-radius:9px;background:#fff}.queue-item.is-playing{border-color:var(--tour-lake);background:var(--tour-selected)}.queue-item.is-completed{opacity:.68}.queue-marker{display:grid;place-items:center;width:23px;height:23px;border-radius:50%;color:var(--tour-lake);background:var(--tour-selected)}.queue-item-copy{display:grid;gap:2px;min-width:0;flex:1}.queue-item-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.queue-item-copy small{color:var(--tour-muted);font-size:10px}.queue-item-action.is-muted{color:var(--tour-muted);background:transparent}.queue-empty{margin:12px 0 2px;color:var(--tour-muted);font-size:12px;text-align:center}@media(max-width:760px){.tour-playback-queue{bottom:166px;width:calc(100% - 24px)}}@media(prefers-reduced-motion:reduce){.tour-playback-queue{scroll-behavior:auto}}
.queue-close,.queue-item-action{width:40px;height:40px}.queue-setting{min-height:44px}.queue-close{border:0;background:transparent}.queue-setting strong{flex-shrink:0}
.queue-setting .queue-toggle{flex:0 0 28px;height:16px;border-radius:10px;background:var(--tour-line);position:relative}.queue-toggle::after{content:'';position:absolute;left:3px;top:3px;width:10px;height:10px;border-radius:50%;background:#fff}.queue-toggle.is-on{background:var(--tour-lake)}.queue-toggle.is-on::after{left:15px}
</style>
