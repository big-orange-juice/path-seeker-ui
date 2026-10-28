<script setup lang="ts">
import { TOUR_LANGUAGES, type TourLocale } from '@path-seeker/ts-shared'

defineProps<{ title: string }>()
const emit = defineEmits<{ select: [locale: TourLocale] }>()
</script>

<template>
  <section class="tour-language-gate">
    <p>PATH SEEKER · 寻迹</p><h1>{{ title }}</h1>
    <button v-for="language in TOUR_LANGUAGES" :key="language.value" type="button" :lang="language.value" @click="emit('select', language.value)">{{ language.label }}<span>→</span></button>
  </section>
</template>

<style scoped>
.tour-language-gate>p{margin-top:auto}.tour-language-gate button:last-child{margin-bottom:auto}
.tour-language-gate{position:absolute;inset:0;z-index:15;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;gap:12px;padding:24px;overflow:auto;background:var(--tour-paper,#f5f8f1);color:var(--tour-ink,#243d37)}.tour-language-gate>p{letter-spacing:.16em;font-size:12px;color:var(--tour-lake,#246859)}.tour-language-gate h1{font-size:24px;margin:0 0 16px;text-align:center}.tour-language-gate button{display:flex;justify-content:space-between;width:min(100%,340px);border:1px solid var(--tour-line,#cedbd0);background:var(--tour-paper-strong,#fffef8);border-radius:10px;padding:15px 20px;font-size:17px}.tour-language-gate button:hover{background:var(--tour-selected,#e6eee5)}.tour-language-gate button:focus-visible{outline:2px solid var(--tour-lake,#246859);outline-offset:3px}.tour-language-gate span{color:var(--tour-lake,#246859)}
</style>
