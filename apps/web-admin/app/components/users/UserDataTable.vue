<script setup lang="ts">
import { computed, h } from 'vue';
import type { ColumnDef } from '@tanstack/vue-table';
import CollectionDataTable from '@/components/collections/CollectionDataTable.vue';
import Button from '@/components/shadcn/button/Button.vue';
import {
  ADMIN_USER_STATUS,
  getAdminUserStatusLabel,
  type AdminUserRecord,
} from '@/types/admin-user';

interface Props {
  rows: AdminUserRecord[];
  pending?: boolean;
  actingIds?: string[];
  currentAdminId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  pending: false,
  actingIds: () => [],
  currentAdminId: '',
});

const emit = defineEmits<{
  edit: [record: AdminUserRecord];
  remove: [record: AdminUserRecord];
  toggleStatus: [record: AdminUserRecord];
  resetPassword: [record: AdminUserRecord];
}>();

const isActing = (id: string) => props.actingIds.includes(id);
const isSelf = (id: string) => Boolean(props.currentAdminId && id === props.currentAdminId);

const statusClass = (status: number) =>
  status === ADMIN_USER_STATUS.ENABLED
    ? 'bg-emerald-500/10 text-emerald-300'
    : 'bg-slate-500/10 text-slate-300';

const formatTime = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  // 仅展示日期时间前 16 位（YYYY-MM-DD HH:mm）
  return raw.replace('T', ' ').slice(0, 16);
};

const columns = computed<ColumnDef<AdminUserRecord>[]>(() => [
  {
    accessorKey: 'username',
    header: () =>
      h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '账号'),
    cell: ({ row }) => {
      const record = row.original;
      return h('div', { class: 'min-w-0 space-y-0.5' }, [
        h('p', { class: 'truncate text-sm font-medium text-foreground' }, record.username || '—'),
        h('p', { class: 'truncate text-xs text-muted-foreground' }, record.realName || '未填写姓名'),
      ]);
    },
  },
  {
    accessorKey: 'roleName',
    header: () =>
      h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '角色'),
    cell: ({ row }) =>
      h('span', { class: 'text-sm text-muted-foreground' }, row.original.roleName || row.original.roleCode || '—'),
  },
  {
    accessorKey: 'contact',
    header: () =>
      h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '联系方式'),
    cell: ({ row }) => {
      const phone = row.original.phone || '';
      const email = row.original.email || '';
      return h('div', { class: 'min-w-0 space-y-0.5 text-xs text-muted-foreground' }, [
        h('p', { class: 'truncate' }, phone || '—'),
        h('p', { class: 'truncate' }, email || '—'),
      ]);
    },
  },
  {
    accessorKey: 'status',
    header: () =>
      h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '状态'),
    cell: ({ row }) =>
      h(
        'span',
        {
          class: `inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusClass(row.original.status)}`,
        },
        getAdminUserStatusLabel(row.original.status),
      ),
  },
  {
    accessorKey: 'lastLoginTime',
    header: () =>
      h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '最近登录'),
    cell: ({ row }) =>
      h('span', { class: 'text-sm text-muted-foreground' }, formatTime(row.original.lastLoginTime)),
  },
  {
    id: 'actions',
    header: () =>
      h('span', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, '操作'),
    cell: ({ row }) => {
      const record = row.original;
      const acting = isActing(record.id);
      const self = isSelf(record.id);
      const enabled = record.status === ADMIN_USER_STATUS.ENABLED;

      return h('div', { class: 'flex flex-wrap items-center justify-start gap-1.5' }, [
        h(
          Button,
          {
            variant: 'outline',
            class: 'h-7 px-2 text-xs',
            disabled: acting,
            onClick: () => emit('edit', record),
          },
          () => '编辑',
        ),
        h(
          Button,
          {
            variant: 'outline',
            class: 'h-7 px-2 text-xs',
            disabled: acting,
            onClick: () => emit('resetPassword', record),
          },
          () => '重置密码',
        ),
        h(
          Button,
          {
            variant: 'outline',
            class: 'h-7 px-2 text-xs',
            disabled: acting || self,
            onClick: () => emit('toggleStatus', record),
          },
          () => (enabled ? '禁用' : '启用'),
        ),
        h(
          Button,
          {
            variant: 'outline',
            class: 'h-7 px-2 text-xs text-rose-300 hover:text-rose-200',
            disabled: acting || self,
            onClick: () => emit('remove', record),
          },
          () => '删除',
        ),
      ]);
    },
  },
]);
</script>

<template>
  <CollectionDataTable
    :columns="columns"
    :data="props.rows"
    :pending="props.pending"
    empty-text="暂无管理员账号。"
  />
</template>
