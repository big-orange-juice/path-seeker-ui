<script setup lang="ts">
import { message } from '../../ride/i18n'
import type { Locale, RideStop } from '../../ride/types'

defineProps<{ stops: RideStop[]; currentId: string; locale: Locale }>()
defineEmits<{ select: [id: string] }>()
</script>

<template>
  <nav class="stop-timeline" :aria-label="message(locale, 'stops')">
    <button v-for="(stop, index) in stops" :key="stop.id" :class="{ active: stop.id === currentId }" :aria-current="stop.id === currentId ? 'step' : undefined" @click="$emit('select', stop.id)">
      <span class="stop-number">{{ String(index + 1).padStart(2, '0') }}</span><span>{{ stop.name }}</span>
    </button>
  </nav>
</template>

<style scoped>
.stop-timeline{display:flex;overflow-x:auto;gap:0;scrollbar-width:thin;padding:12px 18px 14px;background:#f8faf9}.stop-timeline button{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;flex:1 0 115px;padding:0 10px;border:0;background:none;color:#60776a;font-size:11px;line-height:1.5;max-width:200px}.stop-timeline button::before{content:'';position:absolute;top:17px;left:0;right:0;height:1px;background:#c5d6ca;z-index:0}.stop-timeline button:first-child::before{left:50%}.stop-timeline button:last-child::before{right:50%}.stop-number{position:relative;display:grid;place-items:center;background:#e8eee9;border:4px solid #f8faf9;box-sizing:content-box;color:#667e6f;font:12px monospace;width:27px;height:27px;border-radius:50%;z-index:1}.stop-timeline .active{color:var(--lake);font-weight:700}.active .stop-number{background:var(--lake);color:white}
</style>
