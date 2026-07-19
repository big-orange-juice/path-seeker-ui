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
    })
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

const handleMaterialChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  form.materialFile = file
  form.materialFileName = file?.name || ''
  input.value = ''
}

const clearMaterial = () => {
  form.materialFile = null
  form.materialFileName = ''
}

const handleSubmit = () => {
  if (!canSubmit.value) {
    return
  }
  emit('submit', {
    ...form,
    materialFile: form.materialFile ?? null,
    materialFileName: form.materialFileName || '',
  })
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[min(90vh,40rem)] max-w-[min(92vw,36rem)] flex-col overflow-hidden rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="shrink-0 space-y-1 border-b border-border/60 px-5 py-4">
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>
          维护基础资料；语义画像通过材料文件异步生成。
        </DialogDescription>
      </DialogHeader>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <section class="space-y-3">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            基础信息
          </p>

          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">名称</label>
            <Input v-model="form.name" placeholder="展示名称" />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">简介</label>
            <textarea
              v-model="form.description"
              rows="2"
              class="flex min-h-[4.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="面向访客的简短介绍"
            />
          </div>

          <UiImageUpload
            :model-value="avatarPreviewUrls"
            label="头像"
            hint="上传导游头像，用于列表与详情展示。"
            button-text="上传头像"
            button-subtext="支持 JPG / PNG"
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
        </section>

        <section class="space-y-3 border-t border-border/50 pt-4">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            语义信息
          </p>
          <p class="text-xs leading-5 text-muted-foreground">
            上传文本、音频或视频材料，用于生成音色与语料风格；其余参数使用默认值。
          </p>

          <input
            ref="materialInput"
            type="file"
            accept=".txt,.mp3,.mp4,text/plain,audio/mpeg,video/mp4"
            class="hidden"
            @change="handleMaterialChange"
          >

          <button
            type="button"
            class="flex w-full items-center justify-center gap-3 rounded-xl border border-dashed border-primary/30 bg-secondary/25 px-4 py-4 text-center transition hover:border-primary/50 hover:bg-secondary/40"
            @click="openMaterialPicker"
          >
            <span class="text-sm font-medium text-foreground">
              {{ form.materialFileName ? '重新选择材料' : '上传语义材料' }}
            </span>
            <span class="text-xs text-muted-foreground">
              TXT / MP3 / MP4
            </span>
          </button>

          <div
            v-if="form.materialFileName"
            class="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/40 px-3 py-2"
          >
            <p class="min-w-0 truncate text-sm text-foreground">
              {{ form.materialFileName }}
            </p>
            <Button variant="ghost" size="sm" type="button" @click="clearMaterial">
              移除
            </Button>
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
