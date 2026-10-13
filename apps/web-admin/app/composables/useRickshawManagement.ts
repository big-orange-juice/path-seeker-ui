import { computed, ref, shallowRef } from 'vue';
import { useApiClient, resolveApiErrorMessage } from '@/composables/useApiClient';
import type { RickshawDraft, RickshawPage, RickshawRecord, RickshawQr, RickshawPerformance } from '@/types/rickshaw';

export const useRickshawManagement = () => {
  const { request } = useApiClient();
  const keyword = ref('');
  const museumId = ref('');
  const status = ref('');
  const pageIndex = ref(1);
  const pageSize = 20;
  const rows = shallowRef<RickshawRecord[]>([]);
  const total = ref(0);
  const pending = ref(false);
  const acting = ref(false);
  const error = ref('');
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));
  let queryVersion = 0;

  const refresh = async (page = pageIndex.value) => {
    const version = ++queryVersion;
    pending.value = true;
    error.value = '';
    try {
      const result = await request<RickshawPage>('/api/rickshaw/query', {
        method: 'POST', timeout: 30000, retry: 0,
        body: { pageIndex: page, pageSize, keyword: keyword.value.trim() || undefined,
          museumId: museumId.value || undefined, status: status.value ? Number(status.value) : undefined },
      });
      if (version !== queryVersion) return;
      rows.value = result.list;
      total.value = result.total;
      pageIndex.value = result.pageIndex;
    } catch (caught) {
      if (version === queryVersion) error.value = resolveApiErrorMessage(caught, '黄包车列表加载失败');
    } finally {
      if (version === queryVersion) pending.value = false;
    }
  };

  const mutate = async <T>(path: string, body: object): Promise<T> => {
    if (acting.value) throw new Error('请等待当前操作完成');
    acting.value = true;
    try {
      return await request<T>(path, { method: 'POST', body, timeout: 30000, retry: 0 });
    } finally {
      acting.value = false;
    }
  };

  const save = (draft: RickshawDraft) => mutate<string | null>(
    `/api/rickshaw/${draft.id ? 'update' : 'create'}`, {
      ...draft, vehicleNo: draft.vehicleNo.trim(), driverName: draft.driverName.trim(), remark: draft.remark.trim(),
    });
  const updateStatus = (id: string, nextStatus: number) => mutate('/api/rickshaw/status', { id, status: nextStatus });
  const generateQr = (id: string, rotate = false) => mutate<RickshawQr>('/api/rickshaw/qr', { id, rotate });
  const performance = (id: string, from?: string, to?: string) => mutate<RickshawPerformance[]>(
    '/api/rickshaw/performance', { rickshawId: id, from: from || undefined, to: to || undefined });

  return { keyword, museumId, status, pageIndex, rows, total, totalPages, pending, acting, error,
    refresh, save, updateStatus, generateQr, performance };
};
