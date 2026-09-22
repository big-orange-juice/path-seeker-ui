<script setup lang="ts">
import { computed } from 'vue'
import { Headphones, LocateFixed, Minus, Pause, Play, Plus, Square } from 'lucide-vue-next'
import { useGuidePlayback } from '../composables/useGuidePlayback'

defineEmits<{ zoom: [direction: number]; recenter: [] }>()
const playback = useGuidePlayback()
const state = playback.narration.state
const playing = computed(() => state.value === 'playing')
const action = computed(() => playing.value ? '暂停故事' : state.value === 'paused' ? '继续故事' : '播放故事')
</script>

<template>
  <div class="tour-camera" role="group" aria-label="游览地图工具">
    <div class="tour-zoom">
      <button type="button" aria-label="放大游览地图" title="放大地图" @click="$emit('zoom', 1)"><Plus :size="21" /></button>
      <button type="button" aria-label="缩小游览地图" title="缩小地图" @click="$emit('zoom', -1)"><Minus :size="21" /></button>
    </div>
    <button type="button" class="recenter" aria-label="回到游览视角" title="回到游览视角" @click="$emit('recenter')"><LocateFixed :size="23" /></button>
  </div>
  <div class="tour-audio" :class="{ playing }" role="group" aria-label="导航故事播放器">
    <Headphones class="audio-symbol" :size="18" aria-hidden="true" />
    <button type="button" class="play-button" :aria-label="action" :title="`${action} · ${playback.title.value}`" :disabled="!playback.available.value || !playback.narration.supported" @click="playback.toggle">
      <Pause v-if="playing" :size="23" fill="currentColor" /><Play v-else :size="23" fill="currentColor" />
    </button>
    <button type="button" class="stop-button" aria-label="停止故事" title="停止故事" :disabled="state === 'idle'" @click="playback.narration.stop"><Square :size="17" /></button>
  </div>
  <p v-if="playback.narration.error.value" class="audio-feedback" role="status">{{ playback.narration.error.value }}</p>
</template>

<style scoped>
.tour-camera{position:absolute;right:18px;bottom:calc(110px + env(safe-area-inset-bottom,0px));z-index:4;display:grid;gap:12px}
.tour-camera button{display:grid;place-items:center;width:48px;height:48px;padding:0;border:0;background:#f9fcfff2;color:#285473}
.tour-zoom{overflow:hidden;border:1px solid #fff;border-radius:20px;box-shadow:0 5px 22px #28547320;backdrop-filter:blur(12px)}
.tour-zoom button+button{border-top:1px solid #dde8ef}
.tour-camera .recenter{border:1px solid white;border-radius:50%;color:#148ce0;box-shadow:0 5px 22px #28547320}
.tour-audio{position:absolute;bottom:calc(28px + env(safe-area-inset-bottom,0px));left:50%;z-index:4;display:flex;align-items:center;gap:14px;padding:8px 14px;border:1px solid #fff;border-radius:36px;background:#f7fcfff2;box-shadow:0 7px 28px #28547326;backdrop-filter:blur(16px);transform:translateX(-50%);color:#547b92}
.tour-audio button{display:grid;place-items:center;padding:0;border:0;border-radius:50%}
.play-button{width:48px;height:48px;background:#193e52;color:white;box-shadow:0 3px 12px #193e5233}
.playing .play-button{background:#087fc0}
.stop-button{width:32px;height:40px;background:transparent;color:#285473}
.tour-audio button:disabled{opacity:.35;cursor:default}
.audio-feedback{position:absolute;left:80px;right:80px;bottom:110px;z-index:5;margin:0;padding:10px 12px;border-radius:12px;background:#fff;color:#285473;font-size:12px;line-height:1.6}
@media(max-width:360px){.tour-audio{gap:8px;padding:6px 10px}.audio-symbol{display:none}.tour-camera{right:12px}}
</style>
