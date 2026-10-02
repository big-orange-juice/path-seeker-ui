<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isTourLocale, TOUR_LANGUAGES, type TourLocale } from '@path-seeker/ts-shared'
import TourLanguageGate from '@/components/tour/TourLanguageGate.vue'
import TourMap from '@/components/tour/TourMap.vue'
import TourRoutePicker from '@/components/tour/TourRoutePicker.vue'
import TourStoryDrawer from '@/components/tour/TourStoryDrawer.vue'
import { useTourJourney } from '@/composables/useTourJourney'
import { useAskStore } from '@/stores/useAskStore'
import { tourMessages } from '@/utils/tourMessages'

const props = defineProps<{ museumId: string }>()
const route = useRoute()
const router = useRouter()
const journey = useTourJourney()
const askStore = useAskStore()
const storyOpen = shallowRef(false)
const viewingJourney = shallowRef(false)
const mapFailed = shallowRef(false)
const messages = computed(() => tourMessages(journey.locale.value))
const routes = computed(() => journey.catalog.value?.routes?.filter(item => item.locale === journey.locale.value) ?? [])
const detail = computed(() => viewingJourney.value ? journey.active.value : journey.preview.value)
const errorText = computed(() => {
  const error = journey.error.value
  return error in messages.value ? messages.value[error as keyof typeof messages.value] : error
})
const speechError = computed(() => journey.speech.error.value === 'voiceMissing' ? messages.value.voiceMissing : journey.speech.error.value ? messages.value.playbackFailed : '')

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

async function end() {
  if (await journey.end()) { viewingJourney.value = false; storyOpen.value = false }
}

function back() {
  if (viewingJourney.value) { viewingJourney.value = false; storyOpen.value = false }
  else void router.push('/venues')
}

onMounted(() => { journey.restoreLanguage(route.query.lang); if (journey.languageReady.value) void load() })
</script>

<template>
  <main class="tour-experience" :lang="journey.locale.value">
    <TourMap :catalog="journey.catalog.value" :detail="detail" :current-stop-id="viewingJourney ? journey.currentStop.value?.id || null : null" :journey="viewingJourney" :location="journey.location.value" @select="selectStop" @error="mapFailed = true" />
    <header class="tour-header"><button type="button" @click="back">{{ messages.back }}</button><strong>{{ detail?.route?.title || journey.catalog.value?.destinations?.[0]?.name || messages.routes }}</strong><button v-if="journey.active.value" type="button" :disabled="journey.pending.value" @click="end">{{ messages.end }}</button><select v-else :value="journey.locale.value" :disabled="journey.pending.value" :aria-label="messages.changeLanguage" @change="changeLanguage"><option v-for="language in TOUR_LANGUAGES" :key="language.value" :value="language.value">{{ language.label }}</option></select></header>
    <div v-if="errorText || mapFailed || journey.locationError.value || speechError" class="tour-notices" role="status"><p v-if="errorText">{{ errorText }} <button type="button" :disabled="journey.pending.value" @click="load">{{ messages.retry }}</button></p><p v-if="mapFailed">{{ messages.noMap }}</p><p v-if="journey.locationError.value">{{ messages.locationFailed }}</p><p v-if="speechError">{{ speechError }}</p></div>
    <TourRoutePicker v-if="!viewingJourney" :routes="routes" :selected-id="journey.preview.value?.route?.id || null" :pending="journey.pending.value" :can-start="Boolean(journey.preview.value?.stops?.length)" :messages="messages" @select="selectRoute" @start="start" />
    <button v-if="!viewingJourney && journey.active.value" class="tour-return" type="button" @click="viewingJourney = true">{{ journey.active.value.route?.title }} · {{ messages.resume }}</button>
    <template v-if="viewingJourney && journey.currentStop.value">
      <nav class="tour-tools"><button type="button" @click="journey.tracking.value ? journey.stopTracking() : journey.startTracking()">{{ journey.tracking.value ? messages.stopLocate : messages.locate }}</button><button type="button" @click="ask">{{ messages.ask }}</button></nav>
      <TourStoryDrawer v-if="storyOpen" :stop="journey.currentStop.value" :stops="journey.stops.value" :narration="journey.narration.value" :narrations="journey.narrations.value" :playing="journey.speech.status.value === 'playing'" :pending="journey.pending.value" :messages="messages" @close="storyOpen = false" @play="journey.togglePlayback" @select="journey.selectStop" @guide="journey.selectGuide" @complete="journey.completeStop(false)" />
      <footer class="tour-story-dock"><button type="button" :disabled="journey.pending.value" @click="journey.togglePlayback">{{ journey.speech.status.value === 'playing' ? messages.pause : journey.speech.status.value === 'paused' ? messages.resume : messages.play }}</button><button type="button" @click="storyOpen = !storyOpen"><strong>{{ journey.currentStop.value.name }}</strong><span>{{ journey.visit.value?.status === 2 ? messages.finished : `${journey.currentIndex.value + 1} / ${journey.stops.value.length}` }} · {{ messages.content }}</span></button></footer>
    </template>
    <TourLanguageGate v-if="!journey.languageReady.value" :title="messages.chooseLanguage" @select="selectLanguage" />
  </main>
</template>

<style scoped>
.tour-experience{position:fixed;inset:0;z-index:30;background:#d9d5c9;color:#263643;overflow:hidden}.tour-header{position:absolute;left:12px;right:12px;top:max(12px,env(safe-area-inset-top));z-index:8;display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;background:#fffef8ef;box-shadow:0 3px 14px #0001}.tour-header strong{flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tour-header button,.tour-header select{font-size:12px;background:transparent;color:#263643}.tour-notices{position:absolute;top:76px;left:12px;right:12px;z-index:4;pointer-events:none}.tour-notices p{width:fit-content;border-radius:8px;background:#fffef8e8;padding:8px 12px;margin:4px 0;font-size:12px;pointer-events:auto}.tour-notices button{margin-left:10px;text-decoration:underline}.tour-tools{position:absolute;left:12px;top:150px;z-index:5;display:grid;gap:8px}.tour-tools button,.tour-return{background:#fffef8ef;border-radius:8px;padding:12px;font-size:12px;box-shadow:0 3px 12px #0002}.tour-return{position:absolute;top:150px;right:12px;z-index:4;max-width:75%}.tour-story-dock{position:absolute;left:12px;bottom:max(20px,env(safe-area-inset-bottom));z-index:8;display:flex;align-items:center;gap:12px;width:min(380px,calc(100% - 24px));padding:12px;border-radius:12px;background:#fffef8f2;box-shadow:0 3px 14px #0002}.tour-story-dock>button:first-child{padding:10px;border-radius:8px;background:#263f55;color:#fff;font-size:12px}.tour-story-dock>button:last-child{display:grid;gap:3px;text-align:left;min-width:0;flex:1}.tour-story-dock strong{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tour-story-dock span{font-size:11px;color:#647382}
</style>
