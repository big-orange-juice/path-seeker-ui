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
    id: 'coverImageUrl',
    header: () =>
      h(
        'span',
        {
          class:
            'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'
        },
        '封面'
      ),
    cell: ({ row }) => {
      const url = String(row.original.coverImageUrl || '').trim();
      if (!url) {
        return h(
          'div',
          {
            class:
              'flex h-12 w-9 items-center justify-center rounded-md border border-border/50 bg-secondary/30 text-[10px] text-muted-foreground'
          },
          '无'
        );
      }
      return h('img', {
        src: url,
        alt: '',
        class: 'h-12 w-9 rounded-md border border-border/50 object-cover',
        loading: 'lazy'
      });
    }
  },
  {
    accessorKey: 'title',
    header: renderHeader('路线', 'title'),
    cell: ({ row }) => {
      const record = row.original;
      const titleText = record.title || '未命名路线';
      // tip：完整标题；编码仅作补充（R-01 列表不强调编码）
      const titleTip = record.routeCode
        ? `${titleText}（编码：${record.routeCode}）`
        : titleText;
      return h('div', { class: 'min-w-0 max-w-[12rem] space-y-1' }, [
        h('div', { class: 'flex min-w-0 items-center gap-2' }, [
          h(
            'p',
            {
              class: 'min-w-0 truncate font-medium text-foreground',
              title: titleTip
            },
            titleText
          ),
          record.isGenerating
            ? h(
                'span',
                {
                  class:
                    'shrink-0 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200',
                  title: [
                    '路线异步生成中，可点击刷新查看最新状态',
                    record.taskStatusText || '',
                    record.progressPercent != null
                      ? `当前进度 ${record.progressPercent}%`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · '),
                },
                record.progressPercent != null
                  ? `生成中 ${record.progressPercent}%`
                  : '生成中'
              )
            : null,
          record.auditRequired
            ? h(
                'span',
                {
                  class:
                    'shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-200'
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
    cell: ({ row }) => {
      // 主题常为长文案：列宽收紧 + 单行截断，完整内容靠 native tip
      const theme = String(row.original.theme || '').trim() || '未设置';
      return h(
        'span',
        {
          class: 'block max-w-[16rem] truncate text-sm text-muted-foreground',
          title: theme
        },
        theme
      );
    }
  },
  {
    accessorKey: 'ownerName',
    header: renderHeader('创建人', 'ownerName'),
    cell: ({ row }) => {
      const ownerName = String(row.original.ownerName || '').trim() || '—';
      return h(
        'span',
        {
          class: 'block max-w-[5.5rem] truncate text-sm text-muted-foreground',
          title: ownerName
        },
        ownerName
      );
    }
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
          title: '本路线包含的站点数量，点击排序'
        },
        [
          h('span', '站点数'),
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
          title: '本路线包含的站点数量'
        },
        String(row.original.puzzleCount)
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
        onRemove: () => emit('remove', record)
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
