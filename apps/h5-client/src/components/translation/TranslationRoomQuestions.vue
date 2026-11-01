<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { questionMessages, questionStatus, type RoomQuestion } from '../../../../../packages/ts-shared/src/translation-room-questions'

const props = defineProps<{ host: boolean; language: string; items: RoomQuestion[]; recording: boolean; uploading: boolean; playing: boolean; speaking: boolean; disabled: boolean; error: string }>()
const emit = defineEmits<{ start: []; stop: []; cancel: []; listen: []; stopPlayback: [] }>()
const messages = computed(() => questionMessages(props.language))
const expanded = shallowRef(false)
const visible = computed(() => expanded.value ? props.items : props.items.slice(-2))
const pending = computed(() => props.items.some(item => item.status === 'ready' && item.audioAvailable))
let held = false
function start(event: PointerEvent) {
  if (props.disabled || props.uploading || held) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  held = true; emit('start')
}
function stop() { if (held) { held = false; emit('stop') } }
function cancel() { held = false; emit('cancel') }
function keyStart(event: KeyboardEvent) { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat && !props.disabled && !props.uploading) { event.preventDefault(); held = true; emit('start') } }
function keyStop(event: KeyboardEvent) { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); stop() } }
onBeforeUnmount(cancel)
</script>

<template>
  <section class="room-questions" :aria-label="messages.title">
    <button v-if="items.length" type="button" class="question-heading" @click="expanded = !expanded">{{ messages.title }} · {{ items.length }} <span>{{ expanded ? '−' : '+' }}</span></button>
    <div v-if="items.length" class="question-list" aria-live="polite">
      <article v-for="item in visible" :key="item.id" class="question-item">
        <div class="question-meta"><strong>{{ item.displayName }}</strong><span>{{ questionStatus(item.status, language) }}</span></div>
        <p v-if="item.text" :lang="item.targetLanguage">{{ item.text }}</p>
        <p v-if="item.source" class="question-source" :lang="item.sourceLanguage">{{ item.source }}</p>
      </article>
    </div>
    <p v-if="error" class="question-error" role="alert">{{ error }}</p>
    <template v-if="!host">
      <div class="question-actions">
        <button class="question-talk" :class="{ recording }" type="button" :disabled="disabled || uploading" @pointerdown="start" @pointerup="stop" @pointercancel="cancel" @lostpointercapture="stop" @contextmenu.prevent @keydown="keyStart" @keyup="keyStop" @blur="cancel">{{ uploading ? messages.sending : recording ? messages.recording : messages.talk }}</button>
        <button v-if="recording" type="button" class="question-cancel" @click="cancel">{{ messages.cancel }}</button>
      </div>
      <p class="question-hint">{{ messages.hint }}</p>
    </template>
    <button v-else-if="pending || playing" type="button" class="question-listen" :disabled="disabled" @click="playing ? emit('stopPlayback') : emit('listen')">{{ playing ? messages.stop : speaking ? messages.pauseListen : messages.listen }}</button>
  </section>
</template>

<style scoped>
.room-questions{margin:0 0 10px;border-bottom:1px solid #d9e5dc;padding-bottom:10px}.question-heading{display:flex;justify-content:space-between;width:100%;padding:0 0 8px;border:0;background:transparent;color:#367a68;font-size:12px;text-align:left}.question-list{max-height:24dvh;overflow:auto;overscroll-behavior:contain}.question-item{margin-bottom:8px;padding:10px 12px;border-radius:12px;background:#edf4ef;color:#294b3d}.question-meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px;font-size:11px}.question-meta span,.question-source{color:#75897d}.question-item p{margin:6px 0 0;font-size:14px;line-height:1.6;overflow-wrap:anywhere;white-space:pre-wrap}.question-item .question-source{font-size:11px}.question-actions{display:flex;gap:8px}.question-talk,.question-listen,.question-cancel{min-height:44px;padding:10px 12px;border:1px solid #bcd4c5;border-radius:12px;background:#edf4ef;color:#294b3d;font-size:13px;line-height:1.5}.question-talk,.question-listen{flex:1;width:100%}.question-talk{touch-action:none;user-select:none;-webkit-user-select:none}.question-talk.recording{background:#dcece2;border-color:#367a68}.question-hint{margin:5px 0 0;color:#75897d;font-size:10px;text-align:center}.question-error{color:#a05c4c;font-size:12px}button:disabled{opacity:.5}button:focus-visible{outline:2px solid #183e43;outline-offset:2px}
</style>
