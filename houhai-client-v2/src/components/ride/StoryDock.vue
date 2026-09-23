<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight, Headphones, Pause, Play } from 'lucide-vue-next'
import { message } from '../../ride/i18n'
import type { Locale, RideStop } from '../../ride/types'
import type { JourneyPlayback } from '../../ride/progression'

const props = defineProps<{ stop: RideStop; index: number; total: number; locale: Locale; playback: JourneyPlayback; open: boolean }>()
defineEmits<{ toggle: []; open: [] }>()
const label = computed(() => props.playback.status === 'playing' ? 'pause' : props.playback.status === 'paused' ? 'resume' : 'play')
</script>

<template>
  <div class="story-dock">
    <button type="button" class="dock-play" :aria-label="message(locale, label)" @click="$emit('toggle')">
      <Pause v-if="playback.status === 'playing'" :size="16" fill="currentColor" /><Play v-else :size="16" fill="currentColor" />
    </button>
    <button type="button" class="dock-open" aria-controls="story-layer" :aria-expanded="open" :aria-label="message(locale, open ? 'hideContent' : 'showContent')" @click="$emit('open')">
      <span class="dock-heading"><Headphones :size="12" /><small>{{ open ? '正在查看' : '查看内容' }}</small></span>
      <span class="dock-line"><strong class="dock-name">{{ stop.name }}</strong><span class="dock-count">{{ index + 1 }} / {{ total }}</span></span>
      <ChevronLeft v-if="open" :size="15" /><ChevronRight v-else :size="15" />
    </button>
  </div>
</template>

<style scoped>
.story-dock{position:absolute;left:14px;bottom:24px;z-index:8;display:flex;align-items:stretch;border:1px solid #c8ddd2;border-radius:15px;background:#fffffff5;backdrop-filter:blur(12px);box-shadow:0 7px 25px #183e4330;overflow:hidden}.dock-play{display:grid;place-items:center;width:46px;border:0;background:var(--lake);color:white}.dock-open{position:relative;display:flex;align-items:flex-start;gap:9px;min-width:154px;padding:20px 30px 8px 10px;border:0;background:none;color:var(--lake);text-align:left}.dock-heading{position:absolute;left:10px;top:5px;display:flex;align-items:center;gap:4px;font-size:10px;color:#5e7b6c}.dock-heading small{font-size:10px}.dock-line{display:flex;align-items:baseline;gap:7px;min-width:0}.dock-name{max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700}.dock-count{font:10px monospace;color:#6b8377;white-space:nowrap}.dock-open>svg{position:absolute;right:9px;top:50%;transform:translateY(-50%)}@media(max-width:420px){.story-dock{left:10px;bottom:16px}.dock-open{min-width:142px;padding-right:28px}.dock-name{max-width:88px}}
</style>
