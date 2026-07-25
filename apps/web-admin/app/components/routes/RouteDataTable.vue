<script setup lang="ts">
import { computed, h } from 'vue';
import type { ColumnDef, SortingState } from '@tanstack/vue-table';
import CollectionDataTable from '@/components/collections/CollectionDataTable.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import RouteRowActions from '@/components/routes/RouteRowActions.vue';
import {
  getRouteStatusPresentation,
  getRouteWorkflowActions,
  type RouteWorkflowContext
} from '@/constants/routeWorkflow';
import type { RouteRecord } from '@/types/route';

interface Props {
  rows: RouteRecord[];
  pending?: boolean;
  sorting?: SortingState;
  actingIds?: string[];
  workflowContext: RouteWorkflowContext;
}

const props = withDefaults(defineProps<Props>(), {
  pending: false,
  sorting: () => [],
  actingIds: () => []
});

const emit = defineEmits<{
  sort: [columnId: string];
  /** 打开详情：编辑 / 查看 / 审核（待审只读，底部再审） */
  detail: [record: RouteRecord];
  /** 海报管理：生成 / 查看路线海报 */
  poster: [record: RouteRecord];
  publish: [record: RouteRecord];
  unpublish: [record: RouteRecord];
  submitAudit: [record: RouteRecord];
  refreshRow: [record: RouteRecord];
  remove: [record: RouteRecord];
}>();

const getSortIconName = (columnId: string) => {
  const active = props.sorting.find((item) => item.id === columnId);
  if (!active) {
    return 'arrow-up-down' as const;
  }

  return active.desc ? ('arrow-down' as const) : ('arrow-up' as const);
};

const renderHeader = (label: string, columnId: string) => () =>
  h(
    'button',
    {
      type: 'button',
      class:
        'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground',
      onClick: () => emit('sort', columnId),
      title: `${label}排序`
    },
    [
      h('span', label),
      h(AppIcon, {
        name: getSortIconName(columnId),
        class: 'h-3.5 w-3.5 text-muted-foreground/80',
        strokeWidth: 1.8
      })
    ]
  );

const isRecordActing = (recordId: string) => props.actingIds.includes(recordId);

const renderStatus = (record: RouteRecord) => {
  const presentation = getRouteStatusPresentation(record);
  return h(
    'div',
    {
      class: 'inline-flex max-w-full flex-wrap items-center gap-1',
      title: presentation.title
    },
    [
      h(
        'span',
        {
          class: `inline-flex rounded-full px-2 py-0.5 text-[11px] ${presentation.primaryClass}`
        },
        presentation.primaryLabel
      ),
      presentation.secondaryLabel
        ? h(
            'span',
            {
              class: `inline-flex rounded-full px-2 py-0.5 text-[11px] ${presentation.secondaryClass}`
            },
            presentation.secondaryLabel
          )
        : null
    ]
  );
};

const columns = computed<ColumnDef<RouteRecord>[]>(() => [
  {
    accessorKey: 'title',
    header: renderHeader('路线', 'title'),
    cell: ({ row }) => {
      const record = row.original;
      return h('div', { class: 'min-w-0 space-y-1' }, [
        h('div', { class: 'flex items-center gap-2' }, [
          h(
            'p',
            {
              class: 'truncate font-medium text-foreground',
              // 编码仅 hover 可见，列表主文案不强调（R-01）
              title: record.routeCode ? `编码：${record.routeCode}` : undefined
            },
            record.title || '未命名路线'
          ),
          record.isGenerating
            ? h(
                'span',
                {
                  class:
                    'rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200'
                },
                '生成中'
              )
            : null,
          record.auditRequired
            ? h(
                'span',
                {
                  class:
                    'rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-200'
                },
                '需审'
              )
            : null
        ]),
        record.auditStatus === 3 && record.auditRemark
          ? h(
              'p',
              {
                class: 'line-clamp-1 text-[11px] text-rose-300/90',
                title: record.auditRemark
              },
              `驳回：${record.auditRemark}`
            )
          : null
      ]);
    }
  },
  {
    accessorKey: 'theme',
    header: renderHeader('主题', 'theme'),
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-sm text-muted-foreground' },
        row.original.theme || '未设置'
      )
  },
  {
    accessorKey: 'puzzleCount',
    header: () =>
      h(
        'button',
        {
          type: 'button',
          class:
            'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground',
          onClick: () => emit('sort', 'puzzleCount'),
          title: '本路线包含的关卡/站点数量，点击排序'
        },
        [
          h('span', '谜题数'),
          h(AppIcon, {
            name: getSortIconName('puzzleCount'),
            class: 'h-3.5 w-3.5 text-muted-foreground/80',
            strokeWidth: 1.8
          })
        ]
      ),
    cell: ({ row }) =>
      h(
        'span',
        {
          class: 'text-sm text-muted-foreground',
          title: '本路线包含的关卡/站点数量'
        },
        String(row.original.puzzleCount)
      )
  },
  {
    accessorKey: 'estimatedMinutes',
    header: renderHeader('时长', 'estimatedMinutes'),
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-sm text-muted-foreground' },
        row.original.estimatedMinutes === null
          ? '未设置'
          : `${row.original.estimatedMinutes} 分钟`
      )
  },
  {
    accessorKey: 'publishStatus',
    header: renderHeader('状态', 'publishStatus'),
    cell: ({ row }) => renderStatus(row.original)
  },
  {
    id: 'actions',
    header: () =>
      h(
        'span',
        {
          class:
            'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'
        },
        '操作'
      ),
    cell: ({ row }) => {
      const record = row.original;
      const acting = isRecordActing(record.id);
      const actions = getRouteWorkflowActions(record, props.workflowContext);

      // 主操作外露，海报/删除收进「更多」，避免操作列挤成一团
      return h(RouteRowActions, {
        record,
        actions,
        acting,
        onDetail: () => emit('detail', record),
        onPoster: () => emit('poster', record),
        onPublish: () => emit('publish', record),
        onUnpublish: () => emit('unpublish', record),
        onSubmitAudit: () => emit('submitAudit', record),
        onRefreshRow: () => emit('refreshRow', record),
        onRemove: () => emit('remove', record),
      });
    }
  }
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
