<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { postcardImage } from '@/services/postcards'
import { useAuthStore } from '@/stores/useAuthStore'

const props = defineProps<{ id: string; title: string; thumbnail?: boolean }>()
const auth = useAuthStore()
const source = shallowRef('')
const error = shallowRef('')
const retry = shallowRef(0)
function release() { if (source.value) URL.revokeObjectURL(source.value); source.value = '' }
watch(() => [props.id, auth.profile?.id, retry.value], async (_, __, cleanup) => {
  let active = true
  cleanup(() => { active = false })
  release(); error.value = ''
  try { const url = await postcardImage(props.id); if (active) source.value = url; else URL.revokeObjectURL(url) }
  catch (e) { if (active) error.value = e instanceof Error ? e.message : '图片加载失败' }
}, { immediate: true })
onBeforeUnmount(release)
</script>

<template>
  <figure class="postcard-image" :class="{ thumbnail }">
    <img v-if="source" :src="source" :alt="title" loading="lazy">
    <p v-else-if="error" role="status">{{ error }} <button type="button" @click="retry++">重试</button></p>
    <p v-else role="status">正在取出明信片…</p>
    <a v-if="source && !thumbnail" :href="source" :download="`${title}.png`">保存图片</a>
  </figure>
</template>

<style scoped>
.postcard-image{margin:0;display:grid;gap:12px}.postcard-image img{width:100%;max-height:65vh;object-fit:contain;border-radius:8px;background:#eef4f0}.postcard-image a,.postcard-image button{color:#246859;text-align:center;text-decoration:underline;text-underline-offset:4px}.postcard-image p{padding:24px;text-align:center;color:#61756c}
.postcard-image.thumbnail img{max-height:200px}.postcard-image.thumbnail p{font-size:12px;padding:12px}
</style>
