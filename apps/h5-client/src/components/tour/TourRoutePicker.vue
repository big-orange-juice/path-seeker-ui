<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { ClientTourRoute } from '@/types/clientCatalog'
import type { TourMessages } from '@/utils/tourMessages'

const props = defineProps<{ routes: ClientTourRoute[]; selectedId: string | null; pending: boolean; canStart: boolean; messages: TourMessages }>()
const emit = defineEmits<{ select: [id: string]; start: [] }>()
const search = shallowRef('')
const filtered = computed(() => props.routes.filter(route => `${route.title || ''} ${route.subtitle || ''} ${route.guideName || ''}`.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())))
</script>

<template>
  <section class="tour-route-picker">
    <label><span>{{ messages.routes }}</span><input v-model="search" type="search" :placeholder="messages.search"></label>
    <div class="tour-route-cards">
      <button v-for="route in filtered" :key="route.id" type="button" class="tour-route-card" :class="{ selected: selectedId === route.id }" :aria-pressed="selectedId === route.id" @click="emit('select', route.id)">
        <img v-if="route.cover" :src="route.cover" alt=""><div><h2>{{ route.title }}</h2><p>{{ route.subtitle }}</p><p>{{ route.guideName }} <span v-if="route.guideStyle">· {{ route.guideStyle }}</span></p><small>{{ route.stopCount }} {{ messages.stops }} <span v-if="route.durationMinutes">· {{ route.durationMinutes }} {{ messages.minutes }}</span> <span v-if="route.distanceMeters">· {{ (route.distanceMeters / 1000).toFixed(1) }} km</span></small></div>
      </button>
      <p v-if="!filtered.length" class="tour-empty">{{ pending ? messages.loading : messages.noRoutes }}</p>
    </div>
    <button class="tour-start" type="button" :disabled="pending || !canStart" @click="emit('start')">{{ pending ? messages.loading : messages.start }}</button>
  </section>
</template>

<style scoped>
.tour-route-picker{position:absolute;bottom:20px;left:16px;right:16px;z-index:3;display:grid;gap:10px;color:#263643}.tour-route-picker label{display:flex;align-items:center;gap:10px;border-radius:10px;background:#fffef8ef;padding:10px 12px;font-size:13px;box-shadow:0 3px 14px #0001}.tour-route-picker input{min-width:0;flex:1;background:transparent;color:#263643;outline:none}.tour-route-picker label>span{font-weight:600;white-space:nowrap}.tour-route-cards{display:flex;gap:10px;overflow-x:auto;padding:3px 0 8px;scroll-snap-type:x mandatory}.tour-route-card{display:flex;flex-shrink:0;width:min(320px,82vw);border:2px solid transparent;border-radius:12px;background:#fffef8f5;padding:12px;text-align:left;scroll-snap-align:center;gap:12px;box-shadow:0 3px 14px #0001}.tour-route-card.selected{border-color:#327dce}.tour-route-card>img{width:64px;border-radius:6px;object-fit:cover}.tour-route-card h2{font-size:16px;margin:0 0 5px}.tour-route-card p{font-size:12px;margin:4px 0;color:#596c7b}.tour-route-card small{font-size:11px;color:#647382}.tour-start{justify-self:center;width:min(280px,85vw);min-height:48px;border-radius:24px;background:#263f55;color:#fff;font-weight:600;box-shadow:0 3px 15px #0002}.tour-start:disabled{opacity:.55}.tour-empty{background:#fffef8ee;border-radius:10px;padding:18px;font-size:13px}
</style>
