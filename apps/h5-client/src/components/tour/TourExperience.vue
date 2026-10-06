<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Focus, Languages, MapPin, MessageCircle, Mic, Minus, Navigation, Pause, Play, Plus, SkipBack, SkipForward } from 'lucide-vue-next'
import { isTourLocale, TOUR_LANGUAGES, type TourLocale } from '@path-seeker/ts-shared'
import TourLanguageGate from '@/components/tour/TourLanguageGate.vue'
import TourMap from '@/components/tour/TourMap.vue'
import TourRoutePicker from '@/components/tour/TourRoutePicker.vue'
import TourStoryDrawer from '@/components/tour/TourStoryDrawer.vue'
import TourArrivalPrompt from '@/components/tour/TourArrivalPrompt.vue'
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
const drawerRef = useTemplateRef<HTMLElement>('drawerHost')
const dockRef = useTemplateRef<HTMLElement>('dockHost')
const viewingJourney = shallowRef(false)
const mapFailed = shallowRef(false)
const following = shallowRef(false)
const voiceNotice = shallowRef('')
const seekNotice = shallowRef('')
const resumeNotice = shallowRef('')
const pageHidden = shallowRef(document.visibilityState === 'hidden')
let seekNoticeTimer: ReturnType<typeof setTimeout> | undefined
let resumeNoticeTimer: ReturnType<typeof setTimeout> | undefined
/** 打开抽屉前的焦点来源：关闭时把焦点还回去 */
let drawerReturnFocus: HTMLElement | null = null
let previousBodyOverflow = ''
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
const speechStatus = computed(() => journey.speech.status.value)
const isPlaying = computed(() => speechStatus.value === 'playing')
const isPaused = computed(() => speechStatus.value === 'paused')
const canSeek = computed(() => Boolean(journey.currentStop.value) && speechStatus.value === 'playing')
/** 底部条与抽屉共用的主按钮文案 */
const playLabel = computed(() => isPlaying.value ? messages.value.pause : isPaused.value ? messages.value.resume : messages.value.play)
const progressLabel = computed(() => {
  const duration = journey.speech.currentItemDuration.value
  if (!journey.drawerMatchesPlaying.value || duration <= 0) return ''
  return `${formatSeconds(journey.speech.playedSeconds.value)} / ${formatSeconds(duration)}`
})
const autoAdvanceHint = computed(() => {
  if (!viewingJourney.value) return ''
  return journey.autoAdvanceMode.value === 'sequential' ? messages.value.sequentialAutoHint : messages.value.nearbyAutoPlayHint
})

/** 语音识别语言跟随当前讲解语言，否则中文机型认不出俄语 / 西语 */
const RECOGNITION_LANGS: Record<TourLocale, string> = { zh: 'zh-CN', en: 'en-US', ru: 'ru-RU', es: 'es-ES', fr: 'fr-FR', ja: 'ja-JP' }

// 识别结果写回输入框由 AskPanel 统一负责（它始终挂载且是草稿的视图），这里只管提示
watch(() => voice.error.value, (message) => {
  if (message) voiceNotice.value = message
})

/** 接近行为抑制：问一问浮层打开、语音识别中、页面后台时不自动打开/自动开播（方案 §7.5） */
watch(
  () => askStore.open || voice.listening.value || pageHidden.value,
  (suppressed) => journey.setApproachSuppressed(suppressed),
  { immediate: true },
)

/** 恢复进行中的游览后直接进入行程视图 */
watch(() => journey.journeyRestored.value, (restored) => {
  if (restored) viewingJourney.value = true
})

/** 问答音频四类收尾：问答前在播就尽量自动恢复路线讲解（方案 §5.2） */
watch(() => askStore.askAudioSettle, (settle) => {
  if (!settle || !viewingJourney.value) return
  const result = journey.endAskInterrupt()
  if (result === 'blocked-paused') showResumeNotice()
})

// 纯文字问答没有问答音频可等：浮层关闭时同样尝试恢复路线讲解
watch(() => askStore.open, (open) => {
  if (open || !viewingJourney.value) return
  const result = journey.endAskInterrupt()
  if (result === 'blocked-paused') showResumeNotice()
})

// 服务端回退音色时提示一次（方案 §6.3 验收：客户端比对回传音色）
watch(() => askStore.askVoiceFellBack, (fellBack) => {
  if (fellBack) voiceNotice.value = messages.value.voiceFellBack
})

/** 切后台只保存断点，回到前台尽量自动恢复（方案 §5.4） */
function handleVisibility() {
  pageHidden.value = document.visibilityState === 'hidden'
  if (pageHidden.value) {
    journey.handleVisibilityHidden()
    return
  }
  if (!viewingJourney.value) return
  const result = journey.handleVisibilityVisible()
  if (result === 'blocked-paused') showResumeNotice()
}

function showSeekNotice(text: string) {
  seekNotice.value = text
  clearTimeout(seekNoticeTimer)
  seekNoticeTimer = setTimeout(() => { seekNotice.value = '' }, 2400)
}

function showResumeNotice() {
  resumeNotice.value = messages.value.autoplayBlocked
  clearTimeout(resumeNoticeTimer)
  resumeNoticeTimer = setTimeout(() => { resumeNotice.value = '' }, 6000)
}

function formatSeconds(value: number) {
  const total = Math.max(0, Math.floor(value))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

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
  if (await journey.start()) { viewingJourney.value = true; journey.closeContentDrawer() }
}

function selectStop(id: string) {
  if (!viewingJourney.value || journey.pending.value) return
  const index = journey.stops.value.findIndex(stop => stop.id === id)
  if (index < 0) return
  journey.openContentDrawer(index, 'map-selection')
  void journey.selectStop(index)
}

function openDrawerFromDock() {
  if (journey.drawerOpen.value) {
    journey.closeContentDrawer()
    return
  }
  drawerReturnFocus = (dockRef.value?.querySelector('button:last-of-type') as HTMLElement | null) ?? null
  journey.toggleContentDrawer()
}

function closeDrawer() {
  journey.closeContentDrawer()
}

/** 抽屉主按钮：展示的节点就是播放节点时切换播放，否则按正式切站进入该节点 */
function drawerPlay() {
  if (journey.drawerMatchesPlaying.value) journey.togglePlayback()
  else if (journey.drawerIndex.value >= 0) void journey.selectStop(journey.drawerIndex.value)
}

function seek(deltaSeconds: number) {
  if (!journey.drawerMatchesPlaying.value && journey.drawerOpen.value) return
  const result = journey.seekBy(deltaSeconds)
  if (result.moved) return
  if (result.reason === 'at-start') showSeekNotice(messages.value.seekAtStart)
  else if (result.reason === 'at-end') showSeekNotice(messages.value.seekAtEnd)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !journey.drawerOpen.value) return
  event.preventDefault()
  closeDrawer()
}

/** 抽屉打开时锁定背景滚动，关闭时恢复并把焦点还给入口（方案 §3.2） */
watch(() => journey.drawerOpen.value, (open) => {
  if (open) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    void nextTickFocusDrawer()
    return
  }
  document.body.style.overflow = previousBodyOverflow
  const target = drawerReturnFocus ?? (dockRef.value?.querySelector('button:last-of-type') as HTMLElement | null)
  drawerReturnFocus = null
  target?.focus?.()
})

async function nextTickFocusDrawer() {
  await Promise.resolve()
  const closeButton = drawerRef.value?.querySelector('header button') as HTMLElement | null
  closeButton?.focus?.()
}

function ask() {
  journey.beginAskInterrupt()
  if (!journey.active.value?.route || !journey.currentStop.value) return
  openAskWithContext()
}

/**
 * 一键语音提问：
 * 1. 保存播放断点并暂停（这是「打断」，但保留讲解队列与当前条目）；
 * 2. 打开问一问并挂上当前站点上下文（含导游与音色，方案 §6）；
 * 3. 开始浏览器本地语音识别，识别结果实时写进输入框，确认后发送。
 */
function startVoiceAsk() {
  if (voice.listening.value) {
    voice.stop()
    return
  }
  journey.beginAskInterrupt()
  askStore.stopSseAudio()
  voiceNotice.value = ''

  if (!journey.active.value?.route || !journey.currentStop.value) return
  openAskWithContext()
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

/**
 * 问答上下文（方案 §6）：导游音色按"当前节点当前导游 > 路线第一个节点讲解导游"回落。
 * 用户手动选择的音色由 askStore 在发送时优先，这里只负责把导游上下文带过去。
 */
function openAskWithContext() {
  const route = journey.active.value?.route
  const stop = journey.currentStop.value
  if (!route || !stop) return
  const guideVoice = resolveGuideVoiceId()
  askStore.openAskWithStageContext({
    routeId: route.id,
    stageId: stop.id,
    routeTitle: route.title || '',
    stageTitle: stop.name || '',
    guideId: journey.narration.value?.guideId ?? null,
    guideVoiceId: guideVoice,
    playingChapterId: journey.speech.currentItem.value?.chapterId ?? null,
    playingTimeSeconds: Math.max(0, Math.round(journey.speech.playedSeconds.value)),
  })
}

/** 当前讲解导游音色 → 路线第一个节点讲解导游音色 → null（交给 askStore / 服务端兜底） */
function resolveGuideVoiceId(): string | null {
  const current = journey.narration.value?.providerVoiceId
  if (current) return current
  for (const stop of journey.stops.value) {
    const narration = stop.guideNarrations?.find(item => item.locale === journey.locale.value)
    if (narration?.providerVoiceId) return narration.providerVoiceId
  }
  return null
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
  if (await journey.end()) { viewingJourney.value = false; journey.closeContentDrawer() }
}

function back() {
  voice.abort()
  if (viewingJourney.value) { viewingJourney.value = false; journey.closeContentDrawer() }
  else void router.push('/shell/me')
}

onMounted(() => {
  journey.restoreLanguage(route.query.lang)
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('visibilitychange', handleVisibility)
  if (journey.languageReady.value) void load()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('visibilitychange', handleVisibility)
  document.body.style.overflow = previousBodyOverflow
  clearTimeout(seekNoticeTimer)
  clearTimeout(resumeNoticeTimer)
})
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
    <div v-if="errorText || mapFailed || journey.locationError.value || speechError || voiceNotice || journey.speech.blocked.value || journey.speech.skippedExtraAudio.value || journey.approachUnknown.value || seekNotice || resumeNotice" class="tour-notices" role="status">
      <p v-if="errorText">{{ errorText }} <button type="button" :disabled="journey.pending.value" @click="load">{{ messages.retry }}</button></p>
      <p v-if="mapFailed">{{ messages.noMap }}</p>
      <p v-if="journey.locationError.value">{{ messages.locationFailed }}</p>
      <p v-if="speechError">{{ speechError }}</p>
      <p v-if="journey.approachUnknown.value">{{ messages.locationUnknown }}</p>
      <p v-if="seekNotice">{{ seekNotice }}</p>
      <p v-if="resumeNotice">{{ resumeNotice }} <button type="button" :disabled="journey.pending.value" @click="journey.resumePlayback">{{ messages.continuePlayback }}</button></p>
      <p v-if="journey.speech.blocked.value">{{ messages.autoplayBlocked }} <button type="button" :disabled="journey.pending.value" @click="journey.resumePlayback">{{ messages.continuePlayback }}</button></p>
      <p v-if="journey.speech.skippedExtraAudio.value">{{ messages.extraAudioFailed }}{{ journey.speech.skippedExtraAudio.value }} <button type="button" @click="journey.speech.dismissSkipped()">×</button></p>
      <p v-if="voiceNotice">{{ voiceNotice }}</p>
    </div>
    <TourRoutePicker v-if="!viewingJourney" :routes="routes" :selected-id="journey.preview.value?.route?.id || null" :pending="journey.pending.value" :can-start="Boolean(journey.preview.value?.stops?.length)" :messages="messages" @select="selectRoute" @start="start" />
    <button v-if="!viewingJourney && journey.active.value" class="tour-return" type="button" @click="viewingJourney = true">{{ journey.active.value.route?.title }} · {{ messages.resume }}</button>
    <template v-if="viewingJourney && journey.currentStop.value">
      <TourArrivalPrompt :candidates="journey.arrivalCandidates.value" :pending="journey.pending.value" :messages="messages" @accept="journey.acceptArrival" @dismiss="journey.dismissArrival" />
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
      <Transition name="story-drawer">
        <div v-if="journey.drawerOpen.value && journey.drawerStop.value" ref="drawerHost" class="tour-drawer-host" @pointerdown="journey.markDrawerInteraction()" @scroll.passive="journey.markDrawerInteraction()">
          <TourStoryDrawer
            :stop="journey.drawerStop.value"
            :stops="journey.stops.value"
            :narration="journey.narration.value"
            :narrations="journey.narrations.value"
            :playing="isPlaying"
            :paused="isPaused"
            :pending="journey.pending.value"
            :messages="messages"
            :skip-extra-audio="journey.skipExtraAudio.value"
            :blocked="journey.speech.blocked.value"
            :restore-approximate="journey.speech.restorePrecision.value === 'approximate'"
            :playing-item-id="journey.speech.currentItemId.value"
            :playing-label="journey.speech.currentItem.value?.title || ''"
            :matches-playing="journey.drawerMatchesPlaying.value"
            :playing-stop-name="journey.currentStop.value?.name || null"
            :browsing="journey.browsing.value"
            :can-seek="canSeek && journey.drawerMatchesPlaying.value"
            :played-seconds="journey.speech.playedSeconds.value"
            :duration-seconds="journey.speech.currentItemDuration.value"
            @close="closeDrawer"
            @play="drawerPlay"
            @replay="journey.replayCurrentStop"
            @seek="seek"
            @select="journey.selectStop"
            @guide="journey.selectGuide"
            @complete="journey.completeStop"
            @skip-extra-audio="journey.setSkipExtraAudio"
            @play-extra="journey.playExtraAudio"
          />
        </div>
      </Transition>
      <footer ref="dockHost" class="tour-story-dock">
        <div class="tour-dock-controls">
          <button type="button" class="tour-dock-button" :disabled="journey.pending.value || !journey.canGoPrevious.value" :aria-label="messages.prevStop" :title="messages.prevStop" @click="journey.previousStop()"><SkipBack :size="16" aria-hidden="true" /><span>{{ messages.prevStop }}</span></button>
          <button type="button" class="tour-dock-button" :disabled="journey.pending.value || !canSeek" :aria-label="messages.rewind15" :title="messages.rewind15" @click="seek(-15)"><SkipBack :size="14" aria-hidden="true" /><span>{{ messages.rewind15 }}</span></button>
          <button type="button" class="tour-dock-button is-primary" :disabled="journey.pending.value" @click="journey.togglePlayback()"><Pause v-if="isPlaying" :size="16" aria-hidden="true" /><Play v-else :size="16" aria-hidden="true" /><span>{{ playLabel }}</span></button>
          <button type="button" class="tour-dock-button" :disabled="journey.pending.value || !canSeek" :aria-label="messages.forward15" :title="messages.forward15" @click="seek(15)"><SkipForward :size="14" aria-hidden="true" /><span>{{ messages.forward15 }}</span></button>
          <button type="button" class="tour-dock-button" :disabled="journey.pending.value || !journey.canGoNext.value" :aria-label="messages.nextStop" :title="messages.nextStop" @click="journey.nextStop()"><SkipForward :size="16" aria-hidden="true" /><span>{{ messages.nextStop }}</span></button>
        </div>
        <button type="button" class="tour-dock-info" @click="openDrawerFromDock">
          <strong>{{ journey.currentStop.value.name }}</strong>
          <span>{{ journey.visit.value?.status === 2 ? messages.finished : `${journey.currentIndex.value + 1} / ${journey.stops.value.length}` }} · {{ messages.content }}<template v-if="progressLabel"> · {{ progressLabel }}</template></span>
          <small v-if="journey.browsing.value">{{ messages.browsingNoProgress }}</small>
          <small v-else-if="autoAdvanceHint">{{ autoAdvanceHint }}</small>
        </button>
      </footer>
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
.tour-return{position:absolute;top:74px;right:12px;z-index:4;max-width:75%;padding:12px;border:1px solid #dbe5df;border-radius:8px;background:#f8faf9ed;color:var(--tour-lake);font-size:12px;box-shadow:0 3px 12px #183e4315}
/* 底部迷你控制条：两行（按钮行 + 信息行），是主播放控制条（方案 §4.1） */
.tour-story-dock{position:absolute;left:12px;bottom:max(20px,env(safe-area-inset-bottom));z-index:8;display:grid;gap:8px;width:min(420px,calc(100% - 24px));padding:10px;border-radius:14px;background:#f8faf9f5;box-shadow:0 6px 22px #183e4320}
.tour-dock-controls{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.tour-dock-button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:44px;padding:6px 2px;border:1px solid #dbe5df;border-radius:10px;background:#fff;color:#263f55;font-size:10px;line-height:1.15}
.tour-dock-button span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tour-dock-button.is-primary{background:var(--tour-lake);border-color:var(--tour-lake);color:#fff}
.tour-dock-button:disabled{opacity:.45}
.tour-dock-button:focus-visible{outline:2px solid #263f55;outline-offset:-2px}
.tour-dock-info{display:grid;gap:2px;width:100%;padding:8px 10px;border:0;border-radius:10px;background:#eef3f0;text-align:left;color:#263f55}
.tour-dock-info strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}
.tour-dock-info span{color:#647382;font-size:11px}
.tour-dock-info small{color:#6b7d84;font-size:10px}
.tour-drawer-host{position:absolute;inset:0;z-index:6;pointer-events:none}
.tour-drawer-host>*{pointer-events:auto}
.story-drawer-enter-active,.story-drawer-leave-active{transition:transform .22s ease,opacity .22s ease}
.story-drawer-enter-from,.story-drawer-leave-to{opacity:0;transform:translateX(24px)}
.story-drawer-enter-to,.story-drawer-leave-from{opacity:1;transform:translateX(0)}
@media(prefers-reduced-motion:reduce){.story-drawer-enter-active,.story-drawer-leave-active{transition:none}}
@media(max-width:760px){.tour-header{min-height:56px;padding:0 16px}.tour-area-name strong{font-size:16px}.tour-language{font-size:11px}.tour-language select{max-width:76px;font-size:11px}.tour-tools{left:10px}.tour-notices{top:70px}.tour-dock-button span{display:none}.tour-dock-button{min-height:46px}}
/* 语音键：一键打断当前播报并开始说话提问；位置在底部控制条正上方居中 */
.tour-voice{position:absolute;left:50%;bottom:calc(max(20px,env(safe-area-inset-bottom)) + 126px);z-index:9;display:flex;flex-direction:column;align-items:center;gap:6px;transform:translateX(-50%)}
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
