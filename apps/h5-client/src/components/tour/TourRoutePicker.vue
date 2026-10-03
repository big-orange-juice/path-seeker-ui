<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { ArrowRight, Check, Clock3, Headphones, Search } from 'lucide-vue-next'
import type { ClientTourRoute } from '@/types/clientCatalog'
import type { TourMessages } from '@/utils/tourMessages'

const props = defineProps<{ routes: ClientTourRoute[]; selectedId: string | null; pending: boolean; canStart: boolean; messages: TourMessages }>()
const emit = defineEmits<{ select: [id: string]; start: [] }>()
const search = shallowRef('')
const cards = useTemplateRef<HTMLDivElement>('cards')
const filtered = computed(() => props.routes.filter(route => `${route.title || ''} ${route.subtitle || ''} ${route.guideName || ''} ${route.guideStyle || ''}`.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())))
const selected = computed(() => filtered.value.find(route => route.id === props.selectedId) ?? props.routes.find(route => route.id === props.selectedId))
let settle: ReturnType<typeof setTimeout> | undefined
let programmaticUntil = 0

function formatDistance(meters: number | null) {
  if (meters == null || meters <= 0) return ''
  return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`
}

function revealSelected(immediate = false) {
  void nextTick(() => {
    const container = cards.value
    const card = container?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!container || !card) return
    const target = card.offsetLeft - (container.clientWidth - card.offsetWidth) / 2
    if (Math.abs(container.scrollLeft - target) < 6) return
    programmaticUntil = Date.now() + 600
    container.scrollTo({ left: target, behavior: immediate ? 'auto' : 'smooth' })
  })
}

function selectCenteredCard() {
  const container = cards.value
  if (!container) return
  const center = container.scrollLeft + container.clientWidth / 2
  let id = ''
  let distance = Number.POSITIVE_INFINITY
  container.querySelectorAll<HTMLElement>('[data-route-id]').forEach(card => {
    const nextDistance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center)
    if (nextDistance < distance) { distance = nextDistance; id = card.dataset.routeId ?? '' }
  })
  if (id && id !== props.selectedId) emit('select', id)
}

function onScroll() {
  clearTimeout(settle)
  settle = setTimeout(() => { if (Date.now() >= programmaticUntil) selectCenteredCard() }, 170)
}

onMounted(() => revealSelected(true))
watch(() => props.selectedId, () => revealSelected())
watch(search, () => revealSelected(true))
onUnmounted(() => clearTimeout(settle))
</script>

<template>
  <section class="tour-route-picker">
    <div class="route-heading">
      <div class="route-heading-copy">
        <h1>{{ messages.routes }}</h1>
        <p>{{ messages.routeHint }}</p>
      </div>
      <label class="route-search">
        <Search :size="18" aria-hidden="true" />
        <input v-model="search" type="search" :aria-label="messages.search" :placeholder="messages.search">
      </label>
    </div>

    <div class="start-area">
      <button class="start-ride" type="button" :disabled="pending || !canStart || !selected" @click="emit('start')">
        <Headphones :size="26" aria-hidden="true" />
        <strong>{{ pending ? messages.loading : messages.start }}</strong>
        <ArrowRight :size="21" aria-hidden="true" />
      </button>
      <p>{{ messages.startHint }}</p>
    </div>

    <section class="route-deck" :aria-label="messages.routes">
      <p v-if="!filtered.length" class="tour-empty" role="status">{{ pending ? messages.loading : messages.noRoutes }}</p>
      <div v-else ref="cards" class="route-cards" @scroll="onScroll">
        <button v-for="route in filtered" :key="route.id" :data-route-id="route.id" type="button" class="route-card" :class="{ selected: selectedId === route.id }" :aria-pressed="selectedId === route.id" @click="emit('select', route.id)">
          <span class="route-guide"><Headphones :size="14" aria-hidden="true" />{{ route.guideName || messages.guide }}<Check v-if="selectedId === route.id" class="guide-check" :size="16" aria-hidden="true" /></span>
          <strong>{{ route.title || messages.routes }}</strong>
          <span class="route-style">{{ route.guideStyle || route.subtitle || '' }}</span>
          <span class="route-facts">
            <Clock3 :size="13" aria-hidden="true" />
            <span v-if="route.durationMinutes">{{ route.durationMinutes }} {{ messages.minutes }}</span>
            <span v-if="route.durationMinutes && route.distanceMeters">·</span>
            <span v-if="route.distanceMeters">{{ formatDistance(route.distanceMeters) }}</span>
            <span v-if="(route.durationMinutes || route.distanceMeters) && route.stopCount">·</span>
            <span v-if="route.stopCount">{{ route.stopCount }} {{ messages.stops }}</span>
          </span>
          <span v-if="route.subtitle && route.guideStyle" class="route-subtitle">{{ route.subtitle }}</span>
        </button>
      </div>
      <div v-if="filtered.length > 1" class="route-dots" aria-hidden="true">
        <span v-for="route in filtered" :key="route.id" :class="{ active: route.id === selectedId }" />
      </div>
    </section>
  </section>
</template>

<style scoped>
.tour-route-picker{position:absolute;inset:58px 0 0;z-index:3;display:flex;flex-direction:column;pointer-events:none;color:var(--tour-ink)}
.route-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:24px 32px;background:linear-gradient(var(--tour-paper-strong),var(--tour-paper-fade),transparent)}
.route-heading-copy h1{margin:0;font:600 28px/1.25 var(--tour-display);letter-spacing:.01em}.route-heading-copy p{margin:8px 0 0;color:var(--tour-muted);font-size:12px;line-height:1.5}
.route-search{display:flex;align-items:center;gap:10px;width:min(390px,45%);min-height:48px;padding:0 16px;border:1px solid var(--tour-line);border-radius:14px;background:#fff;box-shadow:0 4px 18px #183e4310;color:var(--tour-lake);pointer-events:auto}.route-search input{width:100%;min-width:0;border:0;outline:none;background:transparent;color:var(--tour-ink);font-size:13px}.route-search input::placeholder{color:#91a39a}
.start-area{max-width:90%;margin:auto;text-align:center;pointer-events:auto}.start-ride{display:flex;align-items:center;justify-content:center;gap:15px;min-height:82px;max-width:100%;margin:0 auto;padding:18px 30px;border:5px solid #ffffffbd;border-radius:28px;background:var(--tour-lake);color:#fff;box-shadow:0 12px 42px #183e4333}.start-ride strong{font-size:21px;line-height:1.3}.start-area p{max-width:360px;margin:10px auto 0;padding:7px 14px;border-radius:20px;background:var(--tour-paper-strong);color:var(--tour-lake);font-size:12px;line-height:1.5}
.route-deck{padding:18px 0 30px;background:linear-gradient(transparent,var(--tour-paper-fade) 22%,var(--tour-paper));pointer-events:auto}.route-cards{display:flex;gap:14px;overflow-x:auto;padding:4px calc((100% - min(72vw,330px))/2) 14px;scroll-snap-type:x mandatory;scrollbar-width:none}.route-cards::-webkit-scrollbar{display:none}
.route-card{display:flex;flex:0 0 min(72vw,330px);flex-direction:column;align-items:flex-start;gap:10px;min-height:204px;padding:18px 20px;border:1px solid #ceddd3;border-radius:18px;background:#fffffff5;color:var(--tour-ink);text-align:left;opacity:.72;scroll-snap-align:center;transform:scale(.94);transition:transform .28s ease,opacity .28s ease,background .28s ease,border-color .28s ease}.route-card.selected{padding:17px 19px;border:2px solid var(--tour-lake);background:var(--tour-selected);opacity:1;transform:scale(1)}.route-guide{display:flex;align-items:center;gap:7px;width:100%;color:var(--tour-lake);font-size:12px}.guide-check{margin-left:auto}.route-card>strong{font:600 20px/1.35 var(--tour-display)}.route-style{min-height:16px;color:#587466;font-size:11px}.route-facts{display:flex;flex-wrap:wrap;align-items:center;gap:6px;color:var(--tour-ink);font-size:11px}.route-subtitle{width:100%;margin-top:auto;padding-top:9px;border-top:1px solid #d5e1d8;color:#62786b;font-size:10px;line-height:1.7}.tour-empty{margin:4px 16px;padding:18px;border-radius:14px;background:#fffffff5;font-size:13px;text-align:center}.route-dots{display:flex;justify-content:center;gap:6px;padding:10px 0 0}.route-dots span{width:6px;height:6px;border-radius:3px;background:#b9cec3;transition:width .25s ease,background .25s ease}.route-dots span.active{width:18px;background:var(--tour-lake)}
@media(max-width:760px){.tour-route-picker{inset:56px 0 0}.route-heading{display:block;padding:18px 16px}.route-heading-copy h1{font-size:24px}.route-heading-copy p{margin-top:6px;font-size:11px}.route-search{width:100%;min-height:44px;margin-top:14px}.start-ride{min-height:74px;padding:15px 24px;border-radius:24px}.start-ride strong{font-size:19px}.start-area p{font-size:11px}.route-deck{padding:10px 0 24px}.route-card{min-height:196px;padding:16px}.route-card.selected{padding:15px}.route-card>strong{font-size:19px}.route-cards{gap:12px}}
@media(min-width:1000px){.route-cards{padding-right:calc((100% - min(50vw,440px))/2);padding-left:calc((100% - min(50vw,440px))/2)}.route-card{flex-basis:min(50vw,440px)}}
</style>
