<script setup lang="ts">
import { Focus, MessageCircle, Navigation, Plus, Minus } from 'lucide-vue-next'
import { message } from '../../ride/i18n'
import type { Locale } from '../../ride/types'

const props = defineProps<{ locale: Locale; following: boolean; askOpen: boolean }>()
const emit = defineEmits<{ ask: []; map: [action: 'zoom-in' | 'zoom-out' | 'overview' | 'follow'] }>()
</script>

<template>
  <nav class="journey-toolbar" aria-label="路线工具">
    <button type="button" :aria-label="message(locale, 'zoomOut')" @click="emit('map', 'zoom-out')"><Minus :size="16" /></button>
    <button type="button" :aria-label="message(locale, 'overview')" @click="emit('map', 'overview')"><Focus :size="16" /></button>
    <button type="button" :class="{ active: following }" :aria-label="message(locale, following ? 'unfollow' : 'follow')" @click="emit('map', 'follow')"><Navigation :size="16" /></button>
    <button type="button" :aria-label="message(locale, 'zoomIn')" @click="emit('map', 'zoom-in')"><Plus :size="16" /></button>
    <span class="toolbar-divider" aria-hidden="true" />
    <button type="button" class="toolbar-ask" :class="{ active: askOpen }" aria-label="问一问" title="问一问" :aria-pressed="askOpen" @click="emit('ask')"><MessageCircle :size="18" /></button>
  </nav>
</template>

<style scoped>
.journey-toolbar{position:absolute;left:14px;top:50%;z-index:10;display:flex;flex-direction:column;align-items:center;gap:3px;width:52px;padding:4px;border:1px solid #dbe5df;border-radius:15px;background:#fffffff2;box-shadow:0 7px 25px #183e4330;backdrop-filter:blur(12px);transform:translateY(-50%);overflow:hidden}.journey-toolbar button{display:flex;align-items:center;justify-content:center;width:42px;height:38px;padding:0;border:0;border-radius:10px;background:transparent;color:var(--lake)}.journey-toolbar button:hover,.journey-toolbar button.active{background:#e4f0ea}.toolbar-ask{border-top:1px solid #dbe5df!important;border-radius:0 0 10px 10px!important;margin-top:2px;padding-top:5px!important;height:43px!important}.journey-toolbar button:focus-visible{outline:2px solid var(--lake);outline-offset:-2px}.toolbar-divider{width:28px;height:1px;background:#dbe5df;margin:2px 0}@media(max-width:520px){.journey-toolbar{left:10px}.journey-toolbar button{width:42px}}
</style>
