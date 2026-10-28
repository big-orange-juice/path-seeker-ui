<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'
import { fetchPostcard, generatePostcard, uploadPostcardPhoto } from '@/services/postcards'
import type { NodeExperience, Postcard } from '@/types/postcard'
import PostcardImage from './PostcardImage.vue'

const props = defineProps<{ experience: NodeExperience; visitId: string | null; title: string }>()
const emit = defineEmits<{ close: [] }>()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const panel = useTemplateRef<HTMLElement>('panel')
let previousFocus: HTMLElement | null = null
function escapeDialog(event: KeyboardEvent) { if (event.key === 'Escape') emit('close') }
onMounted(() => { previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null; panel.value?.querySelector<HTMLButtonElement>('button')?.focus(); document.addEventListener('keydown', escapeDialog) })
function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const controls = panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')
  if (!controls?.length) return
  const target = event.shiftKey ? controls[controls.length - 1] : controls[0]
  if (document.activeElement === (event.shiftKey ? controls[0] : controls[controls.length - 1])) { event.preventDefault(); target?.focus() }
}
const templateId = shallowRef(props.experience.templates[0]?.id || '')
const caption = shallowRef('')
const photo = shallowRef<string | null>(null)
const preview = shallowRef('')
const busy = shallowRef(false)
const error = shallowRef('')
const result = shallowRef<Postcard | null>(null)
const key = shallowRef(crypto.randomUUID())
const ready = computed(() => auth.isAccountLoggedIn && Boolean(props.visitId) && Boolean(templateId.value) && (props.experience.mode !== 'ai' || Boolean(photo.value)))
let timer: ReturnType<typeof setTimeout> | undefined
let active = true
let epoch = 0
watch(() => [auth.profile?.id, auth.isAccountLoggedIn], () => {
  epoch++; clearTimeout(timer); busy.value = false; photo.value = null; result.value = null; error.value = ''; key.value = crypto.randomUUID()
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
})
watch([templateId, caption, photo], () => { key.value = crypto.randomUUID(); result.value = null; clearTimeout(timer) })
async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const stamp = epoch
  busy.value = true; error.value = ''
  try { const attachment = await uploadPostcardPhoto(file); if (!active || stamp !== epoch) return; photo.value = attachment.fileId; if (preview.value) URL.revokeObjectURL(preview.value); preview.value = URL.createObjectURL(file) }
  catch (e) { if (active && stamp === epoch) error.value = e instanceof Error ? e.message : '上传失败' }
  finally { if (active && stamp === epoch) busy.value = false }
}
async function poll(id: string) {
  const stamp = epoch
  try { const card = await fetchPostcard(id); if (!active || stamp !== epoch || result.value?.id !== id) return; result.value = card; if (card.status === 'pending' || card.status === 'rendering') timer = setTimeout(() => void poll(id), 4000) }
  catch (e) { if (active && stamp === epoch) error.value = e instanceof Error ? e.message : '查询失败，请在我的明信片中重试' }
}
async function generate() {
  if (!ready.value || busy.value) return
  const stamp = epoch
  busy.value = true; error.value = ''
  try {
    if (result.value?.status === 'failed') key.value = crypto.randomUUID()
    const card = await generatePostcard({ stageId: props.experience.stageId, visitId: props.visitId!, templateId: templateId.value, caption: caption.value, sourceAttachmentId: photo.value, idempotencyKey: key.value })
    if (!active || stamp !== epoch) return
    result.value = card
    if (card.status === 'pending' || card.status === 'rendering') timer = setTimeout(() => void poll(card.id), 4000)
  } catch (e) { if (active && stamp === epoch) error.value = e instanceof Error ? e.message : '生成失败，请重试' }
  finally { if (active && stamp === epoch) busy.value = false }
}
onBeforeUnmount(() => { active = false; clearTimeout(timer); if (preview.value) URL.revokeObjectURL(preview.value); document.removeEventListener('keydown', escapeDialog); previousFocus?.focus() })
</script>

<template>
  <div class="postcard-backdrop" @click.self="emit('close')">
    <section ref="panel" class="postcard-composer" role="dialog" aria-modal="true" aria-labelledby="postcard-title" @keydown="trapFocus">
      <header><div><small>电子明信片</small><h2 id="postcard-title">{{ title }}</h2></div><button type="button" aria-label="关闭" @click="emit('close')">关闭 ×</button></header>
      <template v-if="!auth.isAccountLoggedIn"><p>注册或登录后，留下这一站，并在“我的”中随时找回。</p><button class="primary" type="button" @click="router.push({ path: '/auth', query: { redirect: route.fullPath, mode: 'register' } })">注册 / 登录</button></template>
      <p v-else-if="!visitId">开始这条路线的游览后，即可制作明信片。</p>
      <template v-else-if="result?.status === 'completed'"><PostcardImage :id="result.id" :title="result.stageTitle" /><p>已收入“我的 · 电子明信片”。</p><button type="button" @click="router.push('/shell/me')">查看我的明信片 →</button></template>
      <template v-else>
        <label class="field-label">选择模板<select v-model="templateId" :disabled="busy || result?.status === 'pending' || result?.status === 'rendering'"><option v-for="template in experience.templates" :key="template.id" :value="template.id">{{ template.name }}</option></select></label>
        <label class="field-label">{{ experience.mode === 'ai' ? '上传照片，生成旅程纪念' : '使用自己的照片（可选）' }}<input type="file" accept="image/*" :disabled="busy || Boolean(result && result.status !== 'failed')" @change="upload"></label>
        <img v-if="preview" class="photo-preview" :src="preview" alt="已选照片">
        <label class="field-label">留一句话（可选）<textarea v-model="caption" maxlength="160" rows="2" :disabled="busy || Boolean(result && result.status !== 'failed')" placeholder="把今天的风景寄给自己。" /></label>
        <p v-if="result?.status === 'pending' || result?.status === 'rendering'" role="status">正在制作，可关闭页面，稍后在“我的”中查看。</p>
        <p v-if="error || result?.error" role="alert">{{ error || result?.error }}</p>
        <button v-if="!result || result.status === 'failed'" type="button" class="primary" :disabled="!ready || busy" @click="generate">{{ busy ? '正在处理…' : result?.status === 'failed' ? '重新生成' : '生成电子明信片' }}</button>
      </template>
    </section>
  </div>
</template>

<style scoped>
.postcard-backdrop{position:fixed;inset:0;z-index:80;background:#153c3b66;display:grid;place-items:center;padding:16px}.postcard-composer{width:min(440px,100%);max-height:90dvh;overflow:auto;background:#fffef8;color:#243d37;border:1px solid #d4e0d6;border-radius:16px;padding:22px;display:grid;gap:16px;box-shadow:0 16px 60px #133c3a33}.postcard-composer header{display:flex;justify-content:space-between;gap:16px}.postcard-composer h2{margin:4px 0 0;font-size:22px}.postcard-composer small{color:#63776d}.postcard-composer button{min-height:40px;color:#246859}.postcard-composer .primary{border-radius:9px;padding:12px;background:#246859;color:#fff}.postcard-composer button:disabled{opacity:.5}.field-label{display:grid;gap:8px;font-size:14px}.field-label select,.field-label textarea,.field-label input{width:100%;border:1px solid #c8d8ce;border-radius:8px;padding:10px;background:#fff;font-size:16px}.photo-preview{height:150px;width:100%;object-fit:contain}.postcard-composer p{font-size:14px;line-height:1.7;margin:0}
</style>
