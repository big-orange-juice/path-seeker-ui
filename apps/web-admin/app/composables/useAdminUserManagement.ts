import { computed, shallowRef, watch } from 'vue';
import { useApiClient } from '@/composables/useApiClient';
import type {
  AdminRoleOption,
  AdminUserDraft,
  AdminUserPageResult,
  AdminUserRecord,
  CreateAdminUserPayload,
  UpdateAdminUserPayload,
} from '@/types/admin-user';
import {
  ADMIN_USER_STATUS,
  createEmptyAdminUserDraft,
} from '@/types/admin-user';
import { roleDisplayName } from '@/constants/routeWorkflow';

const DEFAULT_PAGE_SIZE = 20;

const normalizeText = (value: string | null | undefined) => String(value ?? '').trim();

export const useAdminUserManagement = () => {
  const { request } = useApiClient();

  const keyword = shallowRef('');
  const status = shallowRef(0);
  const roleId = shallowRef('');
  const pageIndex = shallowRef(1);
  const pageSize = shallowRef(DEFAULT_PAGE_SIZE);
  const rows = shallowRef<AdminUserRecord[]>([]);
  const total = shallowRef(0);
  const totalPages = shallowRef(0);
  const pending = shallowRef(false);
  const error = shallowRef<Error | null>(null);
  const roles = shallowRef<AdminRoleOption[]>([]);
  const rolesPending = shallowRef(false);

  const roleOptions = computed(() =>
    roles.value
      .filter((item) => item.id)
      .map((item) => ({
        value: item.id,
        label: roleDisplayName(item.roleCode, item.roleName) || item.id,
      })),
  );

  const fetchRoles = async () => {
    rolesPending.value = true;
    try {
      roles.value = await request<AdminRoleOption[]>('/api/admin/roles');
    } catch {
      roles.value = [];
    } finally {
      rolesPending.value = false;
    }
  };

  const refresh = async () => {
    pending.value = true;
    error.value = null;

    try {
      const data = await request<AdminUserPageResult>('/api/admin/page-list', {
        method: 'POST',
        body: {
          pageIndex: pageIndex.value,
          pageSize: pageSize.value,
          keyword: normalizeText(keyword.value) || null,
          roleId: normalizeText(roleId.value) || null,
          status: status.value === 0 ? null : status.value,
        },
      });

      rows.value = data.list ?? [];
      total.value = data.total ?? 0;
      totalPages.value = data.totalPages ?? 0;
      pageIndex.value = data.pageIndex ?? pageIndex.value;
      pageSize.value = data.pageSize ?? pageSize.value;
    } catch (caught) {
      error.value = caught instanceof Error ? caught : new Error('管理员列表加载失败。');
      rows.value = [];
      total.value = 0;
      totalPages.value = 0;
    } finally {
      pending.value = false;
    }
  };

  const setPage = (next: number) => {
    pageIndex.value = Math.max(1, next);
  };

  const setPageSize = (next: number) => {
    pageSize.value = Math.max(1, next);
    pageIndex.value = 1;
  };

  const resetFilters = () => {
    keyword.value = '';
    status.value = 0;
    roleId.value = '';
    pageIndex.value = 1;
  };

  const createAdmin = async (draft: AdminUserDraft) => {
    const payload: CreateAdminUserPayload = {
      username: normalizeText(draft.username),
      password: draft.password,
      realName: normalizeText(draft.realName) || null,
      phone: normalizeText(draft.phone) || null,
      email: normalizeText(draft.email) || null,
      roleId: normalizeText(draft.roleId),
    };
    return request<string>('/api/admin/create', {
      method: 'POST',
      body: payload,
    });
  };

  const updateAdmin = async (draft: AdminUserDraft) => {
    const payload: UpdateAdminUserPayload = {
      id: normalizeText(draft.id),
      realName: normalizeText(draft.realName) || null,
      phone: normalizeText(draft.phone) || null,
      email: normalizeText(draft.email) || null,
      roleId: normalizeText(draft.roleId),
    };
    await request('/api/admin/update', {
      method: 'POST',
      body: payload,
    });
  };

  const deleteAdmin = async (adminId: string) => {
    await request('/api/admin/soft-delete', {
      method: 'POST',
      body: { adminId: normalizeText(adminId) },
    });
  };

  const changeStatus = async (adminId: string, nextStatus: number) => {
    await request('/api/admin/change-status', {
      method: 'POST',
      body: {
        adminId: normalizeText(adminId),
        status: nextStatus,
      },
    });
  };

  const forceResetPassword = async (adminId: string, newPassword: string) => {
    await request('/api/admin/force-reset-password', {
      method: 'POST',
      body: {
        adminId: normalizeText(adminId),
        newPassword,
      },
    });
  };

  const toggleStatus = async (record: AdminUserRecord) => {
    const next =
      record.status === ADMIN_USER_STATUS.ENABLED
        ? ADMIN_USER_STATUS.DISABLED
        : ADMIN_USER_STATUS.ENABLED;
    await changeStatus(record.id, next);
  };

  // 筛选变化回到第 1 页；分页变化单独触发
  watch([keyword, status, roleId], () => {
    if (pageIndex.value !== 1) {
      pageIndex.value = 1;
      return;
    }
    void refresh();
  });

  watch([pageIndex, pageSize], () => {
    void refresh();
  }, { immediate: true });

  return {
    keyword,
    status,
    roleId,
    pageIndex,
    pageSize,
    rows,
    total,
    totalPages,
    pending,
    error,
    roles,
    rolesPending,
    roleOptions,
    fetchRoles,
    refresh,
    setPage,
    setPageSize,
    resetFilters,
    createAdmin,
    updateAdmin,
    deleteAdmin,
    changeStatus,
    forceResetPassword,
    toggleStatus,
    createEmptyAdminUserDraft,
  };
};
