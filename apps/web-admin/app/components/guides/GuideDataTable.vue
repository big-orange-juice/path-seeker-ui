<script setup lang="ts">
import { computed, h } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import CollectionDataTable from '@/components/collections/CollectionDataTable.vue'
import Button from '@/components/shadcn/button/Button.vue'
import {
  getGuideGenerationStatusMeta,
  type GuideRecord,
} from '@/types/guide'

interface Props {
  rows: GuideRecord[]
  pending?: boolean
  actingIds?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  pending: false,
  actingIds: () => [],
})

const emit = defineEmits<{
  edit: [record: GuideRecord]
  remove: [record: GuideRecord]
}>()

const statusMap: Record<number, { label: string; className: string }> = {
  1: { label: '启用', className: 'bg-emerald-500/10 text-emerald-300' },
  2: { label: '停用', className: 'bg-slate-500/10 text-slate-300' },
}

const voiceStatusMap: Record<number, { label: string; className: string }> = {
  1: { label: '未配置', className: 'bg-slate-500/10 text-slate-300' },
  2: { label: '已就绪', className: 'bg-sky-500/10 text-sky-200' },
  3: { label: '异常', className: 'bg-amber-500/10 text-amber-200' },
}

/** 有 providerVoiceId 即视为音色已就绪 */
const resolveVoiceStatusMeta = (record: GuideRecord) => {
  if (String(record.providerVoiceId || '').trim()) {
    return voiceStatusMap[2]!
  }
  return voiceStatusMap[record.voiceStatus] ?? voiceStatusMap[1]!
}

/**
 * 列表状态合并展示优先级（U-04）：
 * 生成中 > 失败 > 音色异常/未配置 > 启用/停用
 * 标签文字仍用现有「处理中 / 失败 / 未配置 / 启用…」
 */
const resolvePrimaryStatus = (record: GuideRecord) => {
  const generationMeta = getGuideGenerationStatusMeta(record.generationStatus)
  const isProcessing = record.isGenerating || record.generationStatus === 1
  if (isProcessing) {
    const progress =
      record.generationProgress != null ? ` ${record.generationProgress}%` : ''
    return {
      label: `${generationMeta.label}${progress}`,
      className: generationMeta.className,
      detail: record.generationError || '',
    }
  }
  if (record.generationStatus === 3) {
    return {
      label: generationMeta.label,
      className: generationMeta.className,
      detail: record.generationError || '',
    }
  }

  const voiceMeta = resolveVoiceStatusMeta(record)
  if (voiceMeta.label !== '已就绪') {
    return {
      label: voiceMeta.label,
      className: voiceMeta.className,
      detail: '',
    }
  }

  const enableMeta = statusMap[record.status] ?? statusMap[1]!
  return {
    label: enableMeta.label,
    className: enableMeta.className,
    detail: '',
  }
}

const isActing = (id: string) => props.actingIds.includes(id)

const columns = computed<ColumnDef<GuideRecord>[]>(() => [
  {
    accessorKey: 'name',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '导游'),
    cell: ({ row }) => {
      const record = row.original
      return h('div', { class: 'min-w-0 space-y-1' }, [
        h('div', { class: 'flex items-center gap-2' }, [
          record.avatarUrl
            ? h('img', {
                src: record.avatarUrl,
                alt: '',
                class: 'h-8 w-8 shrink-0 rounded-md object-cover',
              })
            : h('div', {
                class: 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary/50 text-[11px] text-muted-foreground',
              }, (record.name || '?').slice(0, 1)),
          h('div', { class: 'min-w-0' }, [
            h('div', { class: 'flex items-center gap-2' }, [
              h('p', { class: 'truncate font-medium text-foreground' }, record.name || '未命名导游'),
              record.isSystemDefault
                ? h('span', { class: 'rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary' }, '默认')
                : null,
            ]),
            h('p', { class: 'truncate text-xs text-muted-foreground' }, record.description || record.guideCode || '—'),
          ]),
        ]),
      ])
    },
  },
  {
    accessorKey: 'ownerAdminName',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '创建人'),
    cell: ({ row }) => h(
      'span',
      {
        class: 'block max-w-32 truncate text-sm text-muted-foreground',
        title: row.original.ownerAdminName || '—',
      },
      row.original.ownerAdminName || '—',
    ),
  },
  {
    id: 'statusSummary',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '状态'),
    cell: ({ row }) => {
      const primary = resolvePrimaryStatus(row.original)
      return h('div', { class: 'space-y-0.5' }, [
        h('span', { class: `inline-flex rounded-full px-2 py-0.5 text-xs ${primary.className}` }, primary.label),
        primary.detail
          ? h('p', {
              class: 'line-clamp-1 text-[11px] text-rose-300/90',
              title: primary.detail,
            }, primary.detail)
          : null,
      ])
    },
  },
  {
    id: 'actions',    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '操作'),
    cell: ({ row }) => {
      const record = row.original
      const acting = isActing(record.id)

      return h('div', { class: 'flex flex-wrap items-center justify-start gap-1.5' }, [
        h(
          Button,
          {
            variant: 'outline',
            size: 'sm',
            disabled: acting,
            onClick: () => emit('edit', record),
          },
          () => '编辑',
        ),
        h(
          Button,
          {
            variant: 'secondary',
            size: 'sm',
            disabled: acting,
            onClick: () => emit('remove', record),
          },
          () => '删除',
        ),
      ])
    },
  },
])
</script>

<template>
  <CollectionDataTable
    :columns="columns"
    :data="rows"
    :pending="pending"
    empty-text="暂无导游数据。"
  />
</template>
