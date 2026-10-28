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
const { room, canHost, permissionPending, source, displayNotice: notice, displayError: error, language, messages, busy, listening, speaking, muted, audioBlocked, audioNotice, audioError, echoSuppressed, connected, navigationPath, feed } = feature
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
      <div class="room-intro"><span class="room-intro-icon" aria-hidden="true"><Headphones :size="28" /></span><div><h1>{{ messages.title }}</h1><p>{{ messages.intro }}</p></div></div>
      <p class="room-notice" role="status"><span class="room-status-dot" aria-hidden="true" />{{ notice }}</p>
      <p v-if="error" role="alert" class="room-error">{{ error }}</p>
      <TranslationRoomControls v-if="!permissionPending" v-model:language="language" :can-host="canHost" :busy="busy" :initial-code="initialCode" @create="createRoom" @join="joinRoom" />
    </template>
    <template v-else>
      <header class="chat-header"><RouterLink class="chat-header-back" :to="navigationPath" :aria-label="messages.backConnected"><ArrowLeft :size="21" aria-hidden="true" /></RouterLink><span class="chat-room-icon" aria-hidden="true"><Headphones :size="22" /></span><div class="chat-heading"><h1>{{ messages.chatTitle }}</h1><span>{{ formatRoomMessage(messages.listeners, { count: room.listenerCount }) }} · {{ room.isHost ? messages.host : messages.liveTranslation }}</span></div><button type="button" class="chat-more" :aria-label="messages.more" :aria-expanded="showDetails" @click="showDetails = true"><MoreHorizontal :size="24" aria-hidden="true" /></button></header>
      <div class="chat-room-bar" :class="{ 'is-live': speaking || room.status === 'live' }"><span><span class="room-status-dot" aria-hidden="true" />{{ room.status === 'closed' ? messages.ended : speaking || room.status === 'live' ? messages.live : messages.waiting }}</span><button type="button" @click="showDetails = true">{{ messages.roomCode }} {{ room.code }} ›</button></div>
      <p v-if="error" role="alert" class="chat-error">{{ error }}</p>
      <TranslationRoomFeed :room="room" :items="feed" :source="source" :language="language" />
      <footer class="chat-toolbar">
        <p class="chat-toolbar-status" role="status"><Volume2 v-if="!room.isHost" :size="13" aria-hidden="true" />{{ room.isHost ? (speaking ? messages.echoHint : notice) : audioNotice }}</p>
        <div class="chat-toolbar-actions"><span class="chat-mode-icon" :class="{ 'is-live': speaking }"><Mic v-if="room.isHost" :size="22" aria-hidden="true" /><Headphones v-else :size="22" aria-hidden="true" /></span>
          <button v-if="needsConnection" type="button" class="chat-talk" :disabled="busy" @click="showDetails = true">{{ room.isHost ? messages.reconnect : messages.listenAgain }}</button>
          <button v-else-if="room.isHost" type="button" class="chat-talk" :class="{ 'is-speaking': speaking }" :disabled="busy || speaking || room.status === 'closed' || room.status === 'draining'" @click="feature.startSpeaking">{{ room.status === 'closed' ? messages.ended : speaking ? messages.micOn : messages.start }}</button>
          <button v-else type="button" class="chat-talk" :disabled="busy || !listening || echoSuppressed" @click="feature.toggleMute">{{ muted || audioBlocked || audioError ? messages.resume : messages.pause }}</button>
          <button type="button" class="chat-toolbar-more" :aria-label="messages.more" @click="showDetails = true"><MoreHorizontal :size="23" aria-hidden="true" /></button>
        </div>
      </footer>
      <TranslationRoomDetails v-if="showDetails" :room="room" :busy="busy" :language="language" @close="showDetails = false" @end="feature.end" @change-language="feature.changeLanguage" @leave="showDetails = false; feature.leave()"><template #connection><TranslationRoomControls v-if="needsConnection" v-model:language="language" :can-host="room.isHost" :busy="busy" :initial-code="room.code" @create="createRoom" @join="joinRoom" /></template></TranslationRoomDetails>
    </template>
  </main>
  </Teleport>
</template>

<style>
.translation-room{--room-lake:#183e43;--room-paper:#fcfefd;--room-ground:#f1f6f3;--room-line:#d9e5dc;--room-muted:#75897d;--room-live:#367a68;color-scheme:light;box-sizing:border-box;min-height:100dvh;background:var(--room-ground);color:var(--room-lake);padding:24px max(20px,calc((100vw - 560px)/2)) max(32px,env(safe-area-inset-bottom));font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}
.translation-room button,.translation-room input{font-family:inherit}.translation-room button{cursor:pointer}.translation-room button:disabled,.translation-room input:disabled{opacity:.45;cursor:default}.translation-room button:focus-visible,.translation-room a:focus-visible{outline:2px solid var(--room-lake);outline-offset:3px}
.translation-room .room-header{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:44px;font-size:12px}.translation-room .room-header a{display:flex;align-items:center;gap:6px;min-height:44px;color:#536f62}.translation-room .room-intro{display:flex;align-items:center;gap:16px;margin:36px 0 24px}.translation-room .room-intro-icon{display:grid;place-items:center;flex:0 0 64px;height:64px;border:1px solid var(--room-line);border-radius:22px;background:var(--room-paper);color:var(--room-lake);box-shadow:0 6px 18px #183e4307}.translation-room .room-intro h1{margin:0;font:600 30px/1.3 "Noto Serif SC","Songti SC","STSong",serif;letter-spacing:1px}.translation-room .room-intro p{margin:8px 0 0;color:var(--room-muted);font-size:12px;line-height:1.8}.translation-room .room-notice{display:flex;align-items:center;gap:8px;width:fit-content;max-width:100%;margin:0 0 20px;padding:8px 12px;border:1px solid var(--room-line);border-radius:10px;background:#eaf2ed;color:#536f62;font-size:11px;line-height:1.7}.translation-room .room-status-dot{display:inline-block;flex:0 0 6px;width:6px;height:6px;border-radius:50%;background:#8ba397}
.translation-room .room-form,.translation-room .room-session{display:grid;gap:22px;margin:0 0 18px;padding:24px;border:1px solid var(--room-line);border-radius:24px;background:var(--room-paper);box-shadow:0 10px 30px #183e4307}.translation-room .room-card-heading{display:flex;align-items:center;gap:12px;padding-bottom:18px;border-bottom:1px solid #e5ede7}.translation-room .room-card-icon{display:grid;place-items:center;flex:0 0 42px;height:42px;border-radius:14px;background:#e9f2ed;color:var(--room-live)}.translation-room .room-card-heading h2{margin:0;font-size:17px;font-weight:600;line-height:1.5}.translation-room .room-card-heading p{margin:4px 0 0;color:var(--room-muted);font-size:12px;line-height:1.7}.translation-room .room-field-label{display:grid;gap:10px;color:#436354;font-size:12px;font-weight:600}.translation-room .room-code-input{box-sizing:border-box;width:100%;min-width:0;height:60px;padding:12px 16px;border:1px solid var(--room-line);border-radius:14px;background:#f3f7f4;color:var(--room-lake);font-size:27px;font-weight:600;line-height:1.3;letter-spacing:5px;font-variant-numeric:tabular-nums;text-align:center;caret-color:var(--room-lake)}.translation-room .room-code-input::placeholder{color:#97aa9d;font-size:14px;font-weight:400;letter-spacing:1px;opacity:1}.translation-room .room-code-input:focus{border-color:var(--room-live);outline:3px solid #367a6810;outline-offset:1px}
.translation-room .room-action{display:flex;align-items:center;justify-content:center;gap:10px;box-sizing:border-box;width:100%;min-height:48px;margin:0;padding:12px 16px;border:1px solid var(--room-line);border-radius:14px;background:#f1f6f3;color:var(--room-lake);font-size:13px;font-weight:600;line-height:1.6;cursor:pointer}.translation-room .room-action-primary{border-color:var(--room-lake);background:var(--room-lake);color:#fff;box-shadow:0 5px 14px #183e4315}.translation-room .room-action-primary:hover{background:#28544f}.translation-room .room-action-danger{border-color:#ecdcd5;background:#fff7f3;color:#a05c4c}.translation-room .room-action-quiet{border-color:transparent;background:transparent;color:var(--room-muted)}.translation-room .room-help{margin:-8px 0 0;color:var(--room-muted);font-size:11px;line-height:1.8;text-align:center}.translation-room .room-error{margin:0 0 18px;padding:12px 14px;border:1px solid #ecdcd5;border-radius:14px;background:#fff7f3;color:#a05c4c;font-size:12px;line-height:1.7}.translation-room .room-caption{color:var(--room-muted);font-size:12px;line-height:1.7}.translation-room .room-session-code{color:var(--room-lake);font-size:32px;font-weight:600;letter-spacing:5px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.translation-room .room-qr{box-sizing:content-box;width:160px;height:160px;padding:10px;border:1px solid var(--room-line);border-radius:16px;background:#fff}
.translation-room.is-chat{position:fixed;z-index:40;inset:0 0 auto;display:flex;flex-direction:column;width:100%;height:100svh;height:var(--room-viewport-height,100svh);min-height:0;margin:0 auto;padding:env(safe-area-inset-top) 0 0;overflow:hidden;overscroll-behavior:none;background:var(--room-ground);box-shadow:0 0 80px #183e4312}.chat-header{display:flex;align-items:center;gap:10px;flex-shrink:0;min-height:78px;padding:10px 20px;border-bottom:1px solid var(--room-line);background:var(--room-paper)}.chat-header-back,.chat-more,.chat-toolbar-more{display:grid;place-items:center;flex:0 0 40px;width:40px;height:44px;padding:0;border:0;border-radius:12px;background:#f0f5f2;color:var(--room-lake);cursor:pointer}.chat-room-icon{display:grid;place-items:center;flex:0 0 44px;height:44px;border:1px solid var(--room-line);border-radius:15px;background:#eaf2ed}.chat-heading{flex:1;min-width:0;text-align:left}.chat-heading h1{margin:0 0 4px;font:600 20px/1.35 "Noto Serif SC","Songti SC","STSong",serif}.chat-heading>span{display:block;color:var(--room-muted);font-size:10px;line-height:1.6;overflow-wrap:anywhere}.chat-more{background:transparent}
.chat-room-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;min-height:44px;padding:0 22px;border-bottom:1px solid var(--room-line);background:#eaf2ed;color:#587363;font-size:11px}.chat-room-bar>span{display:flex;align-items:center;gap:8px}.chat-room-bar.is-live .room-status-dot{background:var(--room-live);box-shadow:0 0 0 3px #367a6814}.chat-room-bar>button{min-height:44px;padding:0;border:0;background:transparent;color:#587363;font:inherit;font-variant-numeric:tabular-nums;cursor:pointer}.chat-error{flex-shrink:0;margin:0;padding:10px 22px;background:#fff0e9;color:#a05c4c;font-size:12px;line-height:1.7}
.chat-toolbar{flex-shrink:0;margin:0;padding:12px 20px max(16px,env(safe-area-inset-bottom));border-top:1px solid var(--room-line);background:var(--room-paper);box-shadow:0 -6px 30px #183e4304}.chat-toolbar-status{display:flex;align-items:center;justify-content:center;gap:6px;margin:0 0 10px;color:var(--room-muted);font-size:11px;line-height:1.7;text-align:center}.chat-toolbar-actions{display:flex;align-items:center;gap:10px}.chat-mode-icon{display:grid;place-items:center;flex:0 0 44px;height:48px;border:1px solid var(--room-line);border-radius:15px;background:#eaf2ed;color:var(--room-live)}.chat-mode-icon.is-live{background:#dcece2}.chat-talk{flex:1;min-width:0;min-height:50px;padding:12px;border:1px solid var(--room-lake);border-radius:15px;background:var(--room-lake);color:#fff;font-size:14px;font-weight:500;line-height:1.6;cursor:pointer}.translation-room .chat-talk.is-speaking:disabled{border-color:#cfe1d5;background:#e0eee5;color:var(--room-live);opacity:1;cursor:default}.chat-talk.is-speaking::before{display:inline-block;width:7px;height:7px;margin-right:8px;border-radius:50%;background:var(--room-live);content:''}.chat-toolbar-more{height:48px;background:#f0f5f2}
@media(max-width:420px){.translation-room{padding:16px 16px max(24px,env(safe-area-inset-bottom))}.translation-room .room-intro{gap:12px;margin:26px 0 22px}.translation-room .room-intro-icon{flex-basis:56px;height:56px;border-radius:19px}.translation-room .room-intro h1{font-size:27px}.translation-room .room-form{padding:20px}.chat-header{gap:8px;padding:10px 12px}.chat-room-icon{flex-basis:40px;height:40px}.chat-heading h1{font-size:18px}.chat-header-back{flex-basis:34px;width:34px}.chat-toolbar{padding-right:16px;padding-left:16px}}
.translation-room.is-chat>.chat-header,.translation-room.is-chat>.chat-room-bar,.translation-room.is-chat>.chat-toolbar,.translation-room.is-chat>.chat-timeline,.translation-room.is-chat>.chat-error{box-sizing:border-box;width:100%;max-width:680px;margin-left:auto;margin-right:auto}
@media(prefers-reduced-motion:reduce){.translation-room *{scroll-behavior:auto}}
</style>
