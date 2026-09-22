<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import { ArrowUpRight, Bot, Maximize2, MessageCircle, Mic2, Pause, Send, Volume2, X } from 'lucide-vue-next'
import type { Scene } from '../types'
import { useGuidePlayback } from '../composables/useGuidePlayback'

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
}

const props = defineProps<{ destinationName: string; selectedPlaceName?: string; scene: Scene }>()
const emit = defineEmits<{ close: []; selectPlace: [] }>()
const mode = shallowRef<'voice' | 'text'>('voice')
const draft = shallowRef('')
const sending = shallowRef(false)
const messages = ref<ChatMessage[]>([
  { id: 'welcome', role: 'assistant', text: `你好，我在${props.destinationName}。\n打字提问，我会朗读回复；位置等信息可在气泡里点开。` },
])
const messageList = useTemplateRef<HTMLDivElement>('messageList')
const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
const speakingId = shallowRef('')
const guidePlayback = useGuidePlayback()
let currentUtterance: SpeechSynthesisUtterance | undefined
let replyTimer: number | undefined

function stopSpeaking() {
  if (currentUtterance) {
    currentUtterance.onend = null
    currentUtterance.onerror = null
    window.speechSynthesis.cancel()
    currentUtterance = undefined
  }
  speakingId.value = ''
}

function scrollMessages() {
  requestAnimationFrame(() => messageList.value?.scrollTo({ top: messageList.value.scrollHeight, behavior: 'smooth' }))
}

function speak(message: ChatMessage) {
  if (!supported || message.role !== 'assistant') return
  if (speakingId.value === message.id) {
    stopSpeaking()
    return
  }
  guidePlayback.narration.stop()
  stopSpeaking()
  window.speechSynthesis.resume()
  const utterance = new SpeechSynthesisUtterance(message.text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.95
  utterance.onend = () => { if (currentUtterance === utterance) { currentUtterance = undefined; speakingId.value = '' } }
  utterance.onerror = utterance.onend
  currentUtterance = utterance
  speakingId.value = message.id
  window.speechSynthesis.speak(utterance)
}

function replyFor(question: string) {
  const place = props.selectedPlaceName ? `当前选中的${props.selectedPlaceName}` : `这段${props.scene === 'rickshaw' ? '后海路线' : '场馆路线'}`
  if (/路线|怎么走|下一站/.test(question)) return `${place}可以从右侧“游览路线”查看完整站序。开始体验后，我会把下一站标出来。`
  if (/吃|喝|餐|咖啡/.test(question)) return '后海周边有不少餐饮和茶馆，建议把用餐安排在路线中段，并以现场营业情况为准。'
  if (/门票|开放|预约/.test(question)) return '故居、王府和宗教场所的开放安排可能变化，出发前请以官方公告和现场提示为准。'
  return `我可以帮你了解${props.destinationName}的地点故事、路线顺序和参观提示。你可以问我“下一站怎么走”或“这里需要预约吗”。`
}

function send() {
  const text = draft.value.trim()
  if (!text || sending.value) return
  messages.value.push({ id: `user-${Date.now()}`, role: 'user', text })
  draft.value = ''
  sending.value = true
  scrollMessages()
  replyTimer = window.setTimeout(() => {
    messages.value.push({ id: `assistant-${Date.now()}`, role: 'assistant', text: replyFor(text) })
    sending.value = false
    scrollMessages()
  }, 500)
}

function close() {
  if (replyTimer) window.clearTimeout(replyTimer)
  stopSpeaking()
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    send()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  if (replyTimer) window.clearTimeout(replyTimer)
  window.removeEventListener('keydown', handleKeydown)
  stopSpeaking()
})
</script>

<template>
  <div class="ask-layer" @click.self="close">
    <section class="ask-panel" role="dialog" aria-modal="true" aria-labelledby="ask-title">
      <div class="ask-handle" aria-hidden="true" />
      <header class="ask-header">
        <div class="ask-brand"><span class="ask-mark"><Volume2 :size="16" /></span><span><small>馆内小助手</small><strong id="ask-title">语音模式</strong></span></div>
        <div class="ask-actions"><div class="ask-mode" aria-label="交互模式"><button :class="{ active: mode === 'text' }" :aria-pressed="mode === 'text'" @click="mode = 'text'"><MessageCircle :size="14" />文字</button><button :class="{ active: mode === 'voice' }" :aria-pressed="mode === 'voice'" @click="mode = 'voice'"><Mic2 :size="14" />语音</button></div><button class="ask-icon-button" aria-label="放大助手面板" title="放大助手面板"><Maximize2 :size="16" /></button><button class="ask-icon-button" aria-label="关闭问一问" title="关闭问一问" @click="close"><X :size="18" /></button></div>
      </header>
      <div class="ask-status"><strong>就绪</strong><span>回复会出现在下方气泡，可点位置卡</span></div>
      <div ref="messageList" class="ask-messages" aria-live="polite">
        <article v-for="message in messages" :key="message.id" class="ask-message" :class="message.role"><div v-if="message.role === 'assistant'" class="message-avatar"><Bot :size="15" /></div><p>{{ message.text }}</p><button v-if="message.role === 'assistant' && supported" class="speak-message" :aria-label="speakingId === message.id ? '停止朗读' : '朗读回复'" @click="speak(message)"><Pause v-if="speakingId === message.id" :size="13" /><Volume2 v-else :size="13" /></button></article>
        <div v-if="sending" class="ask-typing" role="status"><span /><span /><span />正在整理路线信息…</div>
      </div>
      <div class="ask-suggestions"><button @click="draft = '下一站怎么走？'">下一站怎么走？<ArrowUpRight :size="13" /></button><button @click="draft = '这里需要预约吗？'">这里需要预约吗？<ArrowUpRight :size="13" /></button><button @click="emit('selectPlace')">查看当前地点<ArrowUpRight :size="13" /></button></div>
      <form class="ask-composer" @submit.prevent="send"><input v-model="draft" :placeholder="mode === 'voice' ? '打字提问，回复将朗读…' : '输入你想了解的内容…'" aria-label="打字提问" /><button class="send-button" type="submit" aria-label="发送" :disabled="sending || !draft.trim()"><Send :size="17" /></button></form>
      <p v-if="!supported" class="ask-note">当前浏览器不支持语音朗读，仍可继续使用文字问答。</p>
    </section>
  </div>
</template>

<style scoped>
.ask-layer{position:fixed;inset:0;z-index:60;background:#183e4352;display:flex;align-items:flex-end;justify-content:center}.ask-panel{position:relative;width:min(100%,680px);height:min(690px,calc(100dvh - 35px));display:flex;flex-direction:column;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-bottom:0;border-radius:24px 24px 0 0;box-shadow:0 -10px 50px #183e4324;overflow:hidden}.ask-handle{width:39px;height:4px;border-radius:9px;background:#c3d1c8;margin:9px auto 3px}.ask-header{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:12px 16px 15px;border-bottom:1px solid var(--line)}.ask-brand{display:flex;align-items:center;gap:10px}.ask-mark{display:grid;place-items:center;width:36px;height:36px;border:1px solid #cadbd1;border-radius:50%;color:var(--lake);background:#e5eee8}.ask-brand span:last-child{display:grid;gap:5px}.ask-brand small{font-size:10px;color:#65796d;font-weight:600}.ask-brand strong{font:600 19px var(--display);color:var(--ink)}.ask-actions{display:flex;align-items:center;gap:6px}.ask-mode{display:flex;padding:2px;background:#edf2ee;border:1px solid var(--line);border-radius:18px}.ask-mode button{display:flex;align-items:center;gap:4px;border:0;border-radius:15px;padding:7px 10px;background:transparent;color:#65766d;font-size:11px}.ask-mode button.active{background:var(--lake);color:#ffffff;font-weight:700}.ask-icon-button{display:grid;place-items:center;width:34px;height:34px;border:1px solid var(--line);border-radius:10px;background:#ffffff;color:#65766d}.ask-icon-button:hover{background:#e8efea}.ask-status{display:flex;gap:10px;align-items:center;padding:10px 14px;color:#65766d;font-size:11px;border-bottom:1px solid var(--line)}.ask-status strong{color:var(--lake)}.ask-messages{flex:1;overflow-y:auto;padding:18px 13px 10px;scrollbar-width:thin;scrollbar-color:#c6d6cc transparent}.ask-message{position:relative;display:flex;gap:9px;max-width:92%;margin-bottom:15px;align-items:flex-start}.ask-message p{white-space:pre-line;margin:0;padding:14px 14px;border:1px solid #d9e4dc;border-radius:16px 16px 16px 5px;background:#ffffff;color:var(--ink);font-size:14px;line-height:1.75}.message-avatar{display:grid;place-items:center;flex-shrink:0;width:26px;height:26px;margin-top:8px;border:1px solid #cadbd1;border-radius:50%;color:var(--lake);background:#e5eee8}.ask-message.user{margin-left:auto;justify-content:flex-end}.ask-message.user p{border:1px solid #cbded3;border-radius:16px 16px 5px 16px;background:#e3eee7;color:var(--lake)}.speak-message{align-self:flex-end;display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:50%;background:transparent;color:#527567}.ask-typing{display:flex;align-items:center;gap:5px;color:#65766d;font-size:11px;padding:3px 0 12px 35px}.ask-typing span{width:4px;height:4px;border-radius:50%;background:#527567;animation:pulse 1s infinite}.ask-typing span:nth-child(2){animation-delay:.15s}.ask-typing span:nth-child(3){animation-delay:.3s}.ask-suggestions{display:flex;gap:7px;overflow-x:auto;padding:9px 13px;border-top:1px solid var(--line);scrollbar-width:none}.ask-suggestions button{display:flex;align-items:center;gap:3px;flex-shrink:0;border:1px solid #d6e2d9;border-radius:14px;padding:7px 10px;background:#ffffff;color:#496657;font-size:10px}.ask-suggestions button:hover{border-color:#8eaaa0;background:#edf3ef}.ask-composer{display:flex;align-items:center;gap:8px;padding:10px 10px max(15px,env(safe-area-inset-bottom));border-top:1px solid var(--line);background:#ffffff}.ask-composer input{min-width:0;flex:1;height:42px;border:1px solid #d6e2d9;border-radius:22px;padding:0 16px;background:#ffffff;color:var(--ink);outline:0;font-size:12px}.ask-composer input:focus{border-color:#527567}.ask-composer input::placeholder{color:#7b8a80}.send-button{display:grid;place-items:center;width:39px;height:39px;border:0;border-radius:50%;background:var(--lake);color:#ffffff}.send-button:disabled{background:#dfe8e2;color:#778b7d}.ask-note{margin:0;padding:0 14px 12px;color:#65766d;font-size:10px}@keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
@media(max-width:760px){.ask-panel{width:100%;height:min(690px,calc(100dvh - 30px));border-radius:24px 24px 0 0}.ask-header{padding-left:12px;padding-right:12px}.ask-brand strong{font-size:18px}.ask-mode button{padding:7px 8px}.ask-message p{font-size:13px}.ask-suggestions{padding-left:10px;padding-right:10px}}
</style>
