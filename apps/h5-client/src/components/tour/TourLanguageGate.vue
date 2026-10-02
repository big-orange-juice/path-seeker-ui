<script setup lang="ts">
import { TOUR_LANGUAGES, type TourLocale } from '@path-seeker/ts-shared'

defineProps<{ title: string }>()
const emit = defineEmits<{ select: [locale: TourLocale] }>()
</script>

<template>
  <section class="tour-language-gate">
    <p>Path Seeker</p><h1>{{ title }}</h1>
    <button v-for="language in TOUR_LANGUAGES" :key="language.value" type="button" :lang="language.value" @click="emit('select', language.value)">{{ language.label }}<span>→</span></button>
  </section>
</template>

<style scoped>
.tour-language-gate{position:absolute;inset:0;z-index:15;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:16px;padding:24px;background:#171710;color:#fff8e8}.tour-language-gate>p{letter-spacing:.22em;font-size:12px;color:#d6b773}.tour-language-gate h1{font-size:24px;margin:0 0 16px}.tour-language-gate button{display:flex;justify-content:space-between;width:min(100%,320px);border:1px solid #d6b77366;background:#d6b7730d;border-radius:12px;padding:16px 20px;font-size:18px}.tour-language-gate button:hover{background:#d6b77322}.tour-language-gate span{color:#d6b773}
</style>
