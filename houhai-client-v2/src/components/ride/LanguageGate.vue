<script setup lang="ts">
import { ArrowRight, Check, Globe2 } from 'lucide-vue-next'
import { languages, message } from '../../ride/i18n'
import type { Locale } from '../../ride/types'

const locale = defineModel<Locale>({ required: true })
defineProps<{ loading: boolean; error: boolean }>()
defineEmits<{ enter: [locale: Locale] }>()
</script>

<template>
  <main class="language-gate">
    <div class="water-lines" aria-hidden="true"><span /><span /><span /></div>
    <section class="language-card">
      <div class="gate-symbol"><Globe2 :size="26" /></div>
      <p class="gate-place">什刹海 · SHICHAHAI</p>
      <h1>{{ message(locale, 'welcome') }}</h1>
      <p class="language-label">{{ message(locale, 'chooseLanguage') }}</p>
      <div class="language-options" role="group" aria-label="中文 / English / Русский / Español">
        <button v-for="language in languages" :key="language.id" :lang="language.id" :class="{ selected: locale === language.id }" :aria-pressed="locale === language.id" :disabled="loading" @click="locale = language.id">
          <span>{{ language.name }}</span><Check v-if="locale === language.id" :size="20" />
        </button>
      </div>
      <p v-if="error" role="alert">{{ message(locale, 'loadError') }}</p>
      <button class="enter-button" :disabled="loading" @click="$emit('enter', locale)">{{ message(locale, loading ? 'loading' : error ? 'retry' : 'enter') }}<ArrowRight :size="20" /></button>
    </section>
  </main>
</template>

<style scoped>
.language-gate{min-height:100dvh;display:grid;place-items:center;padding:32px 22px;position:relative;overflow:hidden;background:#e6efeb}.language-card{width:min(100%,480px);position:relative;z-index:1}.gate-symbol{width:56px;height:56px;background:var(--lake);color:white;border-radius:50%;display:grid;place-items:center;margin-bottom:28px}.gate-place{font-size:11px;letter-spacing:3px;color:#58756c}.language-card h1{font:500 clamp(30px,5vw,42px)/1.3 var(--display);margin:18px 0 36px;max-width:450px}.language-label{font-size:14px;color:#567469}.language-options{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0 32px}.language-options button{min-height:68px;display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border:1px solid #b5cbc2;border-radius:14px;background:#f8faf9;font-size:18px;color:var(--lake)}.language-options .selected{border:2px solid var(--lake);padding:15px 17px;background:#d3e4dc}.enter-button{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:58px;border:0;border-radius:14px;padding:16px 22px;background:var(--lake);color:white;font-weight:600}.water-lines{position:absolute;right:-32vw;bottom:-30vw;width:95vw;height:95vw;border:1px solid #b5cdc3;border-radius:50%;pointer-events:none}.water-lines span{position:absolute;inset:8%;border:1px solid #b5cdc3;border-radius:50%}.water-lines span:nth-child(2){inset:17%}.water-lines span:nth-child(3){inset:27%}
</style>
