<script setup lang="ts">
import { BookOpen, Check, Headphones, Pause, Play, Square, Volume2 } from 'lucide-vue-next'
import type { CulturalPlace } from '../types'
import { useGuidePlayback } from '../composables/useGuidePlayback'

defineProps<{ place: CulturalPlace; compact?: boolean }>()
const { narration, versions, selected, chapters, selectGuide, toggle } = useGuidePlayback()
</script>

<template>
  <section class="guide-narration" :class="{ compact }" aria-label="导游讲解">
    <template v-if="versions.length">
      <div v-if="!compact" class="guide-heading"><h3>听谁讲这一站</h3><span>{{ versions.length }} 位导游</span></div>
      <div class="guide-options" role="group" aria-label="选择导游">
        <button v-for="version in versions" :key="version.id" class="guide-option" :class="{ selected: selected?.id === version.id }" :aria-pressed="selected?.id === version.id" @click="selectGuide(version.id)">
          <span class="guide-avatar">{{ version.guideName.slice(0, 1) }}</span>
          <span class="guide-info"><strong>{{ version.guideName }}</strong><small>{{ version.specialty }} · {{ version.duration }} 分钟</small></span>
          <Check v-if="!compact && selected?.id === version.id" :size="15" />
        </button>
      </div>
    </template>
    <div class="audio-card">
      <span class="audio-icon"><Headphones :size="20" /></span>
      <div class="audio-title"><strong>{{ selected?.title ?? '听听这里的故事' }}</strong><small>{{ selected?.guideName ?? '中文讲解' }} · 约 {{ selected?.duration ?? place.duration }} 分钟</small></div>
      <button :aria-label="narration.state.value === 'playing' ? '暂停讲解' : narration.state.value === 'paused' ? '继续讲解' : '播放讲解'" @click="toggle"><Pause v-if="narration.state.value === 'playing'" :size="17" /><Play v-else :size="17" /></button>
      <button v-if="narration.state.value !== 'idle'" class="stop-audio" aria-label="停止讲解" @click="narration.stop()"><Square :size="13" /></button>
    </div>
    <p v-if="narration.error.value" class="notice" role="status">{{ narration.error.value }}</p>
    <div v-if="!compact" class="reading-title"><BookOpen :size="14" /><h3>{{ place.scene === 'rickshaw' ? '地点讲解' : '展品讲解' }}</h3><span v-if="selected">{{ selected.guideName }}</span><Volume2 v-if="narration.state.value === 'playing'" :size="14" /></div>
    <component :is="compact ? 'details' : 'div'" class="narration-reading"><summary v-if="compact"><BookOpen :size="14" />阅读完整讲解<span>{{ chapters.length }} 个章节</span></summary><div class="narration-copy" aria-live="polite"><section v-for="chapter in chapters" :key="chapter.title"><h4>{{ chapter.title }}</h4><p>{{ chapter.text }}</p></section></div></component>
  </section>
</template>

<style scoped>
.guide-heading{display:flex;justify-content:space-between;align-items:center;margin:22px 0 12px}.guide-heading h3,.reading-title h3{font-size:12px;margin:0}.guide-heading>span{font-size:10px;color:var(--muted)}.guide-options{display:grid;gap:7px;margin-bottom:15px}.guide-option{display:flex;align-items:center;gap:10px;text-align:left;border:1px solid var(--line);border-radius:10px;padding:10px;background:white;color:var(--ink)}.guide-option.selected{background:#edf4f0;border-color:#8eaaa0}.guide-avatar{display:grid;place-items:center;width:32px;height:32px;flex-shrink:0;border-radius:50%;background:#e5ede6;color:var(--lake);font:15px var(--display)}.guide-info{flex:1}.guide-info strong{font-size:12px}.guide-info small{display:block;font-size:10px;margin-top:4px;color:#65766d}.guide-option>svg{color:var(--lake)}.audio-card{display:flex;align-items:center;gap:9px;padding:13px 10px;border-radius:12px;background:#eaf0ec}.audio-icon{display:grid;place-items:center;border-radius:10px;min-width:33px;height:37px;background:#d9e5df;color:var(--lake)}.audio-title{flex:1;min-width:0}.audio-title strong{display:block;font-size:12px;font-weight:600;line-height:1.6}.audio-title small{display:block;font-size:10px;color:#65766d;margin-top:5px}.audio-card button{display:grid;place-items:center;border:0;border-radius:50%;background:var(--lake);color:white;min-width:32px;height:32px}.audio-card .stop-audio{min-width:24px;height:24px;background:transparent;color:var(--lake)}.reading-title{display:flex;gap:7px;align-items:center;margin-top:22px}.reading-title>span{margin-left:auto;font-size:10px;color:var(--muted)}.narration-copy h4{font-size:12px;font-weight:500;margin:17px 0 8px}.narration-copy p{font-size:12px;line-height:1.95;color:#66756d;margin:0}
.compact .guide-options{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none;padding:2px 0 9px;margin:0 0 4px}.compact .guide-option{flex:0 0 auto;min-width:136px;scroll-snap-align:start;gap:8px;padding:9px 11px;border-radius:14px;background:#f0f4f1;border-color:transparent;transition:background .2s,border-color .2s}.compact .guide-option.selected{background:#e5eee8;border-color:#91ab9d}.compact .guide-avatar{width:30px;height:30px;background:#dce7df;font-size:14px}.compact .guide-info strong{font-size:12px}.compact .guide-info small{font-size:9px;margin-top:4px}.compact .audio-card{border-radius:15px;background:#edf3ee;padding:13px 12px;gap:10px}.compact .audio-icon{display:none}.compact .audio-title strong{font:600 16px/1.45 var(--display)}.compact .audio-title small{font-size:10px;margin-top:6px}.compact .audio-card button{width:42px;min-width:42px;height:42px}.compact .audio-card .stop-audio{width:26px;min-width:26px;height:26px}.narration-reading summary{display:flex;align-items:center;gap:7px;list-style:none;cursor:pointer;padding:13px 0;color:#476858;font-size:11px}.narration-reading summary::-webkit-details-marker{display:none}.narration-reading summary>span{margin-left:auto;color:var(--muted);font-size:10px}.narration-reading summary::after{content:'＋';font-size:15px}.narration-reading[open] summary::after{content:'−'}.compact .narration-copy{padding-bottom:14px}.compact .narration-copy section:first-child h4{margin-top:0}
</style>
