<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Input from '@/components/shadcn/input/Input.vue'
import Textarea from '@/components/shadcn/textarea/Textarea.vue'
import { useUploadAttachment } from '@/composables/useUploadAttachment'
import type { NarrationDetailResponse, NarrationSegmentResponse, SaveNarrationSegmentsRequest } from '@/types/narration'

const props = defineProps<{ stageId: string; detail: NarrationDetailResponse; canEdit: boolean; disabled: boolean }>()
const emit = defineEmits<{ saved: []; busy: [value: boolean] }>()
const { request } = useApiClient()
const { uploadAttachment } = useUploadAttachment()
const segments = ref<NarrationSegmentResponse[]>([])
const videoAttachmentId = shallowRef('')
const videoUrl = shallowRef('')
const initial = shallowRef('')
const uploading = shallowRef(false)
const error = shallowRef('')
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
let audioIndex: number | null = null
const snapshot = () => JSON.stringify({ segments: segments.value, videoAttachmentId: videoAttachmentId.value })
const dirty = computed(() => initial.value !== snapshot())

watch(() => props.detail, detail => {
  if (initial.value && dirty.value) return
  segments.value = (detail.segments ?? []).map(segment => ({ ...segment }))
  videoAttachmentId.value = detail.videoAttachmentId || ''
  videoUrl.value = detail.videoUrl || ''
  initial.value = snapshot()
}, { immediate: true })

function add() {
  segments.value.push({ segmentNo: segments.value.length + 1, title: '', text: '', audioAttachmentId: null, audioUrl: null, audioStatus: 0, durationMs: null })
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= segments.value.length) return
  const next = [...segments.value]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  segments.value = next
}

function pick(index: number | null) {
  audioIndex = index
  if (fileInput.value) { fileInput.value.accept = index === null ? 'video/*' : 'audio/*'; fileInput.value.click() }
}

async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const index = audioIndex
  uploading.value = true
  emit('busy', true)
  error.value = ''
  try {
    const attachment = await uploadAttachment(file, 'file')
    if (!attachment.fileId) throw new Error('附件上传失败。')
    if (index === null) { videoAttachmentId.value = attachment.fileId; videoUrl.value = attachment.fileUrl || '' }
    else if (segments.value[index]) {
      segments.value[index]!.audioAttachmentId = attachment.fileId
      segments.value[index]!.audioUrl = attachment.fileUrl
      segments.value[index]!.audioStatus = 1
    }
  } catch (caught) { error.value = caught instanceof Error ? caught.message : '上传失败。' }
  finally { uploading.value = false; emit('busy', false); input.value = '' }
}

async function save() {
  if (!dirty.value) return
  if (uploading.value) throw new Error('请等待附件上传完成。')
  if (segments.value.some(segment => !segment.text?.trim())) throw new Error('请填写每段讲解正文，或移除空段落。')
  const body: SaveNarrationSegmentsRequest = {
    stageId: props.stageId,
    segments: segments.value.map((segment, index) => ({ segmentNo: index + 1, title: segment.title?.trim() || null, text: segment.text!.trim(), audioAttachmentId: segment.audioAttachmentId || null, durationMs: segment.durationMs })),
    videoAttachmentId: videoAttachmentId.value,
  }
  await request('/api/narration/save-segments', { method: 'POST', body })
  initial.value = snapshot()
  emit('saved')
}

defineExpose({ save })
</script>

<template>
  <section class="space-y-3 border-t border-border/60 pt-4">
    <div class="flex items-center justify-between"><h3 class="text-sm font-medium">分段讲解与视频</h3><Button type="button" size="sm" variant="outline" :disabled="!canEdit || disabled || uploading" @click="add">新增段落</Button></div>
    <p v-if="detail.locale && detail.locale !== 'zh'" class="text-xs text-muted-foreground">该语言使用系统语音朗读，音频可留空。</p>
    <div v-for="(segment, index) in segments" :key="index" class="space-y-2 rounded-lg border p-3">
      <div class="flex items-center gap-2"><strong class="text-xs">第 {{ index + 1 }} 段</strong><Input :model-value="segment.title || ''" class="flex-1" placeholder="段落标题" :disabled="!canEdit || disabled || uploading" @update:model-value="segment.title = $event" /><Button type="button" size="sm" variant="ghost" :disabled="!canEdit || disabled || uploading || index === 0" @click="move(index, -1)">上移</Button><Button type="button" size="sm" variant="ghost" :disabled="!canEdit || disabled || uploading || index === segments.length - 1" @click="move(index, 1)">下移</Button><Button type="button" size="sm" variant="ghost" :disabled="!canEdit || disabled || uploading" @click="segments.splice(index, 1)">移除</Button></div>
      <Textarea :model-value="segment.text || ''" rows="4" placeholder="讲解正文" :disabled="!canEdit || disabled || uploading" @update:model-value="segment.text = $event" />
      <div class="flex flex-wrap items-center gap-2"><audio v-if="segment.audioUrl" :src="segment.audioUrl" controls preload="none" class="h-8 max-w-full" /><Button type="button" size="sm" variant="outline" :disabled="!canEdit || disabled || uploading" @click="pick(index)">上传段音频</Button><Button v-if="segment.audioAttachmentId" type="button" size="sm" variant="ghost" :disabled="!canEdit || disabled || uploading" @click="segment.audioAttachmentId = null; segment.audioUrl = null; segment.audioStatus = 0">清除音频</Button></div>
    </div>
    <p v-if="!segments.length" class="text-xs text-muted-foreground">未设置分段时，沿用上方整段解说词。</p>
    <div class="flex items-center gap-2"><Button type="button" size="sm" variant="outline" :disabled="!canEdit || disabled || uploading" @click="pick(null)">{{ uploading ? '上传中…' : '上传站点视频' }}</Button><Button v-if="videoAttachmentId" type="button" size="sm" variant="ghost" :disabled="!canEdit || disabled || uploading" @click="videoAttachmentId = ''; videoUrl = ''">清除视频</Button></div>
    <video v-if="videoUrl" :src="videoUrl" controls preload="none" class="max-h-48 w-full rounded-md" />
    <input ref="fileInput" type="file" class="hidden" @change="upload">
    <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
  </section>
</template>
