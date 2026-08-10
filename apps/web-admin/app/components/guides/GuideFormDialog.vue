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
import {
  MAX_VOICE_AUDIO_BYTES,
  MAX_VOICE_VIDEO_BYTES,
  useExtractGuideVoiceMaterial,
} from '@/composables/useExtractGuideVoiceMaterial'
import type { GuideDraft, TtsVoiceResponse } from '@/types/guide'

/** 单次最多上传样本数 */
const MAX_VOICE_MATERIAL_COUNT = 8

type MaterialItemStatus = 'ready' | 'extracting' | 'error'

interface MaterialListItem {
  key: string
  /** 可提交的音频文件；提取中/失败为 null */
  file: File | null
  /** 视频原始文件，便于失败后重试 */
  sourceFile?: File | null
  label: string
  sizeText: string
  status: MaterialItemStatus
  /** 0–100，提取中展示 */
  progress: number
  fromVideo: boolean
  errorMessage?: string
  /** 取消进行中的提取 */
  abort?: AbortController
}

type WorkspaceTab = 'style' | 'edit'

interface Props {
  open: boolean
  mode: 'create' | 'edit'
  initialValue: GuideDraft
  /** 编辑态初始 Tab：风格 / 编辑 */
  initialTab?: WorkspaceTab
  /** 风格说明（只读，不参与提交） */
  styleDescription?: string
  submitting?: boolean
  voiceOptions?: TtsVoiceResponse[]
  voiceLoading?: boolean
  voiceGenerationStatus?: number
  voiceGenerationError?: string | null
  voiceRefreshing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  initialTab: 'edit',
  styleDescription: '',
  submitting: false,
  voiceOptions: () => [],
  voiceLoading: false,
  voiceGenerationStatus: 0,
  voiceGenerationError: null,
  voiceRefreshing: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [draft: GuideDraft]
  /** 音色关键词搜索（远端） */
  'search-voice': [keyword: string]
  refreshVoiceStatus: []
}>()

const { uploadAttachment } = useUploadAttachment()
const { extractVoiceMaterial, resolveExtractErrorMessage } = useExtractGuideVoiceMaterial()

const form = reactive<GuideDraft>({
  ...props.initialValue,
  tagIds: [...(props.initialValue.tagIds ?? [])],
})
const activeTab = shallowRef<WorkspaceTab>('edit')
const avatarPreviewUrl = shallowRef('')
const avatarInputRef = useTemplateRef<HTMLInputElement>('avatarInput')
const materialInputRef = useTemplateRef<HTMLInputElement>('materialInput')
const txtMaterialInputRef = useTemplateRef<HTMLInputElement>('txtMaterialInput')
const avatarUploading = shallowRef(false)
const avatarError = shallowRef('')
const materialError = shallowRef('')
const txtMaterialError = shallowRef('')
const tagDialogOpen = shallowRef(false)
/** 样本列表；视频选中后立即服务端抽音频，仅 ready 的音频进入 form */
const materialItems = shallowRef<MaterialListItem[]>([])

const showWorkspaceTabs = computed(() => props.mode === 'edit')

const styleText = computed(() => String(props.styleDescription || '').trim())

/** 粗判是否为 HTML 富文本，便于只读渲染 */
const styleLooksLikeHtml = computed(() => {
  const text = styleText.value
  if (!text) {
    return false
  }
  return /<\/?[a-z][\s\S]*>/i.test(text)
})

const isVideoVoiceMaterial = (file: File) => {
  const type = String(file.type || '').toLowerCase()
  const name = file.name.toLowerCase()
  return type.startsWith('video/') || /\.(mp4|m4v|mov|webm|avi|mkv|mpeg|mpg)$/.test(name)
}

const isVoiceMaterialFile = (file: File) => {
  const type = String(file.type || '').toLowerCase()
  const name = file.name.toLowerCase()
  return type.startsWith('audio/') || isVideoVoiceMaterial(file) || /\.(mp3|wav|m4a|aac|ogg|flac|mpga)$/.test(name)
}

/** 讲解文风：txt → multipart `txtmaterial` */
const isTxtMaterialFile = (file: File) => {
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  return name.endsWith('.txt') || type === 'text/plain'
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const patchMaterialItem = (key: string, patch: Partial<MaterialListItem>) => {
  materialItems.value = materialItems.value.map((item) =>
    item.key === key ? { ...item, ...patch } : item,
  )
}

const syncMaterialFilesToForm = () => {
  const ready = materialItems.value
    .filter((item) => item.status === 'ready' && item.file)
    .map((item) => item.file!)
  form.materialFiles = ready
  form.materialFile = ready[0] ?? null
  form.materialFileName = ready[0]?.name || ''
}

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
  const extracting = items.filter((item) => item.status === 'extracting').length
  if (extracting) {
    return `提取中 ${extracting} 个…`
  }
  if (items.length === 1) {
    return items[0]?.label || '1 个样本'
  }
  return `已选 ${items.length} 个样本`
})

const hasMaterialExtracting = computed(() =>
  materialItems.value.some((item) => item.status === 'extracting'),
)

const hasMaterialError = computed(() =>
  materialItems.value.some((item) => item.status === 'error'),
)

const abortAllExtractions = () => {
  for (const item of materialItems.value) {
    item.abort?.abort()
  }
}

watch(
  () => [props.open, props.initialValue, props.initialTab, props.mode] as const,
  ([open]) => {
    if (!open) {
      abortAllExtractions()
      return
    }
    abortAllExtractions()
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
    txtMaterialError.value = ''
    avatarError.value = ''
    avatarUploading.value = false
    avatarPreviewUrl.value = String(props.initialValue.avatarPreviewUrl || '').trim()
    activeTab.value = props.mode === 'edit' && props.initialTab === 'style'
      ? 'style'
      : 'edit'
  },
  { deep: true },
)

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const title = computed(() => {
  if (props.mode === 'create') {
    return '新增导游'
  }
  return String(props.initialValue.name || '').trim() || '编辑导游'
})

const descriptionText = computed(() => {
  if (props.mode === 'create') {
    return '维护基础资料。可选择内置音色、声音样本与讲解文风示例。'
  }
  return '查看讲解风格，或维护基础资料、音色与文风。'
})

const voiceGenerationMeta = computed(() => {
  if (props.voiceGenerationStatus === 1) {
    return { text: '音色生成中，稍后可刷新状态。', className: 'text-sky-200' }
  }
  if (props.voiceGenerationStatus === 3) {
    return {
      text: props.voiceGenerationError || '音色生成失败，请检查样本后重试。',
      className: 'text-rose-300',
    }
  }
  return null
})

const canSubmit = computed(() =>
  Boolean(String(form.name || '').trim())
  && !props.submitting
  && !avatarUploading.value
  && !hasMaterialExtracting.value
  && !hasMaterialError.value
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
  if (props.submitting || hasMaterialExtracting.value) {
    return
  }
  materialInputRef.value?.click()
}

const startVideoExtraction = async (key: string, source: File) => {
  const controller = new AbortController()
  patchMaterialItem(key, {
    status: 'extracting',
    progress: 4,
    file: null,
    abort: controller,
    errorMessage: undefined,
  })
  syncMaterialFilesToForm()

  try {
    const result = await extractVoiceMaterial(source, {
      signal: controller.signal,
      onProgress: (percent) => {
        patchMaterialItem(key, { progress: percent, status: 'extracting' })
      },
    })
    patchMaterialItem(key, {
      status: 'ready',
      progress: 100,
      file: result.file,
      label: result.file.name,
      sizeText: formatFileSize(result.file.size),
      fromVideo: true,
      abort: undefined,
      errorMessage: undefined,
    })
    syncMaterialFilesToForm()
    materialError.value = ''
  } catch (error) {
    if (controller.signal.aborted) {
      return
    }
    const message = resolveExtractErrorMessage(error)
    patchMaterialItem(key, {
      status: 'error',
      progress: 0,
      file: null,
      abort: undefined,
      errorMessage: message,
    })
    syncMaterialFilesToForm()
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
  const videosToExtract: Array<{ key: string, file: File }> = []

  for (const file of picked) {
    if (next.length >= MAX_VOICE_MATERIAL_COUNT) {
      errors.push(`最多上传 ${MAX_VOICE_MATERIAL_COUNT} 个声音样本。`)
      break
    }
    if (!isVoiceMaterialFile(file)) {
      errors.push(`「${file.name}」格式不支持，请上传音频或常见视频。`)
      continue
    }

    const fromVideo = isVideoVoiceMaterial(file)
    const maxBytes = fromVideo ? MAX_VOICE_VIDEO_BYTES : MAX_VOICE_AUDIO_BYTES
    const maxLabel = fromVideo ? '400MB' : '20MB'
    if (file.size > maxBytes) {
      errors.push(`「${file.name}」超过 ${maxLabel}（${formatFileSize(file.size)}）。`)
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

    if (fromVideo) {
      next.push({
        key,
        file: null,
        sourceFile: file,
        label: file.name,
        sizeText: formatFileSize(file.size),
        status: 'extracting',
        progress: 2,
        fromVideo: true,
      })
      videosToExtract.push({ key, file })
    } else {
      next.push({
        key,
        file,
        sourceFile: null,
        label: file.name,
        sizeText: formatFileSize(file.size),
        status: 'ready',
        progress: 100,
        fromVideo: false,
      })
    }
  }

  materialItems.value = next
  syncMaterialFilesToForm()

  if (errors.length) {
    materialError.value = errors[0] || ''
  }

  for (const item of videosToExtract) {
    void startVideoExtraction(item.key, item.file)
  }
}

const removeMaterialAt = (index: number) => {
  const target = materialItems.value[index]
  target?.abort?.abort()
  materialItems.value = materialItems.value.filter((_, i) => i !== index)
  syncMaterialFilesToForm()
  materialError.value = hasMaterialError.value
    ? (materialItems.value.find((item) => item.status === 'error')?.errorMessage || materialError.value)
    : ''
}

const clearMaterials = () => {
  abortAllExtractions()
  materialItems.value = []
  syncMaterialFilesToForm()
  materialError.value = ''
}

const retryMaterialAt = (index: number) => {
  const item = materialItems.value[index]
  if (!item || item.status !== 'error' || !item.fromVideo || !item.sourceFile) {
    materialError.value = '请重新选择该视频以再次提取。'
    removeMaterialAt(index)
    openMaterialPicker()
    return
  }
  materialError.value = ''
  void startVideoExtraction(item.key, item.sourceFile)
}

const openTxtMaterialPicker = () => {
  if (props.submitting) {
    return
  }
  txtMaterialInputRef.value?.click()
}

const handleTxtMaterialChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  txtMaterialError.value = ''
  input.value = ''

  if (!file) {
    form.txtMaterialFile = null
    form.txtMaterialFileName = ''
    return
  }

  if (!isTxtMaterialFile(file)) {
    txtMaterialError.value = '讲解文风仅支持 TXT 文本。'
    form.txtMaterialFile = null
    form.txtMaterialFileName = ''
    return
  }

  form.txtMaterialFile = file
  form.txtMaterialFileName = file.name
}

const clearTxtMaterial = () => {
  form.txtMaterialFile = null
  form.txtMaterialFileName = ''
  txtMaterialError.value = ''
}

const handleSubmit = () => {
  if (!canSubmit.value) {
    if (hasMaterialExtracting.value) {
      materialError.value = '声音样本仍在提取，请完成后再保存。'
    } else if (hasMaterialError.value) {
      materialError.value = '存在提取失败的样本，请移除或重新上传后再保存。'
    }
    return
  }
  const files = form.materialFiles || []
  emit('submit', {
    ...form,
    tagIds: [...selectedTagIds.value],
    materialFile: files[0] ?? null,
    materialFileName: files[0]?.name || '',
    materialFiles: files,
    txtMaterialFile: form.txtMaterialFile ?? null,
    txtMaterialFileName: form.txtMaterialFileName || '',
  })
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[90vh] max-w-[min(94vw,40rem)] flex-col overflow-hidden rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="shrink-0 space-y-1 border-b border-border/60 px-5 py-3.5 pr-12">
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>
          {{ descriptionText }}
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="showWorkspaceTabs"
        class="flex shrink-0 border-b border-border/70 px-5 pt-2"
      >
        <button
          type="button"
          class="inline-flex h-9 items-center border-b-2 px-4 text-sm font-medium transition-colors"
          :class="activeTab === 'edit' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'edit'"
        >
          编辑
        </button>
        <button
          type="button"
          class="inline-flex h-9 items-center border-b-2 px-4 text-sm font-medium transition-colors"
          :class="activeTab === 'style' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'style'"
        >
          风格
        </button>
      </div>

      <!-- 风格：只读展示 styleDescription -->
      <div
        v-show="showWorkspaceTabs && activeTab === 'style'"
        class="min-h-0 flex-1 overflow-y-auto px-5 py-4"
      >
        <p
          v-if="!styleText"
          class="text-sm text-muted-foreground"
        >
          暂无讲解风格说明。
        </p>
        <div
          v-else-if="styleLooksLikeHtml"
          class="guide-style-html rounded-md border border-border/40 bg-[#101216] px-3 py-3 text-sm leading-6 text-foreground/90"
          v-html="styleText"
        />
        <div
          v-else
          class="guide-style-md rounded-md border border-border/40 bg-[#101216] px-3 py-3 text-sm leading-6 text-foreground/90"
        >
          <Comark :markdown="styleText" />
        </div>
      </div>

      <div
        v-show="!showWorkspaceTabs || activeTab === 'edit'"
        class="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4"
      >
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
          <div class="flex items-center justify-between gap-3">
            <p class="form-label text-sm font-medium">
              声音
            </p>
            <Button
              v-if="mode === 'edit'"
              variant="ghost"
              type="button"
              size="sm"
              class="h-7 px-2 text-xs"
              :disabled="submitting || voiceRefreshing"
              @click="emit('refreshVoiceStatus')"
            >
              <AppIcon name="refresh-cw" class="h-3.5 w-3.5" />
              {{ voiceRefreshing ? '刷新中…' : '刷新音色状态' }}
            </Button>
          </div>
          <p
            v-if="voiceGenerationMeta"
            class="text-xs"
            :class="voiceGenerationMeta.className"
          >
            {{ voiceGenerationMeta.text }}
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

          <div
            v-if="mode === 'edit' && form.voiceSampleUrl"
            class="space-y-1.5 rounded-lg border border-border/60 bg-secondary/15 px-3 py-2.5"
          >
            <p class="form-label text-sm font-medium">
              试听音色
            </p>
            <audio
              class="h-9 w-full"
              controls
              controlsList="nodownload"
              preload="metadata"
              :src="form.voiceSampleUrl"
            >
              当前浏览器不支持音频播放
            </audio>
          </div>

          <div class="space-y-1.5 border-t border-border/40 pt-3">
            <div class="flex items-center justify-between gap-2">
              <span class="form-label text-sm font-medium">自定义声音样本</span>
              <span class="text-[11px] text-muted-foreground">
                可选 · 音频≤20MB · 视频≤400MB
              </span>
            </div>
            <p class="text-xs text-muted-foreground">
              仅在内置音色不够用时上传；选择视频后会立即提取音频，成功后才能保存
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
              :disabled="submitting || hasMaterialExtracting"
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
                音频≤20MB，视频≤400MB，最多 {{ MAX_VOICE_MATERIAL_COUNT }} 个
              </span>
            </button>

            <ul
              v-if="materialItems.length"
              class="space-y-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2"
            >
              <li
                v-for="(item, index) in materialItems"
                :key="item.key"
                class="space-y-1.5 text-xs"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="min-w-0 truncate text-foreground" :title="item.label">
                    {{ item.label }}
                    <span class="text-muted-foreground">· {{ item.sizeText }}</span>
                    <span
                      v-if="item.fromVideo && item.status === 'ready'"
                      class="ml-1 text-emerald-300/90"
                    >已提取音频</span>
                    <span
                      v-else-if="item.fromVideo && item.status === 'extracting'"
                      class="ml-1 text-sky-300/90"
                    >提取中</span>
                    <span
                      v-else-if="item.status === 'error'"
                      class="ml-1 text-rose-300"
                    >提取失败</span>
                  </span>
                  <button
                    type="button"
                    class="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
                    :disabled="submitting"
                    @click="removeMaterialAt(index)"
                  >
                    移除
                  </button>
                </div>

                <div
                  v-if="item.status === 'extracting'"
                  class="space-y-1"
                >
                  <div class="h-1.5 overflow-hidden rounded-full bg-secondary/60">
                    <div
                      class="h-full rounded-full bg-sky-400/90 transition-[width] duration-200 ease-out"
                      :style="{ width: `${Math.min(100, Math.max(2, item.progress))}%` }"
                    />
                  </div>
                  <p class="text-[11px] text-sky-200/90">
                    {{ item.progress < 80 ? `上传中 ${item.progress}%` : `服务端提取中 ${item.progress}%` }}
                  </p>
                </div>

                <p
                  v-if="item.status === 'error' && item.errorMessage"
                  class="text-[11px] text-rose-300"
                >
                  {{ item.errorMessage }}
                  <button
                    type="button"
                    class="ml-1 underline underline-offset-2 hover:text-rose-200"
                    :disabled="submitting"
                    @click="retryMaterialAt(index)"
                  >
                    重新选择
                  </button>
                </p>
              </li>
            </ul>

            <button
              v-if="materialItems.length"
              type="button"
              class="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
              :disabled="submitting"
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

        <!-- ③ 讲解文风：可选 txt，提交 multipart `txtmaterial` -->
        <section class="space-y-2 border-t border-border/60 pt-4">
          <div class="flex items-center justify-between gap-2">
            <span class="form-label text-sm font-medium">讲解文风</span>
            <span class="text-[11px] text-muted-foreground">可选 · TXT</span>
          </div>
          <p class="text-xs text-muted-foreground">
            上传文风示例，用于生成语气与用词风格
          </p>
          <input
            ref="txtMaterialInput"
            type="file"
            accept=".txt,text/plain"
            class="hidden"
            @change="handleTxtMaterialChange"
          >
          <button
            type="button"
            class="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-primary/35 bg-secondary/20 px-3 py-4 text-center transition hover:border-primary/55 hover:bg-secondary/35 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="submitting"
            @click="openTxtMaterialPicker"
          >
            <AppIcon name="image-up" class="h-5 w-5 text-primary/80" />
            <span class="text-sm font-medium text-foreground">
              {{ form.txtMaterialFileName ? '重新选择文风示例' : '点击上传文风示例' }}
            </span>
            <span class="text-xs text-muted-foreground">
              仅支持 TXT
            </span>
          </button>
          <div
            v-if="form.txtMaterialFileName"
            class="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2"
          >
            <p class="min-w-0 truncate text-sm text-foreground" :title="form.txtMaterialFileName">
              {{ form.txtMaterialFileName }}
            </p>
            <button
              type="button"
              class="shrink-0 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
              :disabled="submitting"
              @click="clearTxtMaterial"
            >
              移除
            </button>
          </div>
          <p
            v-if="txtMaterialError"
            class="text-xs text-rose-300"
          >
            {{ txtMaterialError }}
          </p>
        </section>
      </div>

      <DialogFooter class="shrink-0 border-t border-border/60 px-5 py-3">
        <Button
          variant="outline"
          type="button"
          :disabled="submitting"
          @click="isOpen = false"
        >
          {{ showWorkspaceTabs && activeTab === 'style' ? '关闭' : '取消' }}
        </Button>
        <Button
          v-if="!showWorkspaceTabs || activeTab === 'edit'"
          type="button"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ submitting ? '提交中…' : hasMaterialExtracting ? '提取中…' : '保存' }}
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

<style scoped>
.guide-style-md :deep(:first-child),
.guide-style-html :deep(:first-child) {
  margin-top: 0;
}

.guide-style-md :deep(:last-child),
.guide-style-html :deep(:last-child) {
  margin-bottom: 0;
}

.guide-style-md :deep(p),
.guide-style-html :deep(p) {
  margin: 0.4em 0;
}

.guide-style-md :deep(h1),
.guide-style-md :deep(h2),
.guide-style-md :deep(h3),
.guide-style-md :deep(h4),
.guide-style-html :deep(h1),
.guide-style-html :deep(h2),
.guide-style-html :deep(h3),
.guide-style-html :deep(h4) {
  margin: 0.75em 0 0.35em;
  font-weight: 600;
  line-height: 1.35;
  color: hsl(var(--foreground));
}

.guide-style-md :deep(ul),
.guide-style-md :deep(ol),
.guide-style-html :deep(ul),
.guide-style-html :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.2rem;
}

.guide-style-md :deep(ul),
.guide-style-html :deep(ul) {
  list-style: disc;
}

.guide-style-md :deep(ol),
.guide-style-html :deep(ol) {
  list-style: decimal;
}

.guide-style-md :deep(li),
.guide-style-html :deep(li) {
  margin: 0.15em 0;
}

.guide-style-md :deep(blockquote),
.guide-style-html :deep(blockquote) {
  margin: 0.5em 0;
  border-left: 2px solid rgba(209, 178, 111, 0.35);
  padding-left: 0.7rem;
  color: hsl(var(--muted-foreground));
}

.guide-style-md :deep(a),
.guide-style-html :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
}

.guide-style-md :deep(code),
.guide-style-html :deep(code) {
  border-radius: 0.3rem;
  background: rgba(209, 178, 111, 0.1);
  padding: 0.08em 0.32em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.86em;
  color: #f0e2bc;
}

.guide-style-md :deep(pre),
.guide-style-html :deep(pre) {
  margin: 0.55em 0;
  overflow-x: auto;
  border-radius: 0.5rem;
  border: 1px solid rgba(209, 178, 111, 0.12);
  background: rgba(8, 9, 11, 0.72);
  padding: 0.6rem 0.7rem;
}

.guide-style-md :deep(pre code),
.guide-style-html :deep(pre code) {
  display: block;
  padding: 0;
  background: transparent;
  font-size: 0.8em;
  line-height: 1.55;
  white-space: pre;
}

.guide-style-md :deep(strong),
.guide-style-html :deep(strong) {
  font-weight: 600;
  color: #f4e7c4;
}
</style>
