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

const generationMeta = computed(() => {
  if (!props.record) {
    return { label: '—', className: 'bg-slate-500/10 text-slate-300' }
  }
  return getGuideGenerationStatusMeta(props.record.generationStatus)
})

/** 更新时间格式化为 YYYY-MM-DD HH:mm:ss */
const formatUpdatedAt = (value: string | null | undefined) => {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return '—'
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return raw
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(' ')
}

const metaRows = computed(() => {
  const record = props.record
  if (!record) {
    return [] as Array<{ label: string; value: string }>
  }

  return [
    { label: '编码', value: record.guideCode || '—' },
    { label: '状态', value: statusLabel.value },
    { label: '默认导游', value: record.isSystemDefault ? '是' : '否' },
    { label: '生成状态', value: generationMeta.value.label },
    {
      label: '生成进度',
      value: record.generationProgress != null ? `${record.generationProgress}%` : '—',
    },
    { label: '更新时间', value: formatUpdatedAt(record.updatedAt) },
  ]
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[90vh] max-w-[min(96vw,40rem)] flex-col overflow-hidden rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="shrink-0 space-y-1 border-b border-border/60 px-5 py-3.5 pr-12">
        <DialogTitle>{{ record?.name || '导游详情' }}</DialogTitle>
        <DialogDescription>
          查看导游资料与音色试听
        </DialogDescription>
      </DialogHeader>

      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <p v-if="pending" class="text-sm text-muted-foreground">
          正在加载详情…
        </p>
        <template v-else-if="record">
          <div class="space-y-5">
            <!-- 头像 + 名称简介 -->
            <section class="flex gap-4">
              <div class="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-background/40">
                <img
                  v-if="record.avatarUrl"
                  :src="record.avatarUrl"
                  alt=""
                  class="h-full w-full object-cover"
                >
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center text-xs text-muted-foreground"
                >
                  无头像
                </div>
              </div>
              <div class="min-w-0 flex-1 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="form-value text-base font-semibold">
                    {{ record.name || '未命名导游' }}
                  </h3>
                  <span
                    class="inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium"
                    :class="generationMeta.className"
                  >
                    {{ generationMeta.label }}
                  </span>
                </div>
                <p
                  v-if="record.description"
                  class="form-value whitespace-pre-wrap text-sm leading-6 text-foreground/90"
                >
                  {{ record.description }}
                </p>
                <p
                  v-else
                  class="text-sm text-muted-foreground"
                >
                  暂无简介
                </p>
              </div>
            </section>

            <!-- 元信息：label / value 网格 -->
            <section class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div
                v-for="row in metaRows"
                :key="row.label"
                class="min-w-0"
              >
                <p class="field-caption">
                  {{ row.label }}
                </p>
                <p class="form-value mt-0.5 break-all text-sm">
                  {{ row.value }}
                </p>
              </div>
            </section>

            <!-- 音色试听 -->
            <section class="space-y-1.5 border-t border-border/50 pt-4">
              <p class="form-label text-sm font-medium">
                音色试听
              </p>
              <audio
                v-if="record.voiceSampleUrl"
                class="w-full"
                controls
                :src="record.voiceSampleUrl"
                preload="metadata"
                controlsList="nodownload"
              >
                当前浏览器不支持音频播放
              </audio>
              <p
                v-else
                class="text-sm text-muted-foreground"
              >
                暂无试听
              </p>
            </section>

            <section
              v-if="record.generationError"
              class="rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2.5"
            >
              <p class="field-caption text-rose-200/80">
                生成错误
              </p>
              <p class="mt-1 whitespace-pre-wrap text-sm leading-6 text-rose-100">
                {{ record.generationError }}
              </p>
            </section>
          </div>
        </template>
        <p
          v-else
          class="text-sm text-muted-foreground"
        >
          暂无详情。
        </p>
      </div>

      <DialogFooter class="shrink-0 border-t border-border/60 px-5 py-3">
        <Button
          variant="outline"
          type="button"
          @click="isOpen = false"
        >
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
