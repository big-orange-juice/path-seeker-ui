<script setup lang="ts">
import { ArrowRightLeft, MapPin } from 'lucide-vue-next'
import type { TourStopCandidate } from '@/utils/tourProgression'
import type { TourMessages } from '@/utils/tourMessages'

/**
 * 接近卡片：接近时弹出，写明"已到达/接近 <景点名>"，由用户选择"进入该站"或"继续当前"。
 * 多个范围重叠时列出候选（按路线顺序 + 停靠点距离排序）。卡片本身不打断正在播放的音频。
 */
const props = defineProps<{ candidates: TourStopCandidate[]; pending: boolean; messages: TourMessages; playingStopName?: string | null }>()
const emit = defineEmits<{ accept: [index: number]; dismiss: [] }>()

function statusText(candidate: TourStopCandidate) {
  return candidate.withinRange ? props.messages.arrived : props.messages.approaching
}

function distanceText(candidate: TourStopCandidate) {
  if (candidate.distanceMeters == null) return ''
  return `${Math.round(candidate.distanceMeters)} ${props.messages.metresShort}`
}
</script>

<template>
  <Transition name="arrival">
    <aside v-if="candidates.length" class="tour-arrival-prompt" :aria-label="messages.nearbyStop">
      <div class="arrival-choice">
        <p class="arrival-hint"><MapPin :size="13" aria-hidden="true" />{{ candidates.length > 1 ? messages.overlappingStops : messages.nearbyStop }}</p>
        <p v-if="playingStopName" class="arrival-playing">{{ messages.drawerNotPlaying }}{{ playingStopName }}</p>
        <div v-for="candidate in candidates" :key="candidate.stop.id" class="arrival-candidate">
          <span class="arrival-candidate-text">
            <strong>{{ statusText(candidate) }} {{ candidate.stop.name }}</strong>
            <small v-if="distanceText(candidate)">{{ distanceText(candidate) }}</small>
          </span>
          <button class="arrival-switch" type="button" :disabled="pending" @click="emit('accept', candidate.index)">
            <ArrowRightLeft :size="15" aria-hidden="true" />{{ messages.enterStop }}
          </button>
        </div>
        <button class="arrival-continue" type="button" :disabled="pending" @click="emit('dismiss')">{{ messages.keepNarration }}</button>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.tour-arrival-prompt{position:absolute;right:12px;bottom:172px;z-index:7;display:flex;flex-direction:column;align-items:flex-end;gap:8px;max-width:calc(100% - 24px);color:var(--tour-ink)}
.arrival-choice{display:grid;gap:8px;width:260px;max-width:100%;max-height:calc(100dvh - 250px);overflow-y:auto;padding:14px;border:1px solid #24616a30;border-radius:12px;background:#fffef8;box-shadow:0 6px 24px #183e4329}
.arrival-hint{display:flex;align-items:center;gap:5px;margin:0;color:#647382;font-size:11px}.arrival-playing{margin:0;padding:6px 8px;border-radius:8px;background:#fdf1e3;color:#8a5a24;font-size:11px}
.arrival-candidate{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid #24616a24;border-radius:10px;background:#f8faf9}
.arrival-candidate-text{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px}
.arrival-candidate-text strong{overflow-wrap:anywhere;font-size:14px;line-height:1.5}
.arrival-candidate-text small{color:#647382;font-size:11px}
.arrival-choice button{display:flex;justify-content:center;align-items:center;gap:7px;min-height:38px;border-radius:7px;padding:8px 10px;font-size:12px;line-height:1.5}
.arrival-switch{background:var(--tour-lake);color:#fffef8}
.arrival-continue{border:1px solid #24616a30;background:transparent;color:var(--tour-lake)}
.tour-arrival-prompt button:focus-visible{outline:2px solid var(--tour-lake);outline-offset:3px}.tour-arrival-prompt button:disabled{opacity:.5;cursor:wait}
.arrival-enter-active,.arrival-leave-active{transition:opacity .2s ease,transform .2s ease}.arrival-enter-from,.arrival-leave-to{opacity:0;transform:translateX(12px)}
@media(max-height:560px){.tour-arrival-prompt{bottom:146px}.arrival-choice{gap:6px;padding:10px}}
@media(prefers-reduced-motion:reduce){.arrival-enter-active,.arrival-leave-active{transition:none}}
</style>
