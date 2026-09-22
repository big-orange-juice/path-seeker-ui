<script setup lang="ts">
import { ArrowLeft, Languages, MapPin, X } from 'lucide-vue-next'
import { useRide } from '../../ride/useRide'
import { arrivalPolicy } from '../../ride/progression'
import { languages } from '../../ride/i18n'
import LanguageGate from './LanguageGate.vue'
import RideMap from './RideMap.vue'
import RoutePicker from './RoutePicker.vue'
import JourneyStory from './JourneyStory.vue'
import StopTimeline from './StopTimeline.vue'

const ride = useRide()
const { locale, page, routes, selectedId, activeId, selected, active, current, next, arrived, playback, loading, loadError, invalidScan, translate } = ride
const { state: locationState, location } = ride.location
const { error: speechError } = ride.speech
</script>

<template>
  <LanguageGate v-if="page === 'language'" v-model="locale" :loading="loading" :error="loadError" @enter="ride.enter" />
  <div v-else class="ride-experience">
    <header class="ride-header">
      <button v-if="page === 'journey'" class="header-button" @click="page = 'map'"><ArrowLeft :size="19" />{{ translate('map') }}</button>
      <span v-else class="area-name">{{ translate('area') }}</span>
      <span v-if="page === 'journey' && active" class="header-route">{{ active.title }}</span>
      <button v-if="page === 'map'" class="header-button" @click="ride.changeLanguage"><Languages :size="18" />{{ languages.find(language => language.id === locale)?.name }}</button>
      <button v-else class="header-button end-button" @click="ride.end">{{ translate('end') }}</button>
    </header>
    <main v-if="page === 'map' && selected" class="map-page">
      <RideMap :route="selected" :locale="locale" :location="location" overview />
      <RoutePicker :routes="routes" :selected-id="selectedId" :active-id="activeId" :locale="locale" @select="selectedId = $event" @start="ride.start" @resume="page = 'journey'" />
      <p v-if="invalidScan" class="scan-notice" role="status">{{ translate('invalidRoute') }}<button :aria-label="translate('close')" @click="invalidScan = false"><X :size="16" /></button></p>
    </main>
    <main v-else-if="page === 'journey' && active && current" class="journey-page">
      <JourneyStory :key="active.id" :route="active" :stop="current" :next="next" :locale="locale" :playback="playback" :speech-error="speechError" @toggle="ride.togglePlayback" />
      <div class="journey-path">
        <div class="path-heading"><h2>{{ translate('stops') }}</h2><span>{{ active.stops.length }}</span></div>
        <StopTimeline :stops="active.stops" :current-id="current.id" :locale="locale" @select="ride.selectStop" />
        <RideMap :route="active" :selected-id="current.id" :locale="locale" :location="location" @select="ride.selectStop" />
        <div class="location-bar" role="status"><MapPin :size="16" /><span>{{ translate(locationState === 'error' || locationState === 'unsupported' ? 'locationError' : locationState === 'requesting' ? 'locating' : location && location.accuracy > arrivalPolicy.maxAccuracy ? 'lowAccuracy' : 'tracking') }}</span><button v-if="locationState === 'error'" @click="ride.location.start">{{ translate('retry') }}</button></div>
      </div>
    </main>
    <aside v-if="arrived" class="arrival-toast" role="status"><MapPin :size="22" /><div><span>{{ translate('approaching') }}</span><strong>{{ arrived.name }}</strong><p>{{ translate(playback.manualPause ? 'paused' : 'uninterrupted') }}</p></div></aside>
  </div>
</template>

<style scoped>
.ride-experience{min-height:100dvh;background:var(--paper)}.ride-header{height:60px;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 28px;background:var(--paper);border-bottom:1px solid #dbe5df}.area-name{font:600 17px var(--display);letter-spacing:3px}.area-name span{font:9px sans-serif;letter-spacing:2px;margin-left:12px;color:#78917e}.header-button{display:flex;align-items:center;gap:8px;border:0;background:none;color:var(--lake);font-size:12px;padding:9px 0;flex-shrink:0}.header-route{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#617a6b}.end-button{color:#697e71}.map-page{height:calc(100dvh - 60px);min-height:680px;position:relative}.map-page>.ride-map{position:absolute;inset:0}.map-page :deep(.map-feedback){top:120px}.map-page :deep(.map-tools){top:165px}.scan-notice{position:absolute;left:50%;top:120px;transform:translateX(-50%);z-index:5;display:flex;align-items:center;gap:15px;width:max-content;max-width:calc(100% - 30px);padding:12px 16px;background:white;border:1px solid #d6d9b4;border-radius:12px;box-shadow:0 4px 20px #183e4320;font-size:12px}.scan-notice button{background:none;border:0;color:var(--lake)}.journey-path{max-width:1000px;margin:auto}.path-heading{display:flex;align-items:center;justify-content:space-between;padding:22px 26px 0}.path-heading h2{font-size:14px;margin:0}.path-heading>span{font:12px monospace;color:#718776}.journey-path>.ride-map{height:320px;margin:0 22px;border-radius:18px;overflow:hidden}.location-bar{display:flex;align-items:center;gap:9px;padding:16px 24px max(24px,env(safe-area-inset-bottom));font-size:11px;line-height:1.7;color:#587367}.location-bar button{margin-left:auto;background:#e7eee9;border:0;border-radius:8px;padding:8px 14px;color:var(--lake);white-space:nowrap}.arrival-toast{position:fixed;left:50%;bottom:max(24px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:40;display:flex;gap:14px;width:min(450px,calc(100% - 28px));padding:18px 22px;border:1px solid #c6dacf;background:#f9fffc;box-shadow:0 8px 40px #0d342e3d;border-radius:18px;color:var(--lake);pointer-events:none}.arrival-toast span{font-size:11px;display:block;margin-bottom:6px}.arrival-toast strong{font:600 20px var(--display)}.arrival-toast p{font-size:11px;line-height:1.6;margin:7px 0 0}@media(min-width:1000px){.journey-page{display:grid;grid-template-columns:minmax(500px,1.25fr) minmax(360px,1fr);min-height:calc(100dvh - 60px)}.journey-page>.story-stage{display:flex;align-items:center}.journey-path{width:100%;align-self:center}.journey-path>.ride-map{height:400px}}@media(max-width:760px){.ride-header{height:56px;padding:0 16px;gap:12px}.header-route{display:none}.area-name{font-size:16px}.map-page{height:calc(100dvh - 56px);min-height:710px}.map-page :deep(.map-feedback){top:155px;right:60px;line-height:1.4;font-size:11px}.map-page :deep(.map-tools){top:165px}.journey-path>.ride-map{margin:0 14px;height:290px}.location-bar{padding-left:16px;padding-right:16px}.scan-notice{top:145px}.header-button{font-size:11px}}
</style>
