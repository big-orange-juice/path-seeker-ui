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
import { useUploadAttachment } from '@/composables/useUploadAttachment'
import type { GuideDraft, TtsVoiceResponse } from '@/types/guide'

/** 声音样本体积上限：20MB */
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

const { uploadAttachment } = useUploadAttachment()

const form = reactive<GuideDraft>({ ...props.initialValue })
const avatarPreviewUrl = shallowRef('')
const avatarInputRef = useTemplateRef<HTMLInputElement>('avatarInput')
const materialInputRef = useTemplateRef<HTMLInputElement>('materialInput')
const txtMaterialInputRef = useTemplateRef<HTMLInputElement>('txtMaterialInput')
const avatarUploading = shallowRef(false)
const avatarError = shallowRef('')
const materialError = shallowRef('')
const txtMaterialError = shallowRef('')

/** 声音样本：mp3 / mp4 → multipart `material` */
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

/** 讲解文风示例：txt → multipart `txtmaterial` */
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
  Boolean(String(form.name || '').trim()) && !props.submitting && !avatarUploading.value,
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
    materialError.value = '声音样本仅支持 MP3 / MP4。'
    form.materialFile = null
    form.materialFileName = ''
    input.value = ''
    return
  }

  if (file.size > MAX_VOICE_MATERIAL_BYTES) {
    materialError.value = `声音样本需在 20MB 以内（当前 ${formatFileSize(file.size)}）。`
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
    txtMaterialError.value = '讲解文风示例仅支持 TXT 文本。'
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
              <!-- 已有图时悬停提示更换 -->
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

        <!-- ② 声音：内置音色优先，样本为补充 -->
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
            优先使用内置音色；若无法满足再上传自定义样本。
          </p>

          <div class="space-y-1.5 border-t border-border/40 pt-3">
            <div class="flex items-center justify-between gap-2">
              <span class="form-label text-sm font-medium">自定义声音样本</span>
              <span class="text-[11px] text-muted-foreground">可选 · MP3 / MP4 · ≤20MB</span>
            </div>
            <p class="text-xs text-muted-foreground">
              仅在内置音色不够用时上传，用于生成专属声线
            </p>
            <input
              ref="materialInput"
              type="file"
              accept=".mp3,.mp4,audio/mpeg,audio/mp3,video/mp4"
              class="hidden"
              @change="handleMaterialChange"
            >
            <button
              type="button"
              class="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-primary/35 bg-secondary/20 px-3 py-5 text-center transition hover:border-primary/55 hover:bg-secondary/35 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="submitting"
              @click="openMaterialPicker"
            >
              <AppIcon name="image-up" class="h-5 w-5 text-primary/80" />
              <span class="text-sm font-medium text-foreground">
                {{ form.materialFileName ? '重新选择样本' : '点击上传声音样本' }}
              </span>
              <span
                v-if="form.materialFileName"
                class="form-value max-w-full truncate px-2 text-xs"
              >
                {{ form.materialFileName }}
                <template v-if="form.materialFile">
                  · {{ formatFileSize(form.materialFile.size) }}
                </template>
              </span>
              <span
                v-else
                class="text-xs text-muted-foreground"
              >
                支持 MP3 / MP4，不超过 20MB
              </span>
            </button>
            <button
              v-if="form.materialFileName"
              type="button"
              class="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
              :disabled="submitting"
              @click="clearMaterial"
            >
              移除样本
            </button>
            <p
              v-if="materialError"
              class="text-xs text-rose-300"
            >
              {{ materialError }}
            </p>
          </div>
        </section>

        <!-- ③ 讲解文风：独立分区 -->
        <section class="space-y-2 border-t border-border/60 pt-5">
          <div class="flex items-center justify-between gap-2">
            <span class="form-label text-sm font-medium">讲解文风</span>
            <span class="text-[11px] text-muted-foreground">TXT 文本</span>
          </div>
          <p class="text-xs text-muted-foreground">
            上传文风示例，用于生成语气与用词风格（可选）
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
            class="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-primary/35 bg-secondary/20 px-3 py-5 text-center transition hover:border-primary/55 hover:bg-secondary/35 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="submitting"
            @click="openTxtMaterialPicker"
          >
            <AppIcon name="image-up" class="h-5 w-5 text-primary/80" />
            <span class="text-sm font-medium text-foreground">
              {{ form.txtMaterialFileName ? '重新选择文风示例' : '点击上传文风示例' }}
            </span>
            <span
              v-if="form.txtMaterialFileName"
              class="form-value max-w-full truncate px-2 text-xs"
            >
              {{ form.txtMaterialFileName }}
            </span>
            <span
              v-else
              class="text-xs text-muted-foreground"
            >
              支持 TXT 文本
            </span>
          </button>
          <button
            v-if="form.txtMaterialFileName"
            type="button"
            class="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
            :disabled="submitting"
            @click="clearTxtMaterial"
          >
            移除文风示例
          </button>
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
</template>
