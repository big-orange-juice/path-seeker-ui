<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-vue-next'
import StopTimeline from './StopTimeline.vue'
import { message } from '../../ride/i18n'
import type { Locale, RideStop } from '../../ride/types'

defineProps<{ stops: RideStop[]; currentId: string; locale: Locale; hideTrigger?: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
const open = defineModel<boolean>('open', { default: false })

function close() { open.value = false }
function pick(id: string) { emit('select', id); close() }
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') close() }
watch(open, value => {
  if (value) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="stop-drawer" :class="{ open }">
    <button v-if="!hideTrigger" v-show="!open" type="button" class="stop-trigger" aria-controls="stop-drawer-panel" :aria-expanded="open" @click="open = true">
      <ListOrdered :size="16" />
      <span class="stop-trigger-label">{{ message(locale, 'stops') }}</span>
      <span class="stop-trigger-count">{{ stops.length }}</span>
      <ChevronLeft :size="15" />
    </button>
    <aside id="stop-drawer-panel" class="stop-panel" :aria-label="message(locale, 'stops')">
      <header class="stop-panel-head">
        <span class="stop-panel-title">{{ message(locale, 'stops') }}<span>{{ stops.length }}</span></span>
        <button type="button" :aria-label="message(locale, 'collapseStops')" @click="close"><ChevronRight :size="18" /></button>
      </header>
      <StopTimeline :stops="stops" :current-id="currentId" :locale="locale" @select="pick" />
    </aside>
  </div>
</template>

<style scoped>
.stop-drawer{position:absolute;inset:0;z-index:6;pointer-events:none;isolation:isolate}
.stop-trigger{position:absolute;right:0;bottom:34px;pointer-events:auto;display:flex;align-items:center;gap:8px;padding:10px 11px 10px 13px;border:1px solid #dbe5df;border-right:0;border-radius:14px 0 0 14px;background:#ffffffeb;backdrop-filter:blur(10px);color:var(--lake);font-size:12px;box-shadow:-5px 6px 22px #183e4326}
.stop-trigger-label{white-space:nowrap}
.stop-trigger-count{display:grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--lake);color:white;font:11px monospace}
.stop-panel{position:absolute;right:0;top:0;bottom:0;width:min(82%,300px);pointer-events:auto;display:flex;flex-direction:column;background:#f9fbfa;box-shadow:-14px 0 38px #0d252b3d;transform:translateX(101%);visibility:hidden;transition:transform .26s ease,visibility 0s linear .26s}
.stop-drawer.open .stop-panel{transform:translateX(0);visibility:visible;transition:transform .26s ease}
.stop-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 10px 13px 16px;border-bottom:1px solid #dbe5df}
.stop-panel-title{display:flex;align-items:baseline;gap:10px;font:600 15px var(--display);color:var(--ink)}
.stop-panel-title span{font:11px monospace;color:#6b8377}
.stop-panel-head button{display:grid;place-items:center;width:34px;height:34px;border:0;background:none;color:var(--lake)}
@media(max-width:420px){.stop-trigger-label{display:none}}
</style>
