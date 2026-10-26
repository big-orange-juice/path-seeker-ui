<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { roomMessages } from '../../../../../packages/ts-shared/src/translation-room-messages'
import { ArrowRight, Headphones, Mic } from 'lucide-vue-next'
import TranslationRoomLanguagePicker from './TranslationRoomLanguagePicker.vue'

defineProps<{ canHost: boolean; busy: boolean; initialCode: string }>()
const language = defineModel<string>('language', { default: 'zh-CN' })
const messages = computed(() => roomMessages(language.value))
const emit = defineEmits<{ create: [language: string]; join: [code: string, language: string] }>()
const code = shallowRef('')
</script>

<template>
  <form v-if="!canHost" class="room-form" @submit.prevent="emit('join', code || initialCode, language)">
    <div class="room-card-heading">
      <span class="room-card-icon"><Headphones :size="22" aria-hidden="true" /></span>
      <div><h2>{{ messages.joinTitle }}</h2><p>{{ messages.joinHint }}</p></div>
    </div>
    <label class="room-field-label">{{ messages.roomCode }}<input v-model="code" class="room-code-input" :placeholder="initialCode || messages.codePlaceholder" :aria-label="messages.codeAria" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" autocomplete="off" :required="!initialCode" :disabled="busy" /></label>
    <TranslationRoomLanguagePicker v-model="language" :label="messages.listenLanguage" :disabled="busy" />
    <button class="room-action room-action-primary" type="submit" :disabled="busy"><span>{{ busy ? messages.connecting : messages.join }}</span><ArrowRight :size="18" aria-hidden="true" /></button>
    <p class="room-help">{{ messages.listenHint }}</p>
  </form>
  <form v-else class="room-form" @submit.prevent="emit('create', language)">
    <div class="room-card-heading">
      <span class="room-card-icon"><Mic :size="22" aria-hidden="true" /></span>
      <div><h2>{{ messages.hostTitle }}</h2><p>{{ messages.hostIntro }}</p></div>
    </div>
    <TranslationRoomLanguagePicker v-model="language" :label="messages.speakLanguage" :disabled="busy" />
    <button class="room-action room-action-primary" type="submit" :disabled="busy">{{ messages.create }}</button>
  </form>
</template>
