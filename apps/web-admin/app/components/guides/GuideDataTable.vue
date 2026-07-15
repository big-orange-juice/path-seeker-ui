<script setup lang="ts">
import { computed, h } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import CollectionDataTable from '@/components/collections/CollectionDataTable.vue'
import Button from '@/components/shadcn/button/Button.vue'
import type { GuideRecord } from '@/types/guide'

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
          h('p', { class: 'truncate font-medium text-foreground' }, record.name || '未命名导游'),
          record.isSystemDefault
            ? h('span', { class: 'rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary' }, '默认')
            : null,
        ]),
        h('p', { class: 'text-xs text-muted-foreground' }, record.guideCode || 'NO-CODE'),
      ])
    },
  },
  {
    accessorKey: 'voiceStyle',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '音色风格'),
    cell: ({ row }) =>
      h('span', { class: 'text-sm text-muted-foreground' }, row.original.voiceStyle || row.original.narrationStyle || '未设置'),
  },
  {
    accessorKey: 'voiceLanguage',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '语言'),
    cell: ({ row }) =>
      h('span', { class: 'text-sm text-muted-foreground' }, row.original.voiceLanguage || '—'),
  },
  {
    accessorKey: 'voiceStatus',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '音色状态'),
    cell: ({ row }) => {
      const meta = voiceStatusMap[row.original.voiceStatus] || voiceStatusMap[1]
      return h('span', { class: `inline-flex rounded-full px-2 py-0.5 text-xs ${meta.className}` }, meta.label)
    },
  },
  {
    accessorKey: 'status',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '状态'),
    cell: ({ row }) => {
      const meta = statusMap[row.original.status] || statusMap[1]
      return h('span', { class: `inline-flex rounded-full px-2 py-0.5 text-xs ${meta.className}` }, meta.label)
    },
  },
  {
    accessorKey: 'sortOrder',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '排序'),
    cell: ({ row }) =>
      h('span', { class: 'text-sm text-muted-foreground' }, String(row.original.sortOrder ?? 0)),
  },
  {
    id: 'actions',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '操作'),
    cell: ({ row }) => {
      const record = row.original
      const acting = isActing(record.id)
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
