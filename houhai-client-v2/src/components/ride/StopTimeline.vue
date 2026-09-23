<script setup lang="ts">
import { message } from '../../ride/i18n'
import type { Locale, RideStop } from '../../ride/types'

defineProps<{ stops: RideStop[]; currentId: string; locale: Locale }>()
defineEmits<{ select: [id: string] }>()
</script>

<template>
  <nav class="stop-timeline" :aria-label="message(locale, 'stops')">
    <button v-for="(stop, index) in stops" :key="stop.id" :class="{ active: stop.id === currentId }" :aria-current="stop.id === currentId ? 'step' : undefined" @click="$emit('select', stop.id)">
      <span class="stop-number">{{ String(index + 1).padStart(2, '0') }}</span><span class="stop-name">{{ stop.name }}</span>
    </button>
  </nav>
</template>

<style scoped>
.stop-timeline{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;display:flex;flex-direction:column;padding:10px 12px 18px 10px}.stop-timeline button{position:relative;display:flex;align-items:center;gap:12px;padding:11px 8px;border:0;border-radius:12px;background:none;color:#4f6b5d;font-size:13px;line-height:1.5;text-align:left}.stop-timeline button::before{content:'';position:absolute;left:25.5px;top:0;bottom:0;width:1px;background:#cbdcd2;z-index:0}.stop-timeline button:first-child::before{top:50%}.stop-timeline button:last-child::before{bottom:50%}.stop-timeline button:hover{background:#eef5f1}.stop-number{position:relative;z-index:1;display:grid;place-items:center;background:#e8eee9;border:4px solid #f9fbfa;box-sizing:content-box;color:#667e6f;font:12px monospace;width:27px;height:27px;border-radius:50%}.stop-name{position:relative;z-index:1}.stop-timeline .active{color:var(--lake);font-weight:700}.active .stop-number{background:var(--lake);color:white}
</style>
