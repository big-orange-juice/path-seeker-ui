<script setup lang="ts">
import { computed, h } from 'vue';
import type { ColumnDef, SortingState } from '@tanstack/vue-table';
import CollectionDataTable from '@/components/collections/CollectionDataTable.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { RouteRecord } from '@/types/route';

interface Props {
  rows: RouteRecord[];
  pending?: boolean;
  sorting?: SortingState;
}

const props = withDefaults(defineProps<Props>(), {
  pending: false,
  sorting: () => [],
});

const emit = defineEmits<{
  sort: [columnId: string];
}>();

const ageGroupMap: Record<number, string> = {
  0: '通用',
  1: '4-6 岁',
  2: '6-10 岁',
  3: '10-15 岁',
  4: '15 岁以上',
};

const difficultyMap: Record<number, string> = {
  1: '简单',
  2: '普通',
  3: '困难',
};

const publishStatusMap: Record<number, { label: string; className: string }> = {
  1: { label: '草稿', className: 'bg-slate-500/10 text-slate-300' },
  2: { label: '已发布', className: 'bg-emerald-500/10 text-emerald-300' },
  3: { label: '已下线', className: 'bg-amber-500/10 text-amber-300' },
};

const auditStatusMap: Record<number, { label: string; className: string }> = {
  0: { label: '草稿', className: 'bg-slate-500/10 text-slate-300' },
  1: { label: '待审核', className: 'bg-amber-500/10 text-amber-300' },
  2: { label: '已通过', className: 'bg-emerald-500/10 text-emerald-300' },
  3: { label: '已驳回', className: 'bg-rose-500/10 text-rose-300' },
};

const getSortIconName = (columnId: string) => {
  const active = props.sorting.find((item) => item.id === columnId);
  if (!active) {
    return 'arrow-up-down' as const;
  }

  return active.desc ? 'arrow-down' as const : 'arrow-up' as const;
};

const renderHeader = (label: string, columnId: string) => () =>
  h(
    'button',
    {
      type: 'button',
      class: 'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground',
      onClick: () => emit('sort', columnId),
      title: label + '排序',
    },
    [
      h('span', label),
      h(AppIcon, {
        name: getSortIconName(columnId),
        class: 'h-3.5 w-3.5 text-muted-foreground/80',
        strokeWidth: 1.8,
      }),
    ]
  );

const columns = computed<ColumnDef<RouteRecord>[]>(() => [
  {
    accessorKey: 'title',
    header: renderHeader('路线', 'title'),
    cell: ({ row }) => {
      const record = row.original;
      return h('div', { class: 'min-w-0 space-y-1' }, [
        h('div', { class: 'flex items-center gap-2' }, [
          h('p', { class: 'truncate font-medium text-foreground' }, record.title || '未命名路线'),
          h(
            'span',
            {
              class: `${publishStatusMap[record.publishStatus]?.className || 'bg-secondary text-muted-foreground'} rounded-full px-2 py-0.5 text-[11px]`,
            },
            publishStatusMap[record.publishStatus]?.label || '未知状态'
          ),
        ]),
        h('p', { class: 'text-xs text-muted-foreground' }, record.routeCode || 'NO-CODE'),
      ]);
    },
  },
  {
    accessorKey: 'theme',
    header: renderHeader('主题', 'theme'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, row.original.theme || '未设置'),
  },
  {
    accessorKey: 'ageGroup',
    header: renderHeader('年龄', 'ageGroup'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, ageGroupMap[row.original.ageGroup] || '未设置'),
  },
  {
    accessorKey: 'difficultyLevel',
    header: renderHeader('难度', 'difficultyLevel'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, difficultyMap[row.original.difficultyLevel] || '未设置'),
  },
  {
    accessorKey: 'puzzleCount',
    header: renderHeader('谜题数', 'puzzleCount'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, String(row.original.puzzleCount)),
  },
  {
    accessorKey: 'estimatedMinutes',
    header: renderHeader('时长', 'estimatedMinutes'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, row.original.estimatedMinutes === null ? '未设置' : `${row.original.estimatedMinutes} 分钟`),
  },
  {
    accessorKey: 'auditStatus',
    header: renderHeader('审核', 'auditStatus'),
    cell: ({ row }) =>
      h(
        'span',
        {
          class: `inline-flex rounded-full px-2 py-0.5 text-[11px] ${auditStatusMap[row.original.auditStatus]?.className || 'bg-secondary text-muted-foreground'}`,
        },
        auditStatusMap[row.original.auditStatus]?.label || '未知状态'
      ),
  },
  {
    accessorKey: 'sortOrder',
    header: renderHeader('排序', 'sortOrder'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, String(row.original.sortOrder)),
  },
]);
</script>

<template>
  <CollectionDataTable
    :columns="columns"
    :data="props.rows"
    :sorting="props.sorting"
    :pending="props.pending"
    empty-text="当前筛选条件下没有主题路线数据。" />
</template>
