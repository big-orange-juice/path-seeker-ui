import { computed, ref, shallowRef } from 'vue';
import { resolveApiErrorMessage, useApiClient } from '@/composables/useApiClient';
import type { AppUserPage, AppUserRecord, DriverPermissionDraft } from '@/types/app-user';

export const useAppUserManagement = () => {
  const { request } = useApiClient();
  const keyword = ref('');
  const status = ref('');
  const isDriver = ref('');
  const pageIndex = ref(1);
  const pageSize = 20;
  const rows = shallowRef<AppUserRecord[]>([]);
  const total = ref(0);
  const pending = ref(false);
  const saving = ref(false);
  const error = ref('');
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));
  let queryVersion = 0;

  const refresh = async (page = 1) => {
    const version = ++queryVersion;
    pending.value = true;
    error.value = '';
    try {
      const result = await request<AppUserPage>('/api/app-user/query', {
        method: 'POST', timeout: 30000, retry: 0,
        body: {
          pageIndex: page, pageSize, keyword: keyword.value.trim() || undefined,
          status: status.value ? Number(status.value) : undefined,
          isDriver: isDriver.value === '' ? undefined : isDriver.value === 'true',
        },
      });
      if (version !== queryVersion) return;
      rows.value = result.list;
      total.value = result.total;
      pageIndex.value = result.pageIndex;
    } catch (caught) {
      if (version === queryVersion) error.value = resolveApiErrorMessage(caught, 'C端用户加载失败');
    } finally {
      if (version === queryVersion) pending.value = false;
    }
  };

  const saveDriver = async (draft: DriverPermissionDraft) => {
    if (saving.value) throw new Error('请等待当前操作完成');
    saving.value = true;
    try {
      await request('/api/app-user/driver', {
        method: 'POST', timeout: 30000, retry: 0,
        body: { userId: draft.userId, isDriver: draft.isDriver, phone: draft.isDriver ? draft.phone.trim() : null },
      });
    } finally {
      saving.value = false;
    }
  };

  return { keyword, status, isDriver, pageIndex, pageSize, rows, total, totalPages, pending, saving, error, refresh, saveDriver };
};
