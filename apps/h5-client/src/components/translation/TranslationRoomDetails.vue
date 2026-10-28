<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'
import { X } from 'lucide-vue-next'
import { ROOM_LANGUAGES } from '../../../../../packages/ts-shared/src/translation-room'
import type { TranslationRoom } from '@/services/translationRoom'
import { formatRoomMessage, roomMessages } from '../../../../../packages/ts-shared/src/translation-room-messages'

const props = defineProps<{ room: TranslationRoom; busy: boolean; language: string }>()
const messages = computed(() => roomMessages(props.language))
const emit = defineEmits<{ close: []; end: [immediate: boolean]; leave: []; changeLanguage: [] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const languageGroups = computed(() => (props.room.languages || []).map(group => ({
  ...group,
  label: ROOM_LANGUAGES.find(item => item.value === group.language)?.label || group.language,
  names: (props.room.members || []).filter(member => member.language === group.language).map(member => member.displayName).join(', '),
})))
onMounted(() => dialog.value?.showModal())
</script>

<template>
  <dialog ref="dialog" class="room-details" :lang="language" aria-labelledby="room-details-title" @close="emit('close')" @click="($event.target === dialog) && dialog?.close()">
    <header class="room-details-header"><h2 id="room-details-title">{{ messages.details }}</h2><button type="button" class="room-details-close" :aria-label="messages.closeDetails" @click="dialog?.close()"><X :size="20" /></button></header>
    <div class="room-details-content">
      <div class="room-invite"><span class="room-caption">{{ room.isHost ? messages.invite : messages.currentCode }}</span><strong class="room-session-code">{{ room.code }}</strong><img v-if="room.isHost && room.qrImageDataUri" :src="room.qrImageDataUri" class="room-qr" :alt="messages.qr" /><span class="room-caption">{{ formatRoomMessage(messages.listeners, { count: room.listenerCount }) }}</span></div>
      <section v-if="room.isHost" class="room-detail-members" :aria-label="messages.members"><h3>{{ messages.members }}</h3><p v-if="!languageGroups.length" class="room-caption">{{ messages.noMembers }}</p><div v-for="group in languageGroups" :key="group.language" class="room-detail-member"><span class="room-member-avatar">{{ group.language.split('-')[0].toUpperCase() }}</span><div><strong>{{ group.label }} · {{ formatRoomMessage(messages.people, { count: group.count }) }}</strong><p>{{ group.names || messages.guest }}</p></div></div></section>
      <slot name="connection" />
      <button v-if="!room.isHost && room.status !== 'closed'" type="button" class="room-action" :disabled="busy" @click="emit('changeLanguage')">{{ messages.changeLanguage }}</button>
      <template v-if="room.isHost && room.status !== 'closed'"><button type="button" class="room-action" :disabled="busy" @click="emit('end', false)">{{ messages.end }}</button><button type="button" class="room-action room-action-danger" :disabled="busy" @click="emit('end', true)">{{ messages.closeRoom }}</button></template>
      <button type="button" class="room-action room-action-quiet" :disabled="busy" @click="emit('leave')">{{ room.isHost ? messages.leaveHost : messages.leave }}</button>
    </div>
  </dialog>
</template>

<style scoped>
.room-details{position:fixed;inset:auto 0 0;width:min(100%,680px);max-width:100%;max-height:85dvh;margin:0 auto;padding:0;border:1px solid #d9e5dc;border-bottom:0;border-radius:26px 26px 0 0;background:#fcfefd;color:#183e43;box-shadow:0 -10px 40px #183e4314}.room-details::backdrop{background:#102a3066}
.room-details-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #d9e5dc}.room-details-header h2{margin:0;font:600 20px/1.4 "Noto Serif SC","Songti SC","STSong",serif}.room-details-close{display:grid;place-items:center;width:40px;height:40px;border:0;border-radius:50%;background:#edf1ee;color:#183e43;cursor:pointer}
.room-details-content{display:grid;gap:16px;padding:20px 20px max(24px,env(safe-area-inset-bottom))}.room-invite{display:flex;flex-direction:column;align-items:center;gap:12px;padding:22px 16px;border:1px solid #d9e5dc;border-radius:20px;background:#f1f6f3}.room-session-code{font-size:30px;letter-spacing:5px;font-variant-numeric:tabular-nums}.room-qr{width:160px;height:160px;background:#fff}
.room-detail-members h3{margin:0 0 12px;font-size:14px}.room-detail-member{display:flex;align-items:center;gap:12px;margin:12px 0}.room-member-avatar{display:grid;place-items:center;flex:0 0 38px;height:38px;border:1px solid #d9e5dc;border-radius:11px;background:#edf5ef;font-size:11px;font-weight:600}.room-detail-member strong{font-size:13px;font-weight:500}.room-detail-member p{margin:3px 0;color:#7b8a80;font-size:12px;overflow-wrap:anywhere}.room-details-close:focus-visible{outline:2px solid #183e43;outline-offset:2px}
</style>
