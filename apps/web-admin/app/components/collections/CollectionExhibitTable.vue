<script setup lang="ts">
import { computed, h } from 'vue';
import type { ColumnDef, SortingState } from '@tanstack/vue-table';
import CollectionDataTable from '@/components/collections/CollectionDataTable.vue';
import Button from '@/components/shadcn/button/Button.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { ExhibitRecord } from '@/types/museum';

interface Props {
  rows: ExhibitRecord[];
  pending?: boolean;
  sorting?: SortingState;
  galleryLabelById?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
  pending: false,
  sorting: () => [],
  galleryLabelById: () => ({}),
});

const emit = defineEmits<{
  sort: [columnId: string];
  detail: [record: ExhibitRecord];
  edit: [record: ExhibitRecord];
  remove: [record: ExhibitRecord];
}>();

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

const columns = computed<ColumnDef<ExhibitRecord>[]>(() => [
  {
    accessorKey: 'name',
    header: renderHeader('馆藏', 'name'),
    cell: ({ row }) => {
      const record = row.original;
      return h('div', { class: 'min-w-0 space-y-1' }, [
        h('div', { class: 'flex items-center gap-2' }, [
          h('p', { class: 'truncate font-medium text-foreground' }, record.name || '未命名馆藏'),
          h(
            'span',
            {
              class: record.isHighlight === 1
                ? 'rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] text-amber-200'
                : 'rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground',
            },
            record.isHighlight === 1 ? '重点展品' : '普通馆藏'
          ),
        ]),
        h('p', { class: 'text-xs text-muted-foreground' }, record.exhibitCode || 'NO-CODE'),
      ]);
    },
  },
  {
    accessorKey: 'galleryId',
    header: renderHeader('展馆', 'galleryId'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, props.galleryLabelById[row.original.galleryId ?? ''] || '未分配'),
  },
  {
    accessorKey: 'dynasty',
    header: renderHeader('年代', 'dynasty'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, row.original.dynasty || '未填写'),
  },
  {
    accessorKey: 'material',
    header: renderHeader('材质', 'material'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, row.original.material || '未填写'),
  },
  {
    accessorKey: 'recommendedMinutes',
    header: renderHeader('停留时长', 'recommendedMinutes'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, row.original.recommendedMinutes === null ? '未设置' : String(row.original.recommendedMinutes) + ' 分钟'),
  },
  {
    accessorKey: 'sortOrder',
    header: renderHeader('排序', 'sortOrder'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, String(row.original.sortOrder ?? 0)),
  },
  {
    id: 'actions',
    header: () => h('span', { class: 'sr-only' }, '操作'),
    cell: ({ row }) =>
      h('div', { class: 'flex items-center justify-end gap-2' }, [
        h(
          Button,
          { variant: 'ghost', size: 'sm', onClick: () => emit('detail', row.original) },
          { default: () => '详情' }
        ),
        h(
          Button,
          { variant: 'secondary', size: 'sm', onClick: () => emit('edit', row.original) },
          { default: () => '编辑' }
        ),
        h(
          Button,
          { variant: 'ghost', size: 'sm', onClick: () => emit('remove', row.original) },
          { default: () => '删除' }
        ),
      ]),
  },
]);
</script>

<template>
  <CollectionDataTable
    :columns="columns"
    :data="props.rows"
    :sorting="props.sorting"
    :pending="props.pending"
    empty-text="当前筛选条件下没有馆藏数据。" />
</template>
