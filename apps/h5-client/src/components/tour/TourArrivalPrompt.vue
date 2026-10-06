<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { MapPin, ArrowRightLeft } from 'lucide-vue-next'
import type { ClientTourStop } from '@/types/clientCatalog'
import type { TourMessages } from '@/utils/tourMessages'

const props = defineProps<{ stop: ClientTourStop | null; pending: boolean; messages: TourMessages }>()
const emit = defineEmits<{ accept: []; dismiss: [] }>()
const expanded = shallowRef(false)

watch(() => props.stop?.id, () => { expanded.value = false })
</script>

<template>
  <Transition name="arrival">
    <aside v-if="stop" class="tour-arrival-prompt" :aria-label="messages.nearbyStop">
      <div v-if="expanded" class="arrival-choice">
        <p>{{ messages.nearbyStop }}</p>
        <strong>{{ stop.name }}</strong>
        <button class="arrival-switch" type="button" :disabled="pending" @click="emit('accept')">
          <ArrowRightLeft :size="15" aria-hidden="true" />{{ messages.switchNarration }}
        </button>
        <button class="arrival-continue" type="button" :disabled="pending" @click="emit('dismiss')">{{ messages.keepNarration }}</button>
      </div>
      <button
        class="arrival-trigger"
        type="button"
        :aria-label="`${messages.nearbyStop} · ${stop.name} · ${messages.switchNarration}`"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <span class="arrival-icon" aria-hidden="true"><MapPin :size="21" /><i /></span>
        <span class="arrival-label" role="status" aria-live="polite"><small>{{ messages.nearbyStop }}</small><strong>{{ stop.name }}</strong></span>
      </button>
    </aside>
  </Transition>
</template>

<style scoped>
.tour-arrival-prompt{position:absolute;right:12px;bottom:172px;z-index:7;display:flex;flex-direction:column;align-items:flex-end;gap:8px;max-width:calc(100% - 24px);color:var(--tour-ink)}
.arrival-trigger{display:flex;align-items:center;gap:10px;max-width:210px;padding:8px 12px 8px 8px;border:1px solid #24616a40;border-radius:12px;background:#fffef8;box-shadow:0 4px 20px #183e4329;text-align:left}
.arrival-icon{position:relative;display:grid;place-items:center;flex-shrink:0;width:36px;height:36px;border-radius:9px;background:var(--tour-lake);color:#fffef8}
.arrival-icon i{position:absolute;right:-3px;top:-3px;width:9px;height:9px;border:2px solid #fffef8;border-radius:50%;background:#c4773c}
.arrival-label{display:grid;gap:3px;min-width:0}.arrival-label small{font-size:10px;color:#647382}.arrival-label strong{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px;font-weight:600}
.arrival-choice{display:grid;gap:8px;width:240px;max-width:100%;max-height:calc(100dvh - 250px);overflow-y:auto;padding:14px;border:1px solid #24616a30;border-radius:12px;background:#fffef8;box-shadow:0 6px 24px #183e4329}
.arrival-choice p{margin:0;color:#647382;font-size:11px}.arrival-choice strong{overflow-wrap:anywhere;font-size:14px;line-height:1.5}.arrival-choice button{display:flex;justify-content:center;align-items:center;gap:7px;min-height:38px;border-radius:7px;padding:8px 10px;font-size:12px;line-height:1.5}
.arrival-switch{background:var(--tour-lake);color:#fffef8}.arrival-continue{border:1px solid #24616a30;background:transparent;color:var(--tour-lake)}
.tour-arrival-prompt button:focus-visible{outline:2px solid var(--tour-lake);outline-offset:3px}.tour-arrival-prompt button:disabled{opacity:.5;cursor:wait}
.arrival-enter-active,.arrival-leave-active{transition:opacity .2s ease,transform .2s ease}.arrival-enter-from,.arrival-leave-to{opacity:0;transform:translateX(12px)}
@media(max-height:560px){.tour-arrival-prompt{bottom:146px}.arrival-choice{gap:6px;padding:10px}}
@media(prefers-reduced-motion:reduce){.arrival-enter-active,.arrival-leave-active{transition:none}}
</style>
