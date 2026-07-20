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
import UiImageUpload from '@/components/ui/ImageUpload.vue'
import type { GuideDraft, TtsVoiceResponse } from '@/types/guide'
import type { UploadAttachment } from '@/types/upload'

/** 音色材料体积上限：20MB */
const MAX_VOICE_MATERIAL_BYTES = 20 * 1024 * 1024

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

const form = reactive<GuideDraft>({ ...props.initialValue })
const avatarPreviewUrls = shallowRef<string[]>([])
const materialInputRef = useTemplateRef<HTMLInputElement>('materialInput')
const txtMaterialInputRef = useTemplateRef<HTMLInputElement>('txtMaterialInput')
const materialError = shallowRef('')
const txtMaterialError = shallowRef('')

/** 音色材料：mp3 / mp4 → multipart `material` */
const isVoiceMaterialFile = (file: File) => {
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  return (
    name.endsWith('.mp3')
    || name.endsWith('.mp4')
    || type === 'audio/mpeg'
    || type === 'audio/mp3'
    || type === 'video/mp4'
  )
}

/** 语义资料：txt → multipart `txtmaterial` */
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

watch(
  () => [props.open, props.initialValue] as const,
  ([open]) => {
    if (!open) {
      return
    }
    Object.assign(form, {
      ...props.initialValue,
      materialFile: null,
      materialFileName: '',
      txtMaterialFile: null,
      txtMaterialFileName: '',
    })
    materialError.value = ''
    txtMaterialError.value = ''
    const preview = String(props.initialValue.avatarPreviewUrl || '').trim()
    avatarPreviewUrls.value = preview ? [preview] : []
  },
  { deep: true },
)

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const title = computed(() => (props.mode === 'edit' ? '编辑导游' : '新增导游'))

const canSubmit = computed(() =>
  Boolean(String(form.name || '').trim()) && !props.submitting,
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
  if (name && id && name !== id) {
    return provider ? `${name}（${id} · ${provider}）` : `${name}（${id}）`
  }
  return name || id || '未命名音色'
}

const handleAvatarUploaded = (files: UploadAttachment[]) => {
  const first = files[0]
  if (!first) {
    return
  }
  form.avatarAttachmentId = first.fileId ? String(first.fileId) : null
  form.avatarPreviewUrl = first.fileUrl ? String(first.fileUrl) : null
  if (first.fileUrl) {
    avatarPreviewUrls.value = [first.fileUrl]
  }
}

const handleAvatarModelUpdate = (urls: string[]) => {
  avatarPreviewUrls.value = urls
  if (!urls.length) {
    form.avatarAttachmentId = null
    form.avatarPreviewUrl = null
  }
}

const openMaterialPicker = () => {
  materialInputRef.value?.click()
}

const openTxtMaterialPicker = () => {
  txtMaterialInputRef.value?.click()
}

const handleMaterialChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  materialError.value = ''

  if (!file) {
    form.materialFile = null
    form.materialFileName = ''
    input.value = ''
    return
  }

  if (!isVoiceMaterialFile(file)) {
    materialError.value = '音色材料仅支持 MP3 / MP4。'
    form.materialFile = null
    form.materialFileName = ''
    input.value = ''
    return
  }

  if (file.size > MAX_VOICE_MATERIAL_BYTES) {
    materialError.value = `音色材料需在 20MB 以内（当前 ${formatFileSize(file.size)}）。`
    form.materialFile = null
    form.materialFileName = ''
    input.value = ''
    return
  }

  form.materialFile = file
  form.materialFileName = file.name
  input.value = ''
}

const handleTxtMaterialChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  txtMaterialError.value = ''

  if (!file) {
    form.txtMaterialFile = null
    form.txtMaterialFileName = ''
    input.value = ''
    return
  }

  if (!isTxtMaterialFile(file)) {
    txtMaterialError.value = '语义资料仅支持 TXT 文本。'
    form.txtMaterialFile = null
    form.txtMaterialFileName = ''
    input.value = ''
    return
  }

  form.txtMaterialFile = file
  form.txtMaterialFileName = file.name
  input.value = ''
}

const clearMaterial = () => {
  form.materialFile = null
  form.materialFileName = ''
  materialError.value = ''
}

const clearTxtMaterial = () => {
  form.txtMaterialFile = null
  form.txtMaterialFileName = ''
  txtMaterialError.value = ''
}

const handleSubmit = () => {
  if (!canSubmit.value) {
    return
  }
  emit('submit', {
    ...form,
    materialFile: form.materialFile ?? null,
    materialFileName: form.materialFileName || '',
    txtMaterialFile: form.txtMaterialFile ?? null,
    txtMaterialFileName: form.txtMaterialFileName || '',
  })
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[90vh] max-w-[min(94vw,42rem)] flex-col overflow-hidden rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="shrink-0 space-y-1 border-b border-border/60 px-5 py-3.5">
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>
          维护基础资料；音色与语义画像通过材料文件异步生成。
        </DialogDescription>
      </DialogHeader>

      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div class="flex flex-col gap-4">
          <!-- 基础信息：头像 + 名称/简介 双栏 -->
          <section class="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <div class="space-y-2">
              <UiImageUpload
                :model-value="avatarPreviewUrls"
                label="头像"
                hint="列表与详情展示"
                button-text="上传头像"
                button-subtext="JPG / PNG"
                :multiple="false"
                upload-target="image"
                @update:model-value="handleAvatarModelUpdate"
                @uploaded="handleAvatarUploaded"
              />
              <p
                v-if="form.avatarAttachmentId && !avatarPreviewUrls.length"
                class="text-xs text-muted-foreground"
              >
                已绑定头像附件
              </p>
            </div>

            <div class="flex min-w-0 flex-col gap-3">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                基础信息
              </p>

              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground">名称</label>
                <Input v-model="form.name" placeholder="展示名称" />
              </div>

              <div class="flex min-h-0 flex-1 flex-col space-y-1.5">
                <label class="text-sm font-medium text-foreground">简介</label>
                <textarea
                  v-model="form.description"
                  rows="5"
                  class="flex min-h-[7.5rem] w-full flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="面向访客的简短介绍"
                />
              </div>
            </div>
          </section>

          <!-- 生成材料：音色 / 语义 双栏 -->
          <section class="space-y-3 border-t border-border/50 pt-4">
            <div class="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  生成材料
                </p>
                <p class="mt-1 text-xs leading-5 text-muted-foreground">
                  可只传其一；音色材料用于声线分析，语义资料用于语料风格与画像。
                </p>
              </div>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <!-- 音色材料 → material -->
              <div class="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/30 p-3">
                <div class="flex items-center justify-between gap-2">
                  <label class="text-sm font-medium text-foreground">音色材料</label>
                  <span class="text-[11px] text-muted-foreground">MP3 / MP4 · ≤20MB</span>
                </div>

                <input
                  ref="materialInput"
                  type="file"
                  accept=".mp3,.mp4,audio/mpeg,audio/mp3,video/mp4"
                  class="hidden"
                  @change="handleMaterialChange"
                >

                <button
                  type="button"
                  class="flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-primary/30 bg-secondary/25 px-3 py-3 text-center transition hover:border-primary/50 hover:bg-secondary/40"
                  @click="openMaterialPicker"
                >
                  <span class="text-sm font-medium text-foreground">
                    {{ form.materialFileName ? '重新选择' : '上传音色材料' }}
                  </span>
                  <span class="text-xs text-muted-foreground">
                    声线分析用 · 不超过 20MB
                  </span>
                </button>

                <div
                  v-if="form.materialFileName"
                  class="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/50 px-2.5 py-1.5"
                >
                  <div class="min-w-0">
                    <p class="truncate text-sm text-foreground">
                      {{ form.materialFileName }}
                    </p>
                    <p
                      v-if="form.materialFile"
                      class="text-[11px] text-muted-foreground"
                    >
                      {{ formatFileSize(form.materialFile.size) }}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" type="button" @click="clearMaterial">
                    移除
                  </Button>
                </div>
                <p v-if="materialError" class="text-xs text-rose-300">
                  {{ materialError }}
                </p>
              </div>

              <!-- 语义资料 → txtmaterial -->
              <div class="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/30 p-3">
                <div class="flex items-center justify-between gap-2">
                  <label class="text-sm font-medium text-foreground">语义资料</label>
                  <span class="text-[11px] text-muted-foreground">TXT</span>
                </div>

                <input
                  ref="txtMaterialInput"
                  type="file"
                  accept=".txt,text/plain"
                  class="hidden"
                  @change="handleTxtMaterialChange"
                >

                <button
                  type="button"
                  class="flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-primary/30 bg-secondary/25 px-3 py-3 text-center transition hover:border-primary/50 hover:bg-secondary/40"
                  @click="openTxtMaterialPicker"
                >
                  <span class="text-sm font-medium text-foreground">
                    {{ form.txtMaterialFileName ? '重新选择' : '上传语义资料' }}
                  </span>
                  <span class="text-xs text-muted-foreground">
                    语料风格与画像生成
                  </span>
                </button>

                <div
                  v-if="form.txtMaterialFileName"
                  class="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/50 px-2.5 py-1.5"
                >
                  <p class="min-w-0 truncate text-sm text-foreground">
                    {{ form.txtMaterialFileName }}
                  </p>
                  <Button variant="ghost" size="sm" type="button" @click="clearTxtMaterial">
                    移除
                  </Button>
                </div>
                <p v-if="txtMaterialError" class="text-xs text-rose-300">
                  {{ txtMaterialError }}
                </p>
              </div>
            </div>

            <!-- 音色仅编辑时配置；新增阶段由材料异步生成 -->
            <div v-if="mode === 'edit'" class="space-y-1.5">
              <label class="text-sm font-medium text-foreground">音色</label>
              <Select
                :model-value="form.providerVoiceId || ''"
                :disabled="voiceLoading"
                searchable
                search-placeholder="搜索音色名称 / ID"
                empty-text="无匹配音色"
                placeholder="请选择音色"
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
            </div>
          </section>
        </div>
      </div>

      <DialogFooter class="shrink-0 border-t border-border/60 px-5 py-3">
        <Button variant="outline" type="button" :disabled="submitting" @click="isOpen = false">
          取消
        </Button>
        <Button type="button" :disabled="!canSubmit" @click="handleSubmit">
          {{ submitting ? '提交中…' : '保存' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
