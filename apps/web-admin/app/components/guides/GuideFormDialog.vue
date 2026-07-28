<script setup lang="ts">
import { computed, reactive, shallowRef, useTemplateRef, watch } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import Input from '@/components/shadcn/input/Input.vue'
import Select from '@/components/shadcn/select/Select.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import GuideTagDialog from '@/components/guides/GuideTagDialog.vue'
import { useUploadAttachment } from '@/composables/useUploadAttachment'
import type { GuideDraft, TtsVoiceResponse } from '@/types/guide'
import {
  extractAudioMp3FromVideo,
  isAudioVoiceMaterial,
  isVideoVoiceMaterial,
} from '@/utils/extractVoiceAudioClient'

/** 声音样本体积上限：20MB（视频按原文件计，抽音后通常更小） */
const MAX_VOICE_MATERIAL_BYTES = 20 * 1024 * 1024
/** 单次最多上传样本数 */
const MAX_VOICE_MATERIAL_COUNT = 8

/** 列表展示用：含视频抽音中的条目 */
interface MaterialListItem {
  key: string
  /** 就绪后为音频 File；转换中为 null */
  file: File | null
  label: string
  sizeText: string
  status: 'ready' | 'converting' | 'failed'
  fromVideo: boolean
  error?: string
}

interface Props {
  open: boolean
  mode: 'create' | 'edit'
  initialValue: GuideDraft
  submitting?: boolean
  voiceOptions?: TtsVoiceResponse[]
  voiceLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  submitting: false,
  voiceOptions: () => [],
  voiceLoading: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [draft: GuideDraft]
  /** 音色关键词搜索（远端） */
  'search-voice': [keyword: string]
}>()

const { uploadAttachment } = useUploadAttachment()

const form = reactive<GuideDraft>({
  ...props.initialValue,
  tagIds: [...(props.initialValue.tagIds ?? [])],
})
const avatarPreviewUrl = shallowRef('')
const avatarInputRef = useTemplateRef<HTMLInputElement>('avatarInput')
const materialInputRef = useTemplateRef<HTMLInputElement>('materialInput')
const avatarUploading = shallowRef(false)
const avatarError = shallowRef('')
const materialError = shallowRef('')
const tagDialogOpen = shallowRef(false)
/** 样本列表（含转换态）；就绪项同步进 form.materialFiles */
const materialItems = shallowRef<MaterialListItem[]>([])

const isVoiceMaterialFile = (file: File) =>
  isAudioVoiceMaterial(file) || isVideoVoiceMaterial(file)

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const syncMaterialFilesToForm = () => {
  const ready = materialItems.value
    .filter((item) => item.status === 'ready' && item.file)
    .map((item) => item.file as File)
  form.materialFiles = ready
  form.materialFile = ready[0] ?? null
  form.materialFileName = ready[0]?.name || ''
  form.txtMaterialFile = null
  form.txtMaterialFileName = ''
}

const materialConverting = computed(() =>
  materialItems.value.some((item) => item.status === 'converting'),
)

/** 标签名称缓存：仅用于表单回显，key 为 tagId */
const tagNameMap = shallowRef<Record<string, string>>({})

/** 后端可能不返回 tagIds，模板一律读这里避免 undefined.length */
const selectedTagIds = computed(() => form.tagIds ?? [])

const selectedTagChips = computed(() =>
  selectedTagIds.value.map((tagId) => ({
    id: tagId,
    name: tagNameMap.value[tagId] || '未命名标签',
  })),
)

const handleTagIdsChange = (next: string[]) => {
  form.tagIds = [...next]
}

const handleTagsChange = (tags: Array<{ id: string, name: string }>) => {
  const next = { ...tagNameMap.value }
  for (const tag of tags) {
    next[tag.id] = tag.name
  }
  tagNameMap.value = next
}

const materialSummary = computed(() => {
  const items = materialItems.value
  if (!items.length) {
    return ''
  }
  const converting = items.filter((item) => item.status === 'converting').length
  const ready = items.filter((item) => item.status === 'ready').length
  if (converting > 0) {
    return `抽取音频中…（${ready}/${items.length} 就绪）`
  }
  if (items.length === 1) {
    return items[0]?.label || '1 个样本'
  }
  return `已选 ${items.length} 个样本`
})

watch(
  () => [props.open, props.initialValue] as const,
  ([open]) => {
    if (!open) {
      return
    }
    Object.assign(form, {
      ...props.initialValue,
      tagIds: [...(props.initialValue.tagIds ?? [])],
      materialFile: null,
      materialFileName: '',
      materialFiles: [],
      txtMaterialFile: null,
      txtMaterialFileName: '',
    })
    materialItems.value = []
    materialError.value = ''
    avatarError.value = ''
    avatarUploading.value = false
    avatarPreviewUrl.value = String(props.initialValue.avatarPreviewUrl || '').trim()
  },
  { deep: true },
)

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const title = computed(() => (props.mode === 'edit' ? '编辑导游' : '新增导游'))

const canSubmit = computed(() =>
  Boolean(String(form.name || '').trim())
  && !props.submitting
  && !avatarUploading.value
  && !materialConverting.value,
)

const voiceSelectOptions = computed(() => {
  const options = props.voiceOptions ?? []
  const currentId = String(form.providerVoiceId || '').trim()
  const hasCurrent = currentId
    && options.some((item) => String(item.providerVoiceId || '').trim() === currentId)

  if (currentId && !hasCurrent) {
    return [
      {
        id: currentId,
        providerVoiceId: currentId,
        voiceName: currentId,
        provider: '',
      } as TtsVoiceResponse,
      ...options,
    ]
  }

  return options
})

const voiceOptionLabel = (voice: TtsVoiceResponse) => {
  const name = String(voice.voiceName || '').trim()
  const id = String(voice.providerVoiceId || '').trim()
  const provider = String(voice.provider || '').trim()
  if (name) {
    return provider && provider !== name ? `${name}（${provider}）` : name
  }
  return id || '未命名音色'
}

const openAvatarPicker = () => {
  if (avatarUploading.value || props.submitting) {
    return
  }
  avatarInputRef.value?.click()
}

const handleAvatarChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) {
    return
  }

  avatarUploading.value = true
  avatarError.value = ''
  try {
    const uploaded = await uploadAttachment(file, 'image')
    const fileId = String(uploaded?.fileId ?? '').trim()
    const fileUrl = String(uploaded?.fileUrl ?? '').trim()
    if (!fileId) {
      throw new Error('上传成功但未返回附件标识。')
    }
    form.avatarAttachmentId = fileId
    form.avatarPreviewUrl = fileUrl || null
    avatarPreviewUrl.value = fileUrl
  } catch (error) {
    avatarError.value = error instanceof Error && error.message
      ? error.message
      : '头像上传失败。'
  } finally {
    avatarUploading.value = false
  }
}

const clearAvatar = (event: Event) => {
  event.stopPropagation()
  if (avatarUploading.value || props.submitting) {
    return
  }
  form.avatarAttachmentId = null
  form.avatarPreviewUrl = null
  avatarPreviewUrl.value = ''
  avatarError.value = ''
}

const openMaterialPicker = () => {
  if (materialConverting.value || props.submitting) {
    return
  }
  materialInputRef.value?.click()
}

const patchMaterialItem = (key: string, patch: Partial<MaterialListItem>) => {
  materialItems.value = materialItems.value.map((item) =>
    item.key === key ? { ...item, ...patch } : item,
  )
  syncMaterialFilesToForm()
}

/** 视频选中后立即在浏览器抽成 mp3 */
const convertVideoItem = async (key: string, source: File) => {
  try {
    const audio = await extractAudioMp3FromVideo(source)
    patchMaterialItem(key, {
      file: audio,
      label: audio.name,
      sizeText: formatFileSize(audio.size),
      status: 'ready',
      fromVideo: true,
      error: undefined,
    })
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : `「${source.name}」提取音频失败。`
    patchMaterialItem(key, {
      file: null,
      status: 'failed',
      error: message,
    })
    materialError.value = message
  }
}

const handleMaterialChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files || [])
  materialError.value = ''
  input.value = ''

  if (!picked.length) {
    return
  }

  const next = [...materialItems.value]
  const errors: string[] = []
  const pendingConvert: Array<{ key: string, file: File }> = []

  for (const file of picked) {
    if (next.length >= MAX_VOICE_MATERIAL_COUNT) {
      errors.push(`最多上传 ${MAX_VOICE_MATERIAL_COUNT} 个声音样本。`)
      break
    }
    if (!isVoiceMaterialFile(file)) {
      errors.push(`「${file.name}」格式不支持，请上传音频或常见视频。`)
      continue
    }
    if (file.size > MAX_VOICE_MATERIAL_BYTES) {
      errors.push(`「${file.name}」超过 20MB（${formatFileSize(file.size)}）。`)
      continue
    }
    const dup = next.some(
      (item) =>
        item.label === file.name
        || (item.file
          && item.file.name === file.name
          && item.file.size === file.size
          && item.file.lastModified === file.lastModified),
    )
    if (dup) {
      continue
    }

    const key = `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    if (isVideoVoiceMaterial(file)) {
      next.push({
        key,
        file: null,
        label: file.name,
        sizeText: formatFileSize(file.size),
        status: 'converting',
        fromVideo: true,
      })
      pendingConvert.push({ key, file })
    } else {
      next.push({
        key,
        file,
        label: file.name,
        sizeText: formatFileSize(file.size),
        status: 'ready',
        fromVideo: false,
      })
    }
  }

  materialItems.value = next
  syncMaterialFilesToForm()

  if (errors.length) {
    materialError.value = errors[0] || ''
  }

  for (const item of pendingConvert) {
    void convertVideoItem(item.key, item.file)
  }
}

const removeMaterialAt = (index: number) => {
  materialItems.value = materialItems.value.filter((_, i) => i !== index)
  syncMaterialFilesToForm()
  materialError.value = ''
}

const clearMaterials = () => {
  materialItems.value = []
  syncMaterialFilesToForm()
  materialError.value = ''
}

const handleSubmit = () => {
  if (!canSubmit.value) {
    return
  }
  if (materialItems.value.some((item) => item.status === 'failed')) {
    materialError.value = '请移除提取失败的样本后再保存。'
    return
  }
  const files = form.materialFiles || []
  emit('submit', {
    ...form,
    tagIds: [...selectedTagIds.value],
    materialFile: files[0] ?? null,
    materialFileName: files[0]?.name || '',
    materialFiles: files,
    txtMaterialFile: null,
    txtMaterialFileName: '',
  })
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[90vh] max-w-[min(94vw,40rem)] flex-col overflow-hidden rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="shrink-0 space-y-1 border-b border-border/60 px-5 py-3.5 pr-12">
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>
          维护基础资料。优先选择内置音色，必要时再上传声音样本。
        </DialogDescription>
      </DialogHeader>

      <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <!-- ① 基础信息：正方形头像点击上传 -->
        <section class="grid gap-4 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
          <div class="space-y-1.5">
            <p class="form-label text-sm font-medium">
              头像
            </p>
            <input
              ref="avatarInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleAvatarChange"
            >
            <button
              type="button"
              class="group relative aspect-square w-full overflow-hidden rounded-lg border border-border/70 bg-background/40 transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="avatarUploading || submitting"
              title="点击上传头像"
              @click="openAvatarPicker"
            >
              <img
                v-if="avatarPreviewUrl"
                :src="avatarPreviewUrl"
                alt=""
                class="h-full w-full object-cover"
              >
              <div
                v-else
                class="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-muted-foreground"
              >
                <AppIcon name="image-up" class="h-6 w-6 opacity-70" />
                <span class="text-[11px]">
                  {{ avatarUploading ? '上传中…' : '点击上传' }}
                </span>
              </div>
              <div
                v-if="avatarPreviewUrl && !avatarUploading"
                class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <span class="text-xs text-white">更换</span>
              </div>
              <div
                v-if="avatarUploading"
                class="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white"
              >
                上传中…
              </div>
            </button>
            <button
              v-if="avatarPreviewUrl"
              type="button"
              class="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
              :disabled="avatarUploading || submitting"
              @click="clearAvatar"
            >
              移除头像
            </button>
            <p
              v-if="avatarError"
              class="text-xs text-rose-300"
            >
              {{ avatarError }}
            </p>
          </div>

          <div class="flex min-w-0 flex-col gap-3">
            <label class="block space-y-1.5 text-sm font-medium">
              名称
              <Input
                v-model="form.name"
                placeholder="展示名称"
              />
            </label>
            <label class="flex min-h-0 flex-1 flex-col space-y-1.5 text-sm font-medium">
              简介
              <textarea
                v-model="form.description"
                rows="5"
                class="flex min-h-[7rem] w-full flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="面向访客的简短介绍"
              />
            </label>
          </div>
        </section>

        <section class="space-y-2 border-t border-border/60 pt-4">
          <div class="flex items-center justify-between gap-2">
            <span class="form-label text-sm font-medium">标签</span>
            <Button
              variant="outline"
              type="button"
              size="sm"
              class="h-8"
              :disabled="submitting"
              @click="tagDialogOpen = true"
            >
              选择标签
            </Button>
          </div>
          <div v-if="selectedTagIds.length" class="flex flex-wrap gap-1">
            <span
              v-for="tag in selectedTagChips"
              :key="tag.id"
              class="rounded bg-secondary px-2 py-1 text-xs"
            >
              {{ tag.name }}
            </span>
          </div>
          <p v-else class="text-xs text-muted-foreground">
            可选择或新建导游标签
          </p>
        </section>

        <!-- ② 声音：内置音色优先，样本可多份 -->
        <section class="space-y-3 border-t border-border/60 pt-5">
          <p class="form-label text-sm font-medium">
            声音
          </p>

          <label class="block space-y-1.5 text-sm font-medium">
            音色
            <Select
              :model-value="form.providerVoiceId || ''"
              :disabled="voiceLoading || submitting"
              searchable
              search-placeholder="搜索音色名称"
              empty-text="无匹配音色"
              placeholder="请选择内置音色"
              @update:model-value="form.providerVoiceId = String($event || '')"
              @search="emit('search-voice', $event)"
            >
              <option value="">
                {{ voiceLoading ? '音色加载中…' : '不指定音色' }}
              </option>
              <option
                v-for="voice in voiceSelectOptions"
                :key="String(voice.providerVoiceId || voice.id || voice.voiceName)"
                :value="String(voice.providerVoiceId || '')"
              >
                {{ voiceOptionLabel(voice) }}
              </option>
            </Select>
          </label>
          <p class="text-xs text-muted-foreground">
            优先使用内置音色；若无法满足再上传自定义样本（可多选）。
          </p>

          <div class="space-y-1.5 border-t border-border/40 pt-3">
            <div class="flex items-center justify-between gap-2">
              <span class="form-label text-sm font-medium">自定义声音样本</span>
              <span class="text-[11px] text-muted-foreground">
                可选 · 多选 · 音/视频 · ≤20MB
              </span>
            </div>
            <p class="text-xs text-muted-foreground">
              仅在内置音色不够用时上传；选中视频后会在本机立即抽成音频再提交
            </p>
            <input
              ref="materialInput"
              type="file"
              accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.m4v,.mov,.webm,.avi,.mkv,audio/*,video/*"
              class="hidden"
              multiple
              @change="handleMaterialChange"
            >
            <button
              type="button"
              class="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-primary/35 bg-secondary/20 px-3 py-5 text-center transition hover:border-primary/55 hover:bg-secondary/35 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="submitting || materialConverting"
              @click="openMaterialPicker"
            >
              <AppIcon name="image-up" class="h-5 w-5 text-primary/80" />
              <span class="text-sm font-medium text-foreground">
                {{ materialItems.length ? '继续添加样本' : '点击上传声音样本' }}
              </span>
              <span
                v-if="materialSummary"
                class="form-value max-w-full truncate px-2 text-xs"
              >
                {{ materialSummary }}
              </span>
              <span
                v-else
                class="text-xs text-muted-foreground"
              >
                支持音频与常见视频，单文件不超过 20MB，最多 {{ MAX_VOICE_MATERIAL_COUNT }} 个
              </span>
            </button>

            <ul
              v-if="materialItems.length"
              class="space-y-1.5 rounded-lg border border-border/50 bg-background/30 px-3 py-2"
            >
              <li
                v-for="(item, index) in materialItems"
                :key="item.key"
                class="flex items-center justify-between gap-2 text-xs"
              >
                <span class="min-w-0 truncate text-foreground" :title="item.label">
                  {{ item.label }}
                  <span class="text-muted-foreground">· {{ item.sizeText }}</span>
                  <span
                    v-if="item.status === 'converting'"
                    class="ml-1 text-amber-200/90"
                  >抽取音频中…</span>
                  <span
                    v-else-if="item.status === 'failed'"
                    class="ml-1 text-rose-300"
                  >提取失败</span>
                  <span
                    v-else-if="item.fromVideo"
                    class="ml-1 text-emerald-300/90"
                  >已抽为音频</span>
                </span>
                <button
                  type="button"
                  class="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
                  :disabled="submitting"
                  @click="removeMaterialAt(index)"
                >
                  移除
                </button>
              </li>
            </ul>

            <button
              v-if="materialItems.length"
              type="button"
              class="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
              :disabled="submitting || materialConverting"
              @click="clearMaterials"
            >
              清空全部样本
            </button>
            <p
              v-if="materialError"
              class="text-xs text-rose-300"
            >
              {{ materialError }}
            </p>
          </div>
        </section>
      </div>

      <DialogFooter class="shrink-0 border-t border-border/60 px-5 py-3">
        <Button
          variant="outline"
          type="button"
          :disabled="submitting"
          @click="isOpen = false"
        >
          取消
        </Button>
        <Button
          type="button"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ submitting ? '提交中…' : '保存' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <GuideTagDialog
    v-model:open="tagDialogOpen"
    :model-value="selectedTagIds"
    @update:model-value="handleTagIdsChange"
    @update:tags="handleTagsChange"
  />
</template>
