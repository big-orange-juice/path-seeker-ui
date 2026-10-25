<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import TranslationRoomControls from './TranslationRoomControls.vue'
import { useTranslationRoom } from '@/composables/useTranslationRoom'

const route = useRoute()
const feature = useTranslationRoom()
const { room, vehicles, source, translated, notice, error, busy, listening, speaking, muted } = feature
const initialCode = typeof route.query.roomCode === 'string' ? route.query.roomCode : ''
onMounted(feature.loadVehicles)
</script>

<template>
  <main class="translation-room">
    <header class="room-header"><RouterLink to="/ride">‹ 返回导航</RouterLink><h1>实时讲解</h1></header>
    <p role="status">{{ notice }}</p>
    <p v-if="error" role="alert" class="room-error">{{ error }}</p>
    <TranslationRoomControls v-if="!room || (!room.isHost && !listening)" :vehicles="vehicles" :busy="busy" :initial-code="room?.code || initialCode" @create="feature.create" @join="feature.join" />
    <section v-if="room" class="room-session">
      <h2>房间 {{ room.code }}</h2>
      <template v-if="room.isHost">
        <img v-if="room.qrImageDataUri" :src="room.qrImageDataUri" class="room-qr" alt="讲解房间二维码" />
        <p>请游客扫码或输入房间码加入 · {{ room.listenerCount }} 人在线</p>
        <p v-for="item in room.languages" :key="item.language">{{ item.language }} · {{ item.count }} 人</p>
        <button :disabled="busy || speaking || room.status === 'closed'" @click="feature.startSpeaking">{{ speaking ? '正在讲解' : '开始 / 恢复讲解' }}</button>
        <button :disabled="busy || room.status === 'closed'" @click="feature.end(false)">结束讲解并播完剩余语音</button>
        <button :disabled="busy || room.status === 'closed'" @click="feature.end(true)">立即关闭房间</button>
      </template>
      <p class="room-subtitle">{{ source || '等待下一段讲解…' }}</p>
      <p class="room-translation" aria-live="polite">{{ translated }}</p>
      <button v-if="!room.isHost && listening" @click="feature.toggleMute">{{ muted ? '恢复收听' : '暂停收听' }}</button>
      <button v-if="!room.isHost && listening" @click="feature.changeLanguage">更换语言（停止当前语音）</button>
      <button :disabled="busy" @click="feature.leave">{{ room.isHost ? '离开讲解台' : '停止收听并退出' }}</button>
    </section>
  </main>
</template>

<style>
.translation-room{min-height:100dvh;background:#f8faf9;color:#183e43;padding:24px max(20px,calc((100vw - 720px)/2));font-family:system-ui,sans-serif}.room-header{display:flex;align-items:center;gap:24px}.room-header h1{font-size:24px}.room-form,.room-session{display:grid;gap:16px;margin:20px 0;padding:20px;border:1px solid #cbd9d3;border-radius:12px}.room-form label{display:grid;gap:8px}.translation-room input,.translation-room select,.translation-room button{padding:12px;border:1px solid #cbd9d3;border-radius:8px;font:inherit}.translation-room button{background:#183e43;color:#fff;cursor:pointer}.translation-room button:disabled{opacity:.5;cursor:default}.room-error{color:#a52d28}.room-subtitle{color:#667e7c;white-space:pre-wrap}.room-translation{font-size:22px;line-height:1.8;white-space:pre-wrap}.room-qr{width:180px;height:180px}
</style>
