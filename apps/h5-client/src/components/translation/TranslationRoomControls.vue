<script setup lang="ts">
import { ref } from 'vue'
import { ROOM_LANGUAGES } from '../../../../../packages/ts-shared/src/translation-room'
import type { HostVehicle } from '@/services/translationRoom'

defineProps<{ vehicles: HostVehicle[]; busy: boolean; initialCode: string }>()
const emit = defineEmits<{ create: [rickshawId: string, language: string]; join: [code: string, language: string] }>()
const code = ref('')
const language = ref('en')
const sourceLanguage = ref('zh-CN')
const vehicleId = ref('')
</script>

<template>
  <form class="room-form" @submit.prevent="emit('join', code || initialCode, language)">
    <h2>收听车夫讲解</h2>
    <label>房间码<input v-model="code" :placeholder="initialCode || '输入八位房间码'" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" :required="!initialCode" /></label>
    <label>收听语言<select v-model="language"><option v-for="item in ROOM_LANGUAGES" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
    <button :disabled="busy">开始收听</button>
    <p>从下一段完整讲解开始收听。建议佩戴耳机。</p>
  </form>
  <form v-if="vehicles.length" class="room-form" @submit.prevent="emit('create', vehicleId || vehicles[0]!.rickshawId, sourceLanguage)">
    <h2>车夫讲解台</h2>
    <label>车辆<select v-model="vehicleId"><option value="" disabled>选择车辆</option><option v-for="vehicle in vehicles" :key="vehicle.rickshawId" :value="vehicle.rickshawId">{{ vehicle.vehicleNo }} · {{ vehicle.driverName }}</option></select></label>
    <label>讲话语言<select v-model="sourceLanguage"><option v-for="item in ROOM_LANGUAGES" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
    <button :disabled="busy">创建或返回讲解房间</button>
  </form>
</template>
