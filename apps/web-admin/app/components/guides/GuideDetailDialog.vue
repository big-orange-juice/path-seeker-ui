<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import {
  getGuideGenerationStatusMeta,
  type GuideRecord,
} from '@/types/guide'

interface Props {
  open: boolean
  record: GuideRecord | null
  pending?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  pending: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  edit: [record: GuideRecord]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const statusLabel = computed(() => {
  if (!props.record) {
    return '—'
  }
  return props.record.status === 2 ? '停用' : '启用'
})

const voiceStatusLabel = computed(() => {
  if (!props.record) {
    return '—'
  }
  if (props.record.voiceStatus === 2) {
    return '已就绪'
  }
  if (props.record.voiceStatus === 3) {
    return '异常'
  }
  return '未配置'
})

const generationLabel = computed(() => {
  if (!props.record) {
    return '—'
  }
  return getGuideGenerationStatusMeta(props.record.generationStatus).label
})

const fields = computed(() => {
  const record = props.record
  if (!record) {
    return [] as Array<{ label: string; value: string }>
  }

  return [
    { label: '编码', value: record.guideCode || '—' },
    { label: '名称', value: record.name || '—' },
    { label: '状态', value: statusLabel.value },
    { label: '生成状态', value: generationLabel.value },
    { label: '音色状态', value: voiceStatusLabel.value },
    { label: '音色 ID', value: record.providerVoiceId || '—' },
    { label: '默认导游', value: record.isSystemDefault ? '是' : '否' },
    { label: '更新时间', value: record.updatedAt || '—' },
  ]
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[min(90vh,40rem)] max-w-[min(92vw,36rem)] flex-col overflow-hidden rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="shrink-0 space-y-1 border-b border-border/60 px-5 py-4">
        <DialogTitle>{{ record?.name || '导游详情' }}</DialogTitle>
        <DialogDescription>
          {{ record?.guideCode || '查看导游基础资料与生成状态' }}
        </DialogDescription>
      </DialogHeader>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <p v-if="pending" class="text-sm text-muted-foreground">正在加载详情…</p>
        <template v-else-if="record">
          <div class="grid gap-2 sm:grid-cols-2">
            <div
              v-for="field in fields"
              :key="field.label"
              class="rounded-lg border border-border/50 bg-background/40 px-3 py-2"
            >
              <p class="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{{ field.label }}</p>
              <p class="mt-1 break-all text-sm text-foreground">{{ field.value }}</p>
            </div>
          </div>

          <div v-if="record.description" class="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
            <p class="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">简介</p>
            <p class="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{{ record.description }}</p>
          </div>

          <div v-if="record.semanticProfile" class="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
            <p class="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">语义画像</p>
            <p class="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{{ record.semanticProfile }}</p>
          </div>

          <div
            v-if="record.generationError"
            class="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2"
          >
            <p class="text-[11px] uppercase tracking-[0.1em] text-rose-200/80">生成错误</p>
            <p class="mt-1 whitespace-pre-wrap text-sm leading-6 text-rose-100">{{ record.generationError }}</p>
          </div>

          <div v-if="record.avatarUrl || record.voiceSampleUrl" class="grid gap-3 sm:grid-cols-2">
            <div v-if="record.avatarUrl" class="rounded-lg border border-border/50 bg-background/40 p-3">
              <p class="mb-2 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">头像</p>
              <img :src="record.avatarUrl" alt="" class="max-h-40 rounded-md object-cover">
            </div>
            <div v-if="record.voiceSampleUrl" class="rounded-lg border border-border/50 bg-background/40 p-3">
              <p class="mb-2 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">音色试听</p>
              <audio
                class="w-full"
                controls
                :src="record.voiceSampleUrl"
                preload="metadata"
                controlsList="nodownload"
              >
                当前浏览器不支持音频播放
              </audio>
            </div>
          </div>
        </template>
        <p v-else class="text-sm text-muted-foreground">暂无详情。</p>
      </div>

      <DialogFooter class="shrink-0 border-t border-border/60 px-5 py-3">
        <Button variant="outline" type="button" @click="isOpen = false">
          关闭
        </Button>
        <Button
          v-if="record && !record.isGenerating"
          type="button"
          @click="emit('edit', record)"
        >
          编辑
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
