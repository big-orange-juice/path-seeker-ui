<script setup lang="ts">
import { computed, h } from 'vue';
import type { ColumnDef, SortingState } from '@tanstack/vue-table';
import CollectionDataTable from '@/components/collections/CollectionDataTable.vue';
import Button from '@/components/shadcn/button/Button.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { RouteRecord } from '@/types/route';

interface Props {
  rows: RouteRecord[];
  pending?: boolean;
  sorting?: SortingState;
  actingIds?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  pending: false,
  sorting: () => [],
  actingIds: () => [],
});

const emit = defineEmits<{
  sort: [columnId: string];
  detail: [record: RouteRecord];
  publish: [record: RouteRecord];
  refreshRow: [record: RouteRecord];
  remove: [record: RouteRecord];
}>();

const difficultyMap: Record<number, string> = {
  1: '简单',
  2: '普通',
  3: '困难',
};

const publishStatusMap: Record<number, { label: string; className: string }> = {
  1: { label: '未发布', className: 'bg-slate-500/10 text-slate-300' },
  2: { label: '已发布', className: 'bg-emerald-500/10 text-emerald-300' },
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
      title: `${label}排序`,
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

const isRecordActing = (recordId: string) => props.actingIds.includes(recordId);

const columns = computed<ColumnDef<RouteRecord>[]>(() => [
  {
    accessorKey: 'title',
    header: renderHeader('路线', 'title'),
    cell: ({ row }) => {
      const record = row.original;
      return h('div', { class: 'min-w-0 space-y-1' }, [
        h('div', { class: 'flex items-center gap-2' }, [
          h('p', { class: 'truncate font-medium text-foreground' }, record.title || '未命名路线'),
          record.isGenerating
            ? h(
                'span',
                {
                  class: 'rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200',
                },
                '生成中'
              )
            : null,
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
    accessorKey: 'publishStatus',
    header: renderHeader('状态', 'publishStatus'),
    cell: ({ row }) =>
      h(
        'span',
        {
          class: `inline-flex rounded-full px-2 py-0.5 text-[11px] ${publishStatusMap[row.original.publishStatus]?.className || 'bg-secondary text-muted-foreground'}`,
        },
        publishStatusMap[row.original.publishStatus]?.label || '未知状态'
      ),
  },
  {
    accessorKey: 'sortOrder',
    header: renderHeader('排序', 'sortOrder'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, String(row.original.sortOrder)),
  },
  {
    id: 'actions',
    header: () => h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '操作'),
    cell: ({ row }) => {
      const record = row.original;
      const acting = isRecordActing(record.id);
      const actions = [];

      if (record.isGenerating) {
        actions.push(
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
            ]
          )
        );

        return h('div', { class: 'flex flex-wrap justify-end gap-1.5' }, actions);
      }

      if (record.publishStatus === 1) {
        actions.push(
          h(
            Button,
            {
              size: 'sm',
              class: 'h-7 px-2.5 text-xs',
              disabled: acting,
              onClick: () => emit('publish', record),
            },
            () => '发布'
          )
        );
      }

      actions.push(
        h(
          Button,
          {
            variant: 'ghost',
            size: 'sm',
            class: 'h-7 px-2.5 text-xs',
            disabled: acting,
            onClick: () => emit('detail', record),
          },
          () => '查看详情'
        ),
        h(
          Button,
          {
            variant: 'ghost',
            size: 'sm',
            class: 'h-7 px-2.5 text-xs text-destructive hover:text-destructive',
            disabled: acting,
            onClick: () => emit('remove', record),
          },
          () => '删除'
        )
      );

      return h('div', { class: 'flex flex-wrap justify-end gap-1.5' }, actions);
    },
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
