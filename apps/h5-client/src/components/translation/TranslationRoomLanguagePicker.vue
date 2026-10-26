<script setup lang="ts">
import { useId } from 'vue'
import { Check } from 'lucide-vue-next'
import { ROOM_LANGUAGES } from '../../../../../packages/ts-shared/src/translation-room'

defineProps<{ label: string; disabled: boolean }>()
const language = defineModel<string>({ required: true })
const groupName = useId()
</script>

<template>
  <fieldset class="room-language-picker" :disabled="disabled">
    <legend>{{ label }}</legend>
    <div class="room-language-options">
      <label v-for="item in ROOM_LANGUAGES" :key="item.value" class="room-language-option" :class="{ 'is-selected': language === item.value }">
        <input v-model="language" type="radio" :name="groupName" :value="item.value" />
        <span :lang="item.value">{{ item.label }}</span>
        <Check v-if="language === item.value" :size="16" aria-hidden="true" />
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.room-language-picker{min-width:0;margin:0;padding:0;border:0}
.room-language-picker legend{margin-bottom:10px;padding:0;color:#2b4039;font-size:13px;font-weight:600}
.room-language-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.room-language-option{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:10px 12px;border:1px solid #d4e0d9;border-radius:10px;background:#f8faf9;color:#587066;font-size:14px;cursor:pointer}
.room-language-option.is-selected{border-color:#183e43;background:#edf5ef;color:#183e43;font-weight:600}
.room-language-option input{position:absolute;width:1px;height:1px;margin:0;opacity:0}
.room-language-option:focus-within{outline:2px solid #183e43;outline-offset:2px}
.room-language-option svg{flex-shrink:0}
.room-language-picker:disabled{opacity:.55}
.room-language-picker:disabled .room-language-option{cursor:wait}
</style>
