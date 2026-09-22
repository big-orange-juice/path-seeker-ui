<script setup lang="ts">
import { computed } from 'vue'
import { MessageCircle, Music2 } from 'lucide-vue-next'
import { useGuidePlayback } from '../composables/useGuidePlayback'

const emit = defineEmits<{ ask: [] }>()
const playback = useGuidePlayback()
const playing = computed(() => playback.narration.state.value === 'playing')
const action = computed(() => playing.value ? '暂停当前讲解' : playback.narration.state.value === 'paused' ? '继续当前讲解' : '播放当前讲解')
</script>

<template>
  <div class="map-quick-actions" role="group" aria-label="语音与对话">
    <button class="voice-action" :class="{ playing }" :aria-label="action" :aria-pressed="playing" :title="`${action} · ${playback.title.value}`" :disabled="!playback.available.value" @click="playback.toggle"><Music2 class="music-note" :size="20" /><span class="playback-dot" aria-hidden="true" /></button>
    <button aria-label="打开聊天对话框" title="问一问" @click="emit('ask')"><MessageCircle :size="20" /></button>
    <p v-if="playback.narration.error.value" class="voice-error" role="status">{{ playback.narration.error.value }}</p>
  </div>
</template>

<style scoped>
.map-quick-actions{position:absolute;right:24px;bottom:45px;z-index:4;display:grid;gap:9px}.map-quick-actions button{position:relative;display:grid;place-items:center;width:40px;height:40px;border:1px solid #dce6df;border-radius:50%;background:#fcfdfc;color:var(--lake);box-shadow:0 3px 14px #183e4320}.map-quick-actions button:hover{background:#edf3ee}.map-quick-actions button:disabled{opacity:.5;cursor:default}.map-quick-actions .playing{background:var(--lake);color:white;border-color:var(--lake)}.music-note{animation:record-turn 5s linear infinite;animation-play-state:paused;transform-origin:center}.playing .music-note{animation-play-state:running}.playback-dot{position:absolute;right:5px;bottom:5px;width:6px;height:6px;border-radius:50%;background:#9cab9f;border:1px solid #fcfdfc}.playing .playback-dot{background:#e5b957}.voice-error{position:absolute;right:50px;top:0;width:190px;margin:0;padding:10px;border-radius:10px;background:#fcfdfc;box-shadow:0 3px 14px #183e4320;color:var(--lake);font-size:11px;line-height:1.7}@keyframes record-turn{to{transform:rotate(360deg)}}
@media(max-width:760px){.map-quick-actions{right:10px;top:calc(var(--toolbar-height) + 184px);bottom:auto}}
.map-quick-actions .playing:hover{background:#24555a}
@media(prefers-reduced-motion:reduce){.music-note{animation:none}}
</style>
