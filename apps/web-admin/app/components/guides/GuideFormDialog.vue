<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import Input from '@/components/shadcn/input/Input.vue'
import Select from '@/components/shadcn/select/Select.vue'
import {
  GUIDE_FORM_STATUS_OPTIONS,
  GUIDE_FORM_VOICE_STATUS_OPTIONS,
  type GuideDraft,
} from '@/types/guide'

interface Props {
  open: boolean
  mode: 'create' | 'edit'
  initialValue: GuideDraft
  submitting?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  submitting: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [draft: GuideDraft]
}>()

const form = reactive<GuideDraft>({ ...props.initialValue })

watch(
  () => [props.open, props.initialValue] as const,
  ([open]) => {
    if (!open) {
      return
    }
    Object.assign(form, props.initialValue)
  },
  { deep: true },
)

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const title = computed(() => (props.mode === 'edit' ? '编辑导游' : '新增导游'))

const canSubmit = computed(() =>
  Boolean(String(form.guideCode || '').trim() && String(form.name || '').trim()),
)

const handleSubmit = () => {
  if (!canSubmit.value || props.submitting) {
    return
  }
  emit('submit', { ...form })
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[min(90vh,44rem)] max-w-[min(92vw,40rem)] flex-col overflow-hidden rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="shrink-0 space-y-1 border-b border-border/60 px-5 py-4">
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>
          维护导游基础资料、音色参数与启用状态。
        </DialogDescription>
      </DialogHeader>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">导游编码</label>
            <Input v-model="form.guideCode" placeholder="唯一编码" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">名称</label>
            <Input v-model="form.name" placeholder="展示名称" />
          </div>
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

        <div class="space-y-1.5">
          <label class="text-sm font-medium text-foreground">语义画像</label>
          <textarea
            v-model="form.semanticProfile"
            rows="3"
            class="flex min-h-[5.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="人设、语气、知识边界等（供生成解说使用）"
          />
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">解说风格</label>
            <Input v-model="form.narrationStyle" placeholder="如：沉稳讲解 / 亲子互动" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">音色风格</label>
            <Input v-model="form.voiceStyle" placeholder="如：温和女声" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">语音提供商</label>
            <Input v-model="form.voiceProvider" placeholder="提供商标识" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">提供商音色 ID</label>
            <Input v-model="form.providerVoiceId" placeholder="providerVoiceId" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">模型</label>
            <Input v-model="form.providerModel" placeholder="可选模型名" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">语言</label>
            <Input v-model="form.voiceLanguage" placeholder="zh-CN" />
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">语速</label>
            <Input v-model.number="form.speechRate" type="number" step="0.1" min="0.5" max="2" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">音量</label>
            <Input v-model.number="form.volume" type="number" step="0.1" min="0" max="2" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">音调</label>
            <Input v-model.number="form.pitch" type="number" step="0.1" min="0.5" max="2" />
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">头像附件 ID</label>
            <Input
              :model-value="form.avatarAttachmentId ?? ''"
              placeholder="可选"
              @update:model-value="form.avatarAttachmentId = String($event || '').trim() || null"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">试听附件 ID</label>
            <Input
              :model-value="form.voiceSampleAttachmentId ?? ''"
              placeholder="可选"
              @update:model-value="form.voiceSampleAttachmentId = String($event || '').trim() || null"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">音色状态</label>
            <Select :model-value="String(form.voiceStatus)" @update:model-value="form.voiceStatus = Number($event)">
              <option
                v-for="option in GUIDE_FORM_VOICE_STATUS_OPTIONS"
                :key="option.value"
                :value="String(option.value)"
              >
                {{ option.label }}
              </option>
            </Select>
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">启用状态</label>
            <Select :model-value="String(form.status)" @update:model-value="form.status = Number($event)">
              <option
                v-for="option in GUIDE_FORM_STATUS_OPTIONS"
                :key="option.value"
                :value="String(option.value)"
              >
                {{ option.label }}
              </option>
            </Select>
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-foreground">排序</label>
            <Input v-model.number="form.sortOrder" type="number" step="1" />
          </div>
          <div class="flex items-end pb-1">
            <label class="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-border"
                :checked="Boolean(form.isSystemDefault)"
                @change="form.isSystemDefault = ($event.target as HTMLInputElement).checked ? 1 : 0"
              >
              系统默认导游
            </label>
          </div>
        </div>
      </div>

      <DialogFooter class="shrink-0 border-t border-border/60 px-5 py-3">
        <Button variant="outline" type="button" :disabled="submitting" @click="isOpen = false">
          取消
        </Button>
        <Button type="button" :disabled="!canSubmit || submitting" @click="handleSubmit">
          {{ submitting ? '保存中…' : '保存' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
