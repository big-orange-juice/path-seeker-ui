<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue'
import { useScrollLock, useWindowSize } from '@vueuse/core'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { ArrowLeft, Headphones, Mic, MoreHorizontal, Volume2 } from 'lucide-vue-next'
import TranslationRoomControls from './TranslationRoomControls.vue'
import TranslationRoomFeed from './TranslationRoomFeed.vue'
import TranslationRoomDetails from './TranslationRoomDetails.vue'
import { useTranslationRoom } from '@/composables/useTranslationRoom'
import { useAuthStore } from '@/stores/useAuthStore'
import { formatRoomMessage } from '../../../../../packages/ts-shared/src/translation-room-messages'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feature = useTranslationRoom()
const { room, canHost, permissionPending, source, displayNotice: notice, displayError: error, language, messages, busy, listening, speaking, muted, audioBlocked, audioNotice, audioError, connected, navigationPath, feed } = feature
const showDetails = shallowRef(false)
const { height: viewportHeight } = useWindowSize({ type: 'visual', initialHeight: window.innerHeight })
const pageLocked = useScrollLock(document.body)
watch(room, value => { pageLocked.value = Boolean(value) }, { immediate: true })
const viewportStyle = computed(() => ({ '--room-viewport-height': `${viewportHeight.value}px` }))
const needsConnection = computed(() => !!room.value && room.value.status !== 'closed' && (!connected.value || (!room.value.isHost && !listening.value)))
const initialCode = typeof route.query.roomCode === 'string' ? route.query.roomCode : ''
onMounted(feature.loadPermission)

async function createRoom(language: string) {
  if (await feature.create(language)) await router.replace(navigationPath.value)
}

async function joinRoom(code: string, language: string) {
  if (await feature.join(code, language)) await router.replace(navigationPath.value)
}
</script>

<template>
  <Teleport to="body" :disabled="!room">
  <main class="translation-room" :class="{ 'is-chat': room }" :lang="language" :style="viewportStyle">
    <template v-if="!room">
      <header class="room-header"><RouterLink :to="navigationPath"><ArrowLeft :size="16" aria-hidden="true" />{{ messages.back }}</RouterLink><RouterLink :to="{ path: '/auth', query: { redirect: route.fullPath } }">{{ authStore.isAccountLoggedIn ? messages.manageAccount : messages.login }}</RouterLink></header>
      <div class="room-intro"><h1>{{ messages.title }}</h1><p>{{ messages.intro }}</p></div>
      <p class="room-notice" role="status"><span class="room-status-dot" aria-hidden="true" />{{ notice }}</p>
      <p v-if="error" role="alert" class="room-error">{{ error }}</p>
      <TranslationRoomControls v-if="!permissionPending" v-model:language="language" :can-host="canHost" :busy="busy" :initial-code="initialCode" @create="createRoom" @join="joinRoom" />
    </template>
    <template v-else>
      <header class="chat-header"><RouterLink class="chat-header-back" :to="navigationPath" :aria-label="messages.backConnected"><ArrowLeft :size="21" aria-hidden="true" /></RouterLink><div class="chat-heading"><h1>{{ messages.chatTitle }}</h1><span>{{ formatRoomMessage(messages.listeners, { count: room.listenerCount }) }} · {{ room.isHost ? messages.host : messages.liveTranslation }}</span></div><button type="button" class="chat-more" :aria-label="messages.more" :aria-expanded="showDetails" @click="showDetails = true"><MoreHorizontal :size="24" aria-hidden="true" /></button></header>
      <div class="chat-room-bar"><span><span class="room-status-dot" aria-hidden="true" />{{ room.status === 'closed' ? messages.ended : speaking || room.status === 'live' ? messages.live : messages.waiting }}</span><button type="button" @click="showDetails = true">{{ messages.roomCode }} {{ room.code }} ›</button></div>
      <p v-if="error" role="alert" class="chat-error">{{ error }}</p>
      <TranslationRoomFeed :room="room" :items="feed" :source="source" :language="language" />
      <footer class="chat-toolbar">
        <p class="chat-toolbar-status" role="status"><Volume2 v-if="!room.isHost" :size="13" aria-hidden="true" />{{ room.isHost ? notice : audioNotice }}</p>
        <div class="chat-toolbar-actions"><span class="chat-mode-icon"><Mic v-if="room.isHost" :size="22" aria-hidden="true" /><Headphones v-else :size="22" aria-hidden="true" /></span>
          <button v-if="needsConnection" type="button" class="chat-talk" :disabled="busy" @click="showDetails = true">{{ room.isHost ? messages.reconnect : messages.listenAgain }}</button>
          <button v-else-if="room.isHost" type="button" class="chat-talk" :class="{ 'is-speaking': speaking }" :disabled="busy || speaking || room.status === 'closed' || room.status === 'draining'" @click="feature.startSpeaking">{{ room.status === 'closed' ? messages.ended : speaking ? messages.micOn : messages.start }}</button>
          <button v-else type="button" class="chat-talk" :disabled="busy || !listening" @click="feature.toggleMute">{{ muted || audioBlocked || audioError ? messages.resume : messages.pause }}</button>
          <button type="button" class="chat-toolbar-more" :aria-label="messages.more" @click="showDetails = true"><MoreHorizontal :size="23" aria-hidden="true" /></button>
        </div>
      </footer>
      <TranslationRoomDetails v-if="showDetails" :room="room" :busy="busy" :language="language" @close="showDetails = false" @end="feature.end" @change-language="feature.changeLanguage" @leave="showDetails = false; feature.leave()"><template #connection><TranslationRoomControls v-if="needsConnection" v-model:language="language" :can-host="room.isHost" :busy="busy" :initial-code="room.code" @create="createRoom" @join="joinRoom" /></template></TranslationRoomDetails>
    </template>
  </main>
  </Teleport>
</template>

<style>
.translation-room{color-scheme:light;min-height:100dvh;background:#f8faf9;color:#183e43;padding:24px max(20px,calc((100vw - 600px)/2)) max(32px,env(safe-area-inset-bottom));font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
.translation-room .room-header{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:32px;font-size:13px}
.translation-room .room-header a,.translation-room .room-header>span{display:flex;align-items:center;gap:6px;color:#587066}
.translation-room .room-header a{min-height:44px;color:#183e43}
.translation-room .room-intro{margin:22px 0 20px}
.translation-room .room-intro h1{margin:0;font:600 30px/1.3 "Noto Serif SC","Songti SC","STSong",serif;letter-spacing:1px}
.translation-room .room-intro p{margin:8px 0 0;color:#7b8a80;font-size:13px;line-height:1.6}
.translation-room .room-notice{display:flex;align-items:center;gap:8px;margin:0 0 18px;color:#587066;font-size:12px;line-height:1.6}
.translation-room .room-status-dot{flex:0 0 6px;width:6px;height:6px;border-radius:50%;background:#6b8d7c}
.translation-room .room-form,.translation-room .room-session{display:grid;gap:22px;margin:0 0 18px;padding:22px;border:1px solid #d4e0d9;border-radius:18px;background:#fff;box-shadow:0 6px 22px #183e4307}
.translation-room .room-card-heading{display:flex;align-items:center;gap:12px}
.translation-room .room-card-icon{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border-radius:13px;background:#edf5ef;color:#183e43}
.translation-room .room-card-heading h2{margin:0;color:#183e43;font-size:18px;font-weight:600;line-height:1.4}
.translation-room .room-card-heading p{margin:4px 0 0;color:#7b8a80;font-size:12px;line-height:1.6}
.translation-room .room-field-label{display:grid;gap:10px;color:#2b4039;font-size:13px;font-weight:600}
.translation-room .room-code-input{box-sizing:border-box;width:100%;min-width:0;height:56px;padding:12px 16px;border:1px solid #d4e0d9;border-radius:12px;background:#f8faf9;color:#183e43;font-family:inherit;font-size:24px;font-weight:600;line-height:1.3;letter-spacing:5px;text-align:center;caret-color:#183e43}
.translation-room .room-code-input::placeholder{color:#91a39a;font-size:15px;font-weight:400;letter-spacing:1px;opacity:1}
.translation-room .room-code-input:focus{border-color:#183e43;outline:2px solid #183e4314;outline-offset:1px}
.translation-room .room-action{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:48px;margin:0;padding:12px 16px;border:1px solid #d4e0d9;border-radius:12px;background:#f8faf9;color:#183e43;font:600 14px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;cursor:pointer}
.translation-room .room-action-primary{border-color:#183e43;background:#183e43;color:#fff;box-shadow:0 4px 12px #183e4318}
.translation-room .room-action-danger{border-color:#ecd8d1;background:#fff8f5;color:#a4483b}
.translation-room .room-action-quiet{border-color:transparent;background:transparent;color:#667e7c}
.translation-room button:disabled,.translation-room input:disabled{opacity:.5;cursor:wait}
.translation-room .room-action:focus-visible,.translation-room .room-header a:focus-visible{outline:2px solid #183e43;outline-offset:3px}
.translation-room .room-help{margin:-8px 0 0;color:#7b8a80;font-size:11px;line-height:1.7;text-align:center}
.translation-room .room-error{margin:0 0 18px;padding:12px 14px;border:1px solid #ecd8d1;border-radius:12px;background:#fff8f5;color:#a4483b;font-size:13px;line-height:1.6}
.translation-room .room-session-heading{text-align:center}
.translation-room .room-caption{color:#7b8a80;font-size:12px;line-height:1.6}
.translation-room .room-session-code{margin:8px 0 0;color:#183e43;font-size:30px;font-weight:600;letter-spacing:5px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.translation-room .room-session>p{margin:0;color:#587066;font-size:13px;line-height:1.7}
.translation-room .room-transcript{padding:16px;border-radius:12px;background:#f8faf9}
.translation-room .room-playback{display:grid;gap:12px;padding:16px;border:1px solid #d4e0d9;border-radius:12px;background:#edf5ef}.translation-room .room-playback>p{margin:0;color:#587066;font-size:13px;line-height:1.7}
.translation-room .room-subtitle{margin:6px 0 16px;color:#667e7c;font-size:14px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}
.translation-room .room-subtitle:last-child{margin-bottom:0}
.translation-room .room-translation{margin:6px 0 0;color:#183e43;font-size:20px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}
.translation-room .room-qr{width:180px;height:180px;justify-self:center;padding:8px;border:1px solid #d4e0d9;border-radius:12px;background:#fff}
@media(max-width:360px){.translation-room{padding-right:16px;padding-left:16px}.translation-room .room-form,.translation-room .room-session{padding:18px}}
.translation-room.is-chat{position:fixed;z-index:40;inset:0 0 auto;display:flex;flex-direction:column;box-sizing:border-box;width:100%;max-width:600px;height:100svh;height:var(--room-viewport-height,100svh);min-height:0;margin:0 auto;padding:env(safe-area-inset-top) 0 0;overflow:hidden;overscroll-behavior:none;background:#edf1ee}
.chat-header{display:flex;align-items:center;gap:10px;flex-shrink:0;min-height:76px;padding:10px 12px;background:#f8faf9;border-bottom:1px solid #e0e7e2}
.chat-header-back,.chat-more,.chat-toolbar-more{display:flex;align-items:center;justify-content:center;flex:0 0 44px;width:44px;height:44px;border:0;border-radius:12px;background:transparent;color:#183e43;cursor:pointer}
.chat-heading{flex:1;min-width:0;text-align:center}.chat-heading h1{margin:0 0 4px;font-size:17px;font-weight:600;letter-spacing:.5px}.chat-heading>span{color:#7b8a80;font-size:11px}
.chat-room-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0;min-height:36px;padding:0 18px;background:#e5ece6;color:#587066;font-size:11px}.chat-room-bar>span{display:flex;align-items:center;gap:6px}.chat-room-bar>button{min-height:36px;padding:0;border:0;background:transparent;color:#587066;font:inherit;cursor:pointer}
.chat-error{flex-shrink:0;margin:0;padding:9px 18px;background:#fff0e9;color:#a4483b;font-size:12px;line-height:1.6}
.chat-toolbar{flex-shrink:0;padding:10px 14px max(14px,env(safe-area-inset-bottom));border-top:1px solid #d4e0d9;background:#f8faf9}.chat-toolbar-status{display:flex;align-items:center;justify-content:center;gap:6px;margin:0 0 10px;color:#7b8a80;font-size:11px;line-height:1.6;text-align:center}.chat-toolbar-actions{display:flex;align-items:center;gap:10px}.chat-mode-icon{display:grid;place-items:center;flex:0 0 30px;color:#587066}.chat-talk{flex:1;min-width:0;min-height:46px;padding:10px 12px;border:1px solid #183e43;border-radius:10px;background:#183e43;color:#fff;font:500 14px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;cursor:pointer}.translation-room .chat-talk.is-speaking:disabled{border-color:#cfdfd2;background:#dce9df;color:#345948;opacity:1;cursor:default}.chat-talk.is-speaking::before{display:inline-block;width:7px;height:7px;margin-right:8px;border-radius:50%;background:#59846c;content:''}.chat-toolbar-more{flex-basis:36px;width:36px}
.chat-talk:focus-visible,.chat-more:focus-visible,.chat-header-back:focus-visible,.chat-toolbar-more:focus-visible,.chat-room-bar>button:focus-visible{outline:2px solid #183e43;outline-offset:2px}
</style>
