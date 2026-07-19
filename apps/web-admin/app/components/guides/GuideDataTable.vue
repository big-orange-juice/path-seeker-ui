<script setup lang="ts">
import { computed, h } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import CollectionDataTable from '@/components/collections/CollectionDataTable.vue'
import Button from '@/components/shadcn/button/Button.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
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
  detail: [record: GuideRecord]
  edit: [record: GuideRecord]
  remove: [record: GuideRecord]
  refreshRow: [record: GuideRecord]
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
              record.isGenerating
                ? h('span', {
                    class: 'rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200',
                  }, '生成中')
                : null,
            ]),
            h('p', { class: 'truncate text-xs text-muted-foreground' }, record.description || record.guideCode || '—'),
          ]),
        ]),
      ])
    },
  },
  {
    accessorKey: 'generationStatus',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '生成状态'),
    cell: ({ row }) => {
      const meta = getGuideGenerationStatusMeta(row.original.generationStatus)
      const progress =
        row.original.isGenerating && row.original.generationProgress != null
          ? ` ${row.original.generationProgress}%`
          : ''
      return h('div', { class: 'space-y-0.5' }, [
        h('span', { class: `inline-flex rounded-full px-2 py-0.5 text-xs ${meta.className}` }, `${meta.label}${progress}`),
        row.original.generationError
          ? h('p', {
              class: 'line-clamp-1 text-[11px] text-rose-300/90',
              title: row.original.generationError,
            }, row.original.generationError)
          : null,
      ])
    },
  },
  {
    accessorKey: 'voiceStatus',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '音色状态'),
    cell: ({ row }) => {
      const meta = voiceStatusMap[row.original.voiceStatus] ?? voiceStatusMap[1]!
      return h('span', { class: `inline-flex rounded-full px-2 py-0.5 text-xs ${meta.className}` }, meta.label)
    },
  },
  {
    accessorKey: 'status',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '状态'),
    cell: ({ row }) => {
      const meta = statusMap[row.original.status] ?? statusMap[1]!
      return h('span', { class: `inline-flex rounded-full px-2 py-0.5 text-xs ${meta.className}` }, meta.label)
    },
  },
  {
    id: 'actions',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '操作'),
    cell: ({ row }) => {
      const record = row.original
      const acting = isActing(record.id)

      // 未完成生成：仅刷新（同路线列表）
      if (record.isGenerating) {
        return h('div', { class: 'flex flex-wrap items-center gap-1.5' }, [
          h(
            Button,
            {
              variant: 'ghost',
              size: 'sm',
              class: 'h-7 px-2.5 text-xs',
              disabled: acting,
              onClick: () => emit('refreshRow', record),
            },
            () => [
              h(AppIcon, {
                name: 'refresh-cw',
                class: 'h-3.5 w-3.5',
                strokeWidth: 1.8,
              }),
              h('span', '刷新'),
            ],
          ),
        ])
      }

      return h('div', { class: 'flex flex-wrap items-center gap-1.5' }, [
        h(
          Button,
          {
            variant: 'outline',
            size: 'sm',
            disabled: acting,
            onClick: () => emit('detail', record),
          },
          () => '详情',
        ),
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
