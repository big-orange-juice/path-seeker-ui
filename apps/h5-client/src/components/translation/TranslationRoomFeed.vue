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
        <article class="chat-message" :class="{ 'is-self': room.isHost }">
          <span class="chat-avatar chat-avatar-guide"><Mic :size="18" aria-hidden="true" /></span>
          <div class="chat-message-body">
            <span class="chat-sender">{{ room.isHost ? messages.me : messages.guide }}</span>
            <div class="chat-bubble chat-bilingual">
              <section v-for="item in group.translations" :key="item.id" class="chat-translation" :class="{ 'has-error': item.status === 'error' }" :aria-label="item.languageLabel">
                <span class="chat-language">{{ item.languageLabel }}</span>
                <p class="chat-message-text" :lang="item.status === 'error' || !item.text ? language : item.language">{{ item.status === 'error' ? localizeRoomNotice(item.text, language, 'translationUnavailable') || messages.translationUnavailable : item.text || (item.status === 'translating' ? messages.translating : messages.noTranslation) }}</p>
                <span v-if="item.status !== 'complete'" class="chat-delivery" role="status">{{ item.status === 'translating' ? messages.translating : messages.segmentUnavailable }}</span>
              </section>
              <div v-if="group.source" class="chat-source" :lang="room.sourceLanguage"><span class="chat-language">{{ formatRoomMessage(messages.original, { language: sourceLanguage }) }}</span><p class="chat-message-text">{{ group.source }}</p></div>
            </div>
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
.chat-scroll{box-sizing:border-box;height:100%;overflow-y:auto;overscroll-behavior:contain;padding:18px 22px 28px;scrollbar-width:thin;scrollbar-color:#c4d6c9 transparent}
.chat-system{margin:0 0 22px;color:#8b9e90;font-size:10px;line-height:1.8;text-align:center}.chat-divider{display:flex;align-items:center;gap:10px;margin:22px 0 12px;color:#8b9e90;font-size:10px;line-height:1.6}.chat-divider::after{flex:1;height:1px;background:#dce7df;content:''}
.chat-empty{display:flex;flex-direction:column;align-items:center;max-width:280px;margin:60px auto;color:#688171;text-align:center}.chat-empty-icon{display:grid;place-items:center;width:72px;height:72px;margin-bottom:20px;border:1px solid #d9e5dc;border-radius:24px;background:#fcfefd;color:#367a68;box-shadow:0 6px 20px #183e4305}.chat-empty strong{color:#436354;font:600 19px/1.6 "Noto Serif SC","Songti SC","STSong",serif}.chat-empty p{margin:10px 0;font-size:12px;line-height:1.9}
.chat-message{display:flex;align-items:flex-start;gap:10px;margin:0 0 18px}.chat-avatar{display:grid;place-items:center;flex:0 0 30px;width:30px;height:30px;border-radius:11px;background:#183e43;color:#fff}.chat-avatar>svg{width:15px;height:15px}.chat-message-body{flex:1;min-width:0;max-width:calc(100% - 40px)}.chat-sender{display:block;margin:0 0 7px;color:#75897d;font-size:10px;line-height:1.5}
.chat-bubble{box-sizing:border-box;width:100%;max-width:100%;padding:17px 18px;border:1px solid #d9e5dc;border-radius:4px 19px 19px 19px;background:#fcfefd;color:#294b3d;font-size:16px;line-height:1.85;white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:0 4px 14px #183e4304}.chat-language{display:block;width:fit-content;margin-bottom:7px;padding:2px 7px;border:1px solid #dce8df;border-radius:6px;background:#edf4ef;color:#688171;font-size:10px;line-height:1.5}.chat-message-text{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.chat-delivery{display:block;margin-top:7px;color:#8b9e90;font-size:10px;line-height:1.7}
.chat-bilingual{white-space:normal}.chat-translation+.chat-translation,.chat-source{margin-top:16px;padding-top:14px;border-top:1px solid #e2ebe5}.chat-source:first-child{margin-top:0;padding-top:0;border:0}.chat-source{color:#75897d;font-size:12px;line-height:1.8}.chat-source .chat-language{padding:0;border:0;background:transparent;color:#8b9e90}.is-self .chat-avatar{background:#367a68}.is-self .chat-bubble{border-color:#cfe1d5;background:#f7fbf8}.has-error .chat-message-text,.has-error .chat-delivery{color:#a05c4c}
.chat-latest{position:absolute;right:22px;bottom:14px;display:flex;align-items:center;gap:7px;min-height:44px;padding:10px 14px;border:1px solid #d9e5dc;border-radius:14px;background:#fcfefd;color:#183e43;font-size:12px;box-shadow:0 6px 24px #183e4312;cursor:pointer}.chat-latest:focus-visible{outline:2px solid #183e43;outline-offset:3px}
@media(max-width:420px){.chat-scroll{padding-right:16px;padding-left:16px}.chat-bubble{padding:14px 15px;font-size:15px}.chat-avatar{flex-basis:26px;width:26px;height:28px;border-radius:9px}.chat-message{gap:8px}.chat-message-body{max-width:calc(100% - 34px)}}
</style>
