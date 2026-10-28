<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef, useTemplateRef } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Input from '@/components/shadcn/input/Input.vue'
import { useUploadAttachment } from '@/composables/useUploadAttachment'
import type { NodeExperience, PostcardTemplate } from '@/types/postcard'

const props = defineProps<{ stageId: string; canEdit: boolean; disabled: boolean }>()
const emit = defineEmits<{ changed: []; busy: [value: boolean] }>()
const { request } = useApiClient()
const { uploadAttachment } = useUploadAttachment()
const draft = reactive<NodeExperience>({ stageId: props.stageId, enabled: false, mode: 'html', templateIds: [], media: [], version: 0 })
const templates = shallowRef<PostcardTemplate[]>([])
const loading = shallowRef(true)
const busy = shallowRef(false)
const error = shallowRef('')
const initial = shallowRef('')
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
let mediaKind: 'audio' | 'video' = 'audio'
const available = computed(() => templates.value.filter(item => item.enabled && item.mode === draft.mode))
const readonly = computed(() => !props.canEdit || props.disabled || loading.value || busy.value)
async function load() {
  loading.value = true; error.value = ''
  try { const [node, items] = await Promise.all([request<NodeExperience>('/api/postcards/node', { query: { stageId: props.stageId } }), request<PostcardTemplate[]>('/api/postcards/templates')]); Object.assign(draft, node); templates.value = items; initial.value = JSON.stringify(draft) }
  catch (e) { error.value = e instanceof Error ? e.message : '节点设置加载失败' }
  finally { loading.value = false }
}
function toggleTemplate(id: string, checked: boolean) { draft.templateIds = checked ? [...draft.templateIds, id] : draft.templateIds.filter(item => item !== id) }
function pick(kind: 'audio' | 'video') { mediaKind = kind; if (fileInput.value) { fileInput.value.accept = `${kind}/*`; fileInput.value.click() } }
async function upload(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  if (!file) return
  const kind = mediaKind
  busy.value = true; emit('busy', true); error.value = ''
  try { const item = await uploadAttachment(file, 'file'); if (!item.fileId) throw new Error('附件上传失败'); draft.media.push({ id: crypto.randomUUID(), kind, title: file.name, attachmentId: item.fileId, afterSegmentNo: 1, order: draft.media.length + 1 }) }
  catch (e) { error.value = e instanceof Error ? e.message : '上传失败' }
  finally { busy.value = false; emit('busy', false); input.value = '' }
}
async function save() {
  if (!initial.value) throw new Error('请先成功加载节点设置')
  if (busy.value) throw new Error('请等待媒体上传完成')
  if (initial.value === JSON.stringify(draft)) return
  await request('/api/postcards/save-node', { method: 'POST', body: { ...draft, expectedVersion: draft.version } })
  draft.version++; initial.value = JSON.stringify(draft); emit('changed')
}
defineExpose({ save })
onMounted(load)
</script>

<template>
  <section class="space-y-3 border-t pt-4">
    <h3 class="text-sm font-medium">电子明信片</h3>
    <label class="flex items-center gap-2 text-sm"><input v-model="draft.enabled" type="checkbox" :disabled="readonly">允许在本节点制作明信片</label>
    <div v-if="draft.enabled" class="space-y-3"><label class="flex items-center gap-3 text-sm">生成方式<select v-model="draft.mode" class="h-9 rounded-md border bg-background px-3" :disabled="readonly" @change="draft.templateIds = []"><option value="html">普通明信片</option><option value="ai">终点图生图</option></select></label><p v-if="draft.mode === 'ai'" class="text-xs text-muted-foreground">图生图仅用于路线最后一个节点，需要游客提供照片。</p><div class="flex flex-wrap gap-3"><label v-for="item in available" :key="item.id" class="flex items-center gap-2 text-sm"><input type="checkbox" :checked="draft.templateIds.includes(item.id)" :disabled="readonly" @change="toggleTemplate(item.id, ($event.target as HTMLInputElement).checked)">{{ item.name }}</label><p v-if="!available.length" class="text-xs text-muted-foreground">暂无可用模板，请先到明信片模板中维护。</p></div></div>
    <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="text-sm font-medium">段间音乐与视频</h3><div class="flex gap-2"><Button size="sm" variant="outline" :disabled="readonly" @click="pick('audio')">添加音乐</Button><Button size="sm" variant="outline" :disabled="readonly" @click="pick('video')">添加视频</Button></div></div>
    <p class="text-xs text-muted-foreground">先设置讲解分段，再选择插入位置。媒体结束后继续下一段讲解；未设置对应分段的讲解员不插入媒体。</p>
    <div v-for="(item, index) in draft.media" :key="item.id" class="flex flex-wrap items-center gap-2 rounded-lg border p-3"><span class="text-xs">{{ item.kind === 'audio' ? '音乐' : '视频' }}</span><Input v-model="item.title" class="min-w-32 flex-1" :disabled="readonly" placeholder="标题" /><label class="flex items-center gap-1 text-xs">第<input v-model.number="item.afterSegmentNo" type="number" min="1" max="99" class="h-9 w-16 rounded-md border bg-background px-2" :disabled="readonly">段后</label><Button size="sm" variant="ghost" :disabled="readonly" @click="draft.media.splice(index, 1)">移除</Button></div>
    <input ref="fileInput" type="file" class="hidden" @change="upload">
    <p v-if="loading" class="text-xs text-muted-foreground">加载节点设置…</p><p v-if="error" class="text-xs text-destructive">{{ error }} <button type="button" @click="load">重试</button></p>
  </section>
</template>

