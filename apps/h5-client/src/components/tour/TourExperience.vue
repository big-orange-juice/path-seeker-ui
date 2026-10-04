<script setup lang="ts">
import { computed, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Focus, Languages, MapPin, MessageCircle, Mic, Minus, Navigation, Plus } from 'lucide-vue-next'
import { isTourLocale, TOUR_LANGUAGES, type TourLocale } from '@path-seeker/ts-shared'
import TourLanguageGate from '@/components/tour/TourLanguageGate.vue'
import TourMap from '@/components/tour/TourMap.vue'
import TourRoutePicker from '@/components/tour/TourRoutePicker.vue'
import TourStoryDrawer from '@/components/tour/TourStoryDrawer.vue'
import { useTourJourney } from '@/composables/useTourJourney'
import { useBrowserSpeechRecognition } from '@/composables/useBrowserSpeechRecognition'
import { useAskStore } from '@/stores/useAskStore'
import { tourMessages } from '@/utils/tourMessages'

const props = defineProps<{ museumId: string }>()
const route = useRoute()
const router = useRouter()
const journey = useTourJourney()
const askStore = useAskStore()
const voice = useBrowserSpeechRecognition()
const tourMap = useTemplateRef<InstanceType<typeof TourMap>>('tourMap')
const storyOpen = shallowRef(false)
const viewingJourney = shallowRef(false)
const mapFailed = shallowRef(false)
const following = shallowRef(false)
const voiceNotice = shallowRef('')
const messages = computed(() => tourMessages(journey.locale.value))
const routes = computed(() => journey.catalog.value?.routes?.filter(item => item.locale === journey.locale.value) ?? [])
const detail = computed(() => viewingJourney.value ? journey.active.value : journey.preview.value)
const destinationName = computed(() => journey.catalog.value?.destinations?.[0]?.name || '后海')
const currentLanguage = computed(() => TOUR_LANGUAGES.find(language => language.value === journey.locale.value) ?? TOUR_LANGUAGES[0])
const errorText = computed(() => {
  const error = journey.error.value
  return error in messages.value ? messages.value[error as keyof typeof messages.value] : error
})
const speechError = computed(() => journey.speech.error.value === 'voiceMissing' ? messages.value.voiceMissing : journey.speech.error.value ? messages.value.playbackFailed : '')

/** 语音识别语言跟随当前讲解语言，否则中文机型认不出俄语 / 西语 */
const RECOGNITION_LANGS: Record<TourLocale, string> = { zh: 'zh-CN', en: 'en-US', ru: 'ru-RU', es: 'es-ES' }

// 识别结果写回输入框由 AskPanel 统一负责（它始终挂载且是草稿的视图），这里只管提示
watch(() => voice.error.value, (message) => {
  if (message) voiceNotice.value = message
})

async function load() {
  await journey.load(props.museumId, typeof route.query.routeId === 'string' ? route.query.routeId : '')
}

async function selectLanguage(locale: TourLocale) {
  journey.rememberLanguage(locale)
  await router.replace({ query: { ...route.query, lang: locale } })
  await load()
}

function changeLanguage(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (isTourLocale(value)) void selectLanguage(value)
}

async function selectRoute(id: string) {
  await journey.selectRoute(id)
  await router.replace({ query: { ...route.query, routeId: id } })
}

async function start() {
  if (await journey.start()) { viewingJourney.value = true; storyOpen.value = false }
}

function selectStop(id: string) {
  if (!viewingJourney.value || journey.pending.value) return
  const index = journey.stops.value.findIndex(stop => stop.id === id)
  if (index < 0) return
  storyOpen.value = true
  void journey.selectStop(index)
}

function ask() {
  journey.speech.pause()
  if (!journey.active.value?.route || !journey.currentStop.value) return
  askStore.openAskWithStageContext({ routeId: journey.active.value.route.id, stageId: journey.currentStop.value.id, routeTitle: journey.active.value.route.title || '', stageTitle: journey.currentStop.value.name || '' })
}

/**
 * 一键语音提问：
 * 1. 先掐掉所有正在播的声音（行程讲解 + 问一问语音），这是「打断」；
 * 2. 打开问一问并挂上当前站点上下文；
 * 3. 开始浏览器本地语音识别，识别结果实时写进输入框，确认后发送。
 *
 * 识别不可用（如部分 iOS 浏览器）时退化为聚焦输入框直接打字。
 */
function startVoiceAsk() {
  if (voice.listening.value) {
    voice.stop()
    return
  }

  journey.speech.stop()
  askStore.stopSseAudio()
  voiceNotice.value = ''

  if (!journey.active.value?.route || !journey.currentStop.value) return
  askStore.openAskWithStageContext({ routeId: journey.active.value.route.id, stageId: journey.currentStop.value.id, routeTitle: journey.active.value.route.title || '', stageTitle: journey.currentStop.value.name || '' })
  askStore.clearDraftText()

  if (!voice.supported.value) {
    voiceNotice.value = messages.value.voiceUnsupported
    askStore.requestDraftFocus()
    return
  }

  if (!voice.start({ lang: RECOGNITION_LANGS[journey.locale.value] })) {
    voiceNotice.value = messages.value.voiceUnsupported
    askStore.requestDraftFocus()
  }
}

/** 近站讲解开关：关掉定位时同步退出跟随，避免镜头停在最后一次定位上 */
function toggleTracking() {
  if (journey.tracking.value) {
    journey.stopTracking()
    if (following.value) following.value = tourMap.value?.setFollowing(false) ?? false
    return
  }
  journey.startTracking()
}

function toggleFollow() {
  following.value = tourMap.value?.setFollowing(!following.value) ?? false
}

async function end() {
  voice.abort()
  if (await journey.end()) { viewingJourney.value = false; storyOpen.value = false }
}

function back() {
  voice.abort()
  if (viewingJourney.value) { viewingJourney.value = false; storyOpen.value = false }
  else void router.push('/shell/me')
}

onMounted(() => { journey.restoreLanguage(route.query.lang); if (journey.languageReady.value) void load() })
</script>

<template>
  <main class="tour-experience" :lang="journey.locale.value">
    <TourMap ref="tourMap" :catalog="journey.catalog.value" :detail="detail" :current-stop-id="viewingJourney ? journey.currentStop.value?.id || null : null" :journey="viewingJourney" :location="journey.location.value" @select="selectStop" @error="mapFailed = true" />
    <header class="tour-header" :class="{ preview: !viewingJourney, journey: viewingJourney }">
      <template v-if="viewingJourney">
        <button type="button" @click="back">{{ messages.back }}</button>
        <strong>{{ detail?.route?.title || messages.routes }}</strong>
        <button type="button" :disabled="journey.pending.value" @click="end">{{ messages.end }}</button>
      </template>
      <template v-else>
        <div class="tour-area-name"><strong>{{ destinationName }}</strong><small>HOUHAI</small></div>
        <label class="tour-language"><Languages :size="17" aria-hidden="true" /><span>{{ currentLanguage.label }}</span><select :value="journey.locale.value" :disabled="journey.pending.value" :aria-label="messages.changeLanguage" @change="changeLanguage"><option v-for="language in TOUR_LANGUAGES" :key="language.value" :value="language.value">{{ language.label }}</option></select></label>
      </template>
    </header>
    <div v-if="errorText || mapFailed || journey.locationError.value || speechError || voiceNotice" class="tour-notices" role="status"><p v-if="errorText">{{ errorText }} <button type="button" :disabled="journey.pending.value" @click="load">{{ messages.retry }}</button></p><p v-if="mapFailed">{{ messages.noMap }}</p><p v-if="journey.locationError.value">{{ messages.locationFailed }}</p><p v-if="speechError">{{ speechError }}</p><p v-if="voiceNotice">{{ voiceNotice }}</p></div>
    <TourRoutePicker v-if="!viewingJourney" :routes="routes" :selected-id="journey.preview.value?.route?.id || null" :pending="journey.pending.value" :can-start="Boolean(journey.preview.value?.stops?.length)" :messages="messages" @select="selectRoute" @start="start" />
    <button v-if="!viewingJourney && journey.active.value" class="tour-return" type="button" @click="viewingJourney = true">{{ journey.active.value.route?.title }} · {{ messages.resume }}</button>
    <template v-if="viewingJourney && journey.currentStop.value">
      <nav class="tour-tools" aria-label="路线工具">
        <button type="button" :class="{ active: journey.tracking.value }" :aria-pressed="journey.tracking.value" :aria-label="journey.tracking.value ? messages.stopLocate : messages.locate" :title="journey.tracking.value ? messages.stopLocate : messages.locate" @click="toggleTracking"><MapPin :size="16" /></button>
        <span class="toolbar-divider" aria-hidden="true" />
        <button type="button" :aria-label="messages.zoomOut" :title="messages.zoomOut" @click="tourMap?.zoomBy(-1)"><Minus :size="16" /></button>
        <button type="button" :aria-label="messages.overview" :title="messages.overview" @click="tourMap?.overview()"><Focus :size="16" /></button>
        <button type="button" :class="{ active: following }" :aria-pressed="following" :aria-label="following ? messages.unfollow : messages.follow" :title="following ? messages.unfollow : messages.follow" @click="toggleFollow"><Navigation :size="16" /></button>
        <button type="button" :aria-label="messages.zoomIn" :title="messages.zoomIn" @click="tourMap?.zoomBy(1)"><Plus :size="16" /></button>
        <span class="toolbar-divider" aria-hidden="true" />
        <button type="button" class="toolbar-ask" aria-label="问一问" title="问一问" @click="ask"><MessageCircle :size="18" /></button>
      </nav>
      <TourStoryDrawer v-if="storyOpen" :stop="journey.currentStop.value" :stops="journey.stops.value" :narration="journey.narration.value" :narrations="journey.narrations.value" :playing="journey.speech.status.value === 'playing'" :pending="journey.pending.value" :messages="messages" @close="storyOpen = false" @play="journey.togglePlayback" @select="journey.selectStop" @guide="journey.selectGuide" @complete="journey.completeStop(false)" />
      <footer class="tour-story-dock"><button type="button" :disabled="journey.pending.value" @click="journey.togglePlayback">{{ journey.speech.status.value === 'playing' ? messages.pause : journey.speech.status.value === 'paused' ? messages.resume : messages.play }}</button><button type="button" @click="storyOpen = !storyOpen"><strong>{{ journey.currentStop.value.name }}</strong><span>{{ journey.visit.value?.status === 2 ? messages.finished : `${journey.currentIndex.value + 1} / ${journey.stops.value.length}` }} · {{ messages.content }}</span></button></footer>
      <div class="tour-voice">
        <button
          type="button"
          class="tour-voice-button"
          :class="{ 'is-listening': voice.listening.value }"
          :aria-label="voice.listening.value ? messages.voiceStop : messages.voiceAsk"
          :title="voice.listening.value ? messages.voiceStop : messages.voiceAsk"
          :aria-pressed="voice.listening.value"
          @click="startVoiceAsk"
        >
          <span v-if="voice.listening.value" class="tour-voice-wave" aria-hidden="true"><i /><i /><i /></span>
          <Mic v-else :size="22" aria-hidden="true" />
        </button>
        <p class="tour-voice-hint">
          {{ voice.listening.value ? (voice.transcript.value || messages.voiceHint) : messages.voiceHint }}
        </p>
      </div>
    </template>
    <TourLanguageGate v-if="!journey.languageReady.value" :title="messages.chooseLanguage" @select="selectLanguage" />
  </main>
</template>

<style scoped>
.tour-experience{--tour-lake:#183e43;--tour-ink:#2b4039;--tour-muted:#7b8a80;--tour-paper:#f8faf9;--tour-paper-strong:#f8faf9f5;--tour-paper-fade:#f8faf9db;--tour-selected:#edf5ef;--tour-line:#d4e0d9;--tour-display:"Noto Serif SC","Songti SC","STSong","SimSun",serif;position:fixed;inset:0;z-index:30;overflow:hidden;background:var(--tour-paper);color:var(--tour-ink)}
.tour-header{position:absolute;left:0;right:0;top:0;z-index:8;display:flex;align-items:center;gap:16px;min-height:58px;padding:0 28px;border-bottom:1px solid #dbe5df;background:var(--tour-paper);color:var(--tour-lake)}.tour-header.journey{left:12px;right:12px;top:max(12px,env(safe-area-inset-top));min-height:44px;padding:12px;border:0;border-radius:10px;background:#f8faf9f2;box-shadow:0 3px 14px #183e4315}.tour-header strong{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.tour-header button{border:0;background:transparent;color:var(--tour-lake);font-size:12px}.tour-area-name{display:flex;align-items:baseline;gap:10px}.tour-area-name strong{font:600 17px var(--tour-display);letter-spacing:3px}.tour-area-name small{color:#78917e;font:9px/1 sans-serif;letter-spacing:2px}.tour-language{display:flex;align-items:center;gap:7px;color:var(--tour-lake);font-size:12px}.tour-language select{border:0;background:transparent;color:var(--tour-lake);font-size:12px;outline:none}.tour-notices{position:absolute;top:76px;left:12px;right:12px;z-index:4;pointer-events:none}.tour-notices p{width:fit-content;margin:4px 0;padding:8px 12px;border-radius:8px;background:#f8faf9ed;box-shadow:0 3px 14px #183e4310;font-size:12px;pointer-events:auto}.tour-notices button{margin-left:10px;text-decoration:underline}
.tour-tools{position:absolute;left:12px;top:50%;z-index:5;display:flex;flex-direction:column;align-items:center;gap:3px;width:52px;padding:4px;border:1px solid #dbe5df;border-radius:15px;background:#fffffff2;box-shadow:0 7px 25px #183e4330;backdrop-filter:blur(12px);transform:translateY(-50%)}.tour-tools button{display:flex;align-items:center;justify-content:center;width:42px;height:38px;padding:0;border:0;border-radius:10px;background:transparent;color:#263f55}.tour-tools button:hover,.tour-tools button.active{background:#e4f0ea}.tour-tools button:focus-visible{outline:2px solid #263f55;outline-offset:-2px}.toolbar-divider{width:28px;height:1px;margin:2px 0;background:#dbe5df}.toolbar-ask{height:43px!important}
.tour-return{position:absolute;top:74px;right:12px;z-index:4;max-width:75%;padding:12px;border:1px solid #dbe5df;border-radius:8px;background:#f8faf9ed;color:var(--tour-lake);font-size:12px;box-shadow:0 3px 12px #183e4315}.tour-story-dock{position:absolute;left:12px;bottom:max(20px,env(safe-area-inset-bottom));z-index:8;display:flex;align-items:center;gap:12px;width:min(380px,calc(100% - 24px));padding:12px;border-radius:12px;background:#f8faf9f2;box-shadow:0 3px 14px #183e4315}.tour-story-dock>button:first-child{padding:10px;border-radius:8px;border:0;background:var(--tour-lake);color:#fff;font-size:12px}.tour-story-dock>button:last-child{display:grid;flex:1;min-width:0;gap:3px;text-align:left}.tour-story-dock strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.tour-story-dock span{color:#647382;font-size:11px}
@media(max-width:760px){.tour-header{min-height:56px;padding:0 16px}.tour-area-name strong{font-size:16px}.tour-language{font-size:11px}.tour-language select{max-width:76px;font-size:11px}.tour-tools{left:10px}.tour-notices{top:70px}}
/* 语音键：一键打断当前播报并开始说话提问；位置在讲解悬浮条正上方居中 */
.tour-voice{position:absolute;left:50%;bottom:calc(max(20px,env(safe-area-inset-bottom)) + 80px);z-index:9;display:flex;flex-direction:column;align-items:center;gap:6px;transform:translateX(-50%)}
.tour-voice-button{display:grid;place-items:center;width:58px;height:58px;padding:0;border:1px solid #dbe5df;border-radius:50%;background:var(--tour-lake);color:#fff;box-shadow:0 10px 26px #183e4340;transition:transform .16s ease,box-shadow .16s ease,background .16s ease}
.tour-voice-button:active{transform:scale(.95)}
.tour-voice-button:focus-visible{outline:2px solid var(--tour-lake);outline-offset:3px}
.tour-voice-button.is-listening{background:#fff;color:var(--tour-lake);box-shadow:0 0 0 6px #183e431f,0 10px 26px #183e4340}
.tour-voice-hint{max-width:min(300px,80vw);margin:0;overflow:hidden;padding:3px 10px;border-radius:999px;background:#f8faf9e6;box-shadow:0 3px 12px #183e4315;color:#5d7a70;font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.tour-voice-wave{display:flex;align-items:center;gap:3px;height:20px}
.tour-voice-wave i{display:block;width:3px;border-radius:2px;background:currentColor;animation:tour-voice-pulse 1s ease-in-out infinite}
.tour-voice-wave i:nth-child(1){height:8px}
.tour-voice-wave i:nth-child(2){height:18px;animation-delay:.15s}
.tour-voice-wave i:nth-child(3){height:11px;animation-delay:.3s}
@keyframes tour-voice-pulse{0%,100%{transform:scaleY(.5)}50%{transform:scaleY(1)}}
@media(prefers-reduced-motion:reduce){.tour-voice-wave i{animation:none}}
</style>
