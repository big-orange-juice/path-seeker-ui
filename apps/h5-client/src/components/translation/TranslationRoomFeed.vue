<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { ArrowDown, Headphones, Mic } from 'lucide-vue-next'
import { groupRoomMessages, ROOM_LANGUAGES, type RoomTextItem } from '../../../../../packages/ts-shared/src/translation-room'
import type { TranslationRoom } from '@/services/translationRoom'
import { formatRoomMessage, localizeRoomNotice, roomMessages } from '../../../../../packages/ts-shared/src/translation-room-messages'

const props = defineProps<{ room: TranslationRoom; items: RoomTextItem[]; source: string; language: string }>()
const messages = computed(() => roomMessages(props.language))
const viewport = useTemplateRef<HTMLElement>('viewport')
const following = shallowRef(true)
const groups = computed(() => groupRoomMessages(props.items))
const sourceLanguage = computed(() => ROOM_LANGUAGES.find(item => item.value === props.room.sourceLanguage)?.label || props.room.sourceLanguage)
const pendingSource = computed(() => props.source && groups.value[groups.value.length - 1]?.source !== props.source ? props.source : '')

function trackScroll() {
  const element = viewport.value
  if (element) following.value = element.scrollHeight - element.scrollTop - element.clientHeight < 90
}

function scrollToLatest() {
  const element = viewport.value
  if (element) element.scrollTop = element.scrollHeight
  following.value = true
}

watch([() => props.items, () => props.source], async () => {
  if (!following.value) return
  await nextTick()
  scrollToLatest()
}, { flush: 'post' })
onMounted(scrollToLatest)
</script>

<template>
  <section class="chat-timeline" :aria-label="messages.chatLog">
    <div ref="viewport" class="chat-scroll" @scroll.passive="trackScroll">
      <p class="chat-system">{{ messages.entered }}</p>
      <div v-if="!groups.length && !source" class="chat-empty">
        <span class="chat-empty-icon"><Headphones :size="28" aria-hidden="true" /></span>
        <strong>{{ room.isHost ? messages.hostEmpty : messages.guestEmpty }}</strong>
        <p>{{ room.isHost ? messages.hostHint : messages.guestHint }}</p>
      </div>
      <section v-for="group in groups" :key="group.id" class="chat-segment" :aria-label="formatRoomMessage(messages.segment, { number: group.sequence })">
        <p class="chat-divider">{{ formatRoomMessage(messages.segment, { number: group.sequence }) }}</p>
        <article v-if="group.source" class="chat-message" :class="{ 'is-self': room.isHost }">
          <span class="chat-avatar chat-avatar-guide"><Mic :size="18" aria-hidden="true" /></span>
          <div class="chat-message-body"><span class="chat-sender">{{ room.isHost ? messages.me : messages.guide }} · {{ formatRoomMessage(messages.original, { language: sourceLanguage }) }}</span><div class="chat-bubble chat-original" :lang="room.sourceLanguage">{{ group.source }}</div></div>
        </article>
        <article v-for="item in group.translations" :key="item.id" class="chat-message" :class="{ 'has-error': item.status === 'error' }">
          <span class="chat-avatar chat-avatar-translation" aria-hidden="true">{{ item.language.split('-')[0].toUpperCase() }}</span>
          <div class="chat-message-body">
            <span class="chat-sender">{{ messages.assistant }} <span class="chat-language">{{ item.languageLabel }}</span></span>
            <div class="chat-bubble"><p class="chat-message-text" :lang="item.status === 'error' || !item.text ? language : item.language">{{ item.status === 'error' ? localizeRoomNotice(item.text, language, 'translationUnavailable') || messages.translationUnavailable : item.text || (item.status === 'translating' ? messages.translating : messages.noTranslation) }}</p></div>
            <span v-if="item.status !== 'complete'" class="chat-delivery" role="status">{{ item.status === 'translating' ? messages.translating : messages.segmentUnavailable }}</span>
          </div>
        </article>
      </section>
      <article v-if="pendingSource" class="chat-message chat-pending" :class="{ 'is-self': room.isHost }">
        <span class="chat-avatar chat-avatar-guide"><Mic :size="18" aria-hidden="true" /></span>
        <div class="chat-message-body"><span class="chat-sender">{{ room.isHost ? messages.me : messages.guide }} · {{ formatRoomMessage(messages.original, { language: sourceLanguage }) }}</span><div class="chat-bubble chat-original" :lang="room.sourceLanguage">{{ pendingSource }}</div><span class="chat-delivery">{{ messages.preparing }}</span></div>
      </article>
    </div>
    <button v-if="!following" type="button" class="chat-latest" @click="scrollToLatest"><ArrowDown :size="14" aria-hidden="true" />{{ messages.latest }}</button>
  </section>
</template>

<style scoped>
.chat-timeline{position:relative;flex:1;min-height:0;overflow:hidden}
.chat-scroll{height:100%;overflow-y:auto;overscroll-behavior:contain;padding:18px 16px 26px;scrollbar-width:thin;scrollbar-color:#c4d1ca transparent}
.chat-system,.chat-divider{margin:0 0 22px;text-align:center;color:#8a9790;font-size:11px;line-height:1.7}
.chat-divider{margin:22px 0 16px}
.chat-empty{display:flex;flex-direction:column;align-items:center;max-width:280px;margin:60px auto;color:#60776d;text-align:center}
.chat-empty-icon{display:grid;place-items:center;width:68px;height:68px;margin-bottom:20px;border:1px solid #d4e0d9;border-radius:22px;background:#f8faf9;color:#577868}
.chat-empty strong{font-size:15px;font-weight:500}.chat-empty p{margin:10px 0;font-size:13px;line-height:1.9}
.chat-message{display:flex;align-items:flex-start;gap:10px;margin:0 0 20px}
.chat-avatar{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;border-radius:11px;font:600 11px/1 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
.chat-avatar-guide{background:#183e43;color:#fff}.chat-avatar-translation{border:1px solid #d4e0d9;background:#f8faf9;color:#587066}
.chat-message-body{min-width:0;max-width:calc(100% - 66px)}
.chat-sender{display:flex;align-items:center;gap:8px;margin:0 0 6px;color:#7b8a80;font-size:11px;line-height:1.5}
.chat-language{color:#587066;font-size:10px}
.chat-bubble{position:relative;width:fit-content;max-width:100%;padding:11px 14px;border:1px solid #e0e7e2;border-radius:3px 13px 13px 13px;background:#fff;color:#27453e;font-size:15px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:0 1px 2px #183e4304}
.chat-message-text{margin:0}.chat-delivery{display:block;margin-top:6px;color:#8a9790;font-size:10px;line-height:1.6}
.is-self{flex-direction:row-reverse}.is-self .chat-message-body{display:flex;flex-direction:column;align-items:flex-end}.is-self .chat-bubble{border-color:#cfdfd2;border-radius:13px 3px 13px 13px;background:#dce9df}.is-self .chat-sender{justify-content:flex-end}
.has-error .chat-bubble{color:#a4483b;background:#fff8f5;border-color:#ecd8d1}.has-error .chat-delivery{color:#a4483b}
.chat-latest{position:absolute;right:16px;bottom:14px;display:flex;align-items:center;gap:6px;min-height:36px;padding:8px 12px;border:1px solid #d4e0d9;border-radius:20px;background:#fff;color:#183e43;font-size:12px;box-shadow:0 3px 12px #183e4310;cursor:pointer}.chat-latest:focus-visible{outline:2px solid #183e43;outline-offset:2px}
</style>
