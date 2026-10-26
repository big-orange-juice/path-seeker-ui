<script setup lang="ts">
import { ref } from 'vue'
import { ROOM_LANGUAGES } from '../../../../../packages/ts-shared/src/translation-room'

defineProps<{ canHost: boolean; busy: boolean; initialCode: string }>()
const emit = defineEmits<{ create: [language: string]; join: [code: string, language: string] }>()
const code = ref('')
const language = ref('en')
const sourceLanguage = ref('zh-CN')
</script>

<template>
  <form class="room-form" @submit.prevent="emit('join', code || initialCode, language)">
    <h2>收听车夫讲解</h2>
    <label>房间码<input v-model="code" :placeholder="initialCode || '输入八位房间码'" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" :required="!initialCode" /></label>
    <label>收听语言<select v-model="language"><option v-for="item in ROOM_LANGUAGES" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
    <button :disabled="busy">开始收听</button>
    <p>从下一段完整讲解开始收听。建议佩戴耳机。</p>
  </form>
  <form v-if="canHost" class="room-form" @submit.prevent="emit('create', sourceLanguage)">
    <h2>车夫讲解台</h2>
    <label>讲话语言<select v-model="sourceLanguage"><option v-for="item in ROOM_LANGUAGES" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
    <button :disabled="busy">创建或返回讲解房间</button>
  </form>
</template>
