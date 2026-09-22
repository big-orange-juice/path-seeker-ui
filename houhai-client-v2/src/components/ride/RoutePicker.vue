<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { ArrowRight, Check, Clock3, Headphones, Search } from 'lucide-vue-next'
import { message } from '../../ride/i18n'
import type { Locale, RideRoute } from '../../ride/types'

const props = defineProps<{ routes: RideRoute[]; selectedId: string; activeId: string; locale: Locale }>()
defineEmits<{ select: [id: string]; start: []; resume: [] }>()
const query = shallowRef('')
const filtered = computed(() => props.routes.filter(route => `${route.title} ${route.guideName} ${route.specialty} ${route.stops.map(stop => stop.name).join(' ')}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())))
const selected = computed(() => props.routes.find(route => route.id === props.selectedId))
const cards = useTemplateRef<HTMLDivElement>('cards')
async function revealSelected() {
  await nextTick()
  const container = cards.value
  const button = container?.querySelector<HTMLElement>('[aria-pressed="true"]')
  if (container && button) container.scrollTo({ left: button.offsetLeft - (container.clientWidth - button.offsetWidth) / 2 })
}
onMounted(revealSelected)
watch(() => props.selectedId, revealSelected)
</script>

<template>
  <div class="route-picker">
    <div class="route-heading"><div><h1>{{ message(locale, 'routes') }}</h1><p>{{ message(locale, 'routeHint') }}</p></div>
      <label class="route-search"><Search :size="19" /><input v-model="query" :aria-label="message(locale, 'search')" :placeholder="message(locale, 'search')" type="search" /></label>
    </div>
    <div class="start-area">
      <button class="start-ride" :disabled="!selected" @click="$emit('start')"><Headphones :size="28" /><strong>{{ message(locale, activeId === selectedId && activeId ? 'resumeJourney' : 'start') }}</strong><ArrowRight :size="21" /></button>
      <p>{{ message(locale, activeId && activeId !== selectedId ? 'switchJourney' : 'startHint') }}</p>
      <button v-if="activeId && activeId !== selectedId" class="return-active" @click="$emit('resume')">{{ message(locale, 'resumeJourney') }} →</button>
    </div>
    <section class="route-deck" :aria-label="message(locale, 'routes')">
      <p v-if="!filtered.length" class="empty-result" role="status">{{ message(locale, 'noRoutes') }}</p>
      <div ref="cards" class="route-cards">
        <button v-for="route in filtered" :key="route.id" class="route-card" :class="{ selected: route.id === selectedId }" :aria-pressed="route.id === selectedId" @click="$emit('select', route.id)">
          <span class="route-guide"><Headphones :size="15" />{{ route.guideName }}<Check v-if="route.id === selectedId" class="guide-check" :size="17" /></span>
          <strong>{{ route.title }}</strong><span class="route-style">{{ route.specialty }}</span>
          <span class="route-facts"><Clock3 :size="13" />{{ route.duration }} {{ message(locale, 'minutes') }}<span>·</span>{{ route.distance }}<span>·</span>{{ message(locale, 'stops') }} {{ route.stops.length }}</span>
          <span class="route-stops">{{ route.stops.map(stop => stop.name).join(' → ') }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.route-cards{position:relative}
.route-picker{position:absolute;inset:0;display:flex;flex-direction:column;pointer-events:none}.route-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:24px 32px;background:linear-gradient(#f8faf9f5,#f8faf9db,transparent)}.route-heading h1{font:600 28px var(--display);margin:0}.route-heading p{font-size:12px;color:#496459;margin:9px 0}.route-search{display:flex;align-items:center;gap:10px;padding:0 16px;min-height:48px;width:min(390px,45%);border:1px solid #d4e0d9;border-radius:14px;background:white;pointer-events:auto;color:var(--lake);box-shadow:0 4px 18px #183e4310}.route-search input{min-width:0;width:100%;border:0;background:none;outline-offset:6px;font-size:13px}.start-area{margin:auto;max-width:90%;text-align:center;pointer-events:auto}.start-ride{display:flex;justify-content:center;align-items:center;gap:15px;min-height:86px;max-width:100%;padding:20px 32px;background:var(--lake);color:white;border:5px solid #ffffffbd;border-radius:28px;box-shadow:0 12px 42px #183e4333;margin:0 auto}.start-ride strong{font-size:22px;line-height:1.3}.start-area p{max-width:400px;padding:7px 14px;border-radius:20px;background:#f8faf9ed;font-size:12px;line-height:1.5;color:var(--lake)}.return-active{border:1px solid #b8cbc0;padding:10px 18px;border-radius:20px;background:white;color:var(--lake);font-size:12px}.route-deck{padding:22px 30px 40px;background:linear-gradient(transparent,#f8faf9e8 22%,#f8faf9);pointer-events:auto}.route-cards{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding:3px 3px 12px;scrollbar-width:thin;scrollbar-color:#9bb7a8 transparent}.route-card{flex:0 0 330px;display:flex;flex-direction:column;align-items:flex-start;gap:11px;min-height:204px;padding:18px 20px;text-align:left;background:#fffffff5;border:1px solid #ceddd3;border-radius:18px;color:var(--ink);scroll-snap-align:start}.route-card.selected{border:2px solid var(--lake);padding:17px 19px;background:#edf5ef}.route-guide{display:flex;align-items:center;gap:7px;width:100%;font-size:12px;color:var(--lake)}.route-guide .guide-check{margin-left:auto}.route-card strong{font:600 20px/1.35 var(--display)}.route-style{font-size:11px;color:#587466}.route-facts{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:11px}.route-stops{font-size:10px;line-height:1.7;color:#62786b;border-top:1px solid #d5e1d8;padding-top:9px;width:100%;margin-top:auto}.empty-result{background:white;padding:18px;border-radius:14px;font-size:13px}@media(max-width:760px){.route-heading{padding:18px 16px;display:block}.route-heading h1{font-size:24px}.route-heading p{font-size:11px}.route-search{width:100%;min-height:44px;margin-top:14px}.route-deck{padding:12px 13px 30px}.route-card{flex-basis:280px;min-height:215px;padding:16px}.route-card.selected{padding:15px}.route-card strong{font-size:19px}.start-ride{min-height:74px;padding:15px 24px;border-radius:24px}.start-ride strong{font-size:19px}.start-area p{font-size:11px}.route-cards{gap:10px}}
</style>
