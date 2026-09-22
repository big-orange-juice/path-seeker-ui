<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from 'vue'
import { Bot, Link2, MapPin, Send, Sparkles, UserRound } from 'lucide-vue-next'
import type { CulturalPlace, TourRoute } from '../types'

interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string }

const props = defineProps<{ route: TourRoute; activePlace: CulturalPlace | null }>()
const prompt = shallowRef('')
const messages = shallowRef<ChatMessage[]>([])
const messageList = useTemplateRef<HTMLElement>('messageList')

const suggestions = computed(() => [
  `为${props.activePlace?.name ?? '当前站点'}增加到站提示`,
  '优化黄包车与步行接驳',
  '调整停靠点顺序',
])

async function sendPrompt(value = prompt.value) {
  const content = value.trim()
  if (!content) return
  const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content }
  const placeName = props.activePlace?.name ?? '当前站点'
  const reply: ChatMessage = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: content.includes('顺序')
      ? `已理解。可以先把 ${placeName} 设为当前调整基准，再拖动或指定它前后的停靠点。`
      : content.includes('步行') || content.includes('黄包车')
        ? `已为 ${placeName} 生成交通衔接建议：主路段使用黄包车，胡同窄路切换为步行，并保留到站提醒。`
        : `已生成 ${placeName} 的修改草案。会保留现有讲解版本，并把你的要求应用到当前路线节点。`,
  }
  messages.value = [...messages.value, userMessage, reply]
  prompt.value = ''
  await nextTick()
  messageList.value?.scrollTo({ top: messageList.value.scrollHeight, behavior: 'smooth' })
}
</script>

<template>
  <section class="outdoor-chat">
    <div ref="messageList" class="outdoor-chat__messages">
      <div v-if="messages.length === 0" class="outdoor-chat__empty">
        <span><Sparkles :size="18" /></span>
        <strong>用对话编辑当前路线</strong>
        <p>例如：给当前站点增加提示，或按主题补几个站点。</p>
        <div>
          <button v-for="suggestion in suggestions" :key="suggestion" @click="sendPrompt(suggestion)">{{ suggestion }}</button>
        </div>
      </div>
      <article v-for="message in messages" :key="message.id" :class="['chat-message', message.role]">
        <span><UserRound v-if="message.role === 'user'" :size="13" /><Bot v-else :size="13" /></span>
        <p>{{ message.content }}</p>
      </article>
    </div>

    <div class="outdoor-chat__composer">
      <div class="context-chips">
        <span><Link2 :size="11" />路线　{{ route.name }}</span>
        <span v-if="activePlace"><MapPin :size="11" />站点　{{ activePlace.name }}</span>
      </div>
      <div class="composer-box">
        <textarea v-model="prompt" rows="3" placeholder="描述你想对当前路线或站点做的修改…" @keydown.enter.exact.prevent="sendPrompt()" />
        <div><small>Enter 发送 · Shift+Enter 换行</small><button aria-label="发送" @click="sendPrompt()"><Send :size="15" /></button></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.outdoor-chat{height:100%;min-height:0;display:flex;flex-direction:column;border:1px solid #2c3035;border-radius:10px;background:#101317;overflow:hidden}.outdoor-chat__messages{flex:1;min-height:0;overflow:auto;padding:14px}.outdoor-chat__empty{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#9ca3aa}.outdoor-chat__empty>span{width:36px;height:36px;border:1px solid #4c432d;border-radius:50%;display:grid;place-items:center;color:#d5b15b;background:#211e17}.outdoor-chat__empty strong{margin-top:13px;color:#dfe2e4;font-size:12px}.outdoor-chat__empty p{max-width:210px;margin:7px 0 14px;font-size:9px;line-height:1.7;color:#7f878e}.outdoor-chat__empty>div{display:flex;flex-direction:column;gap:6px;width:100%;max-width:220px}.outdoor-chat__empty button{border:1px solid #2c3136;border-radius:6px;background:#171a1e;color:#aeb5bb;padding:7px 9px;font-size:8px;text-align:left}.outdoor-chat__empty button:hover{border-color:#665735;color:#e2c376}.chat-message{display:grid;grid-template-columns:25px 1fr;gap:7px;margin-bottom:10px}.chat-message>span{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#25292e;color:#b9c0c5}.chat-message p{margin:0;padding:8px 9px;border-radius:8px;background:#1b1f24;color:#d8dcdf;font-size:9px;line-height:1.6}.chat-message.user>span{background:#453a24;color:#e1bd65}.chat-message.user p{background:#242016;color:#ead7a7}.outdoor-chat__composer{border-top:1px solid #2c3035;padding:11px}.context-chips{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}.context-chips span{display:flex;align-items:center;gap:4px;min-width:0;max-width:100%;padding:4px 7px;border:1px solid #5e4f2f;border-radius:12px;color:#d8b65f;font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.composer-box{border:1px solid #34383e;border-radius:8px;background:#16191e;padding:8px}.composer-box textarea{width:100%;resize:none;border:0;outline:0;background:transparent;color:#edf0f2;font-size:10px;line-height:1.5}.composer-box>div{display:flex;align-items:center;justify-content:space-between}.composer-box small{color:#717980;font-size:7px}.composer-box button{width:29px;height:29px;border:0;border-radius:50%;display:grid;place-items:center;background:#806b39;color:#fff}
</style>
