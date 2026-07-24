import { shallowRef } from 'vue';
import { useApiClient } from '@/composables/useApiClient';
import type { DashboardResponse } from '@/types/dashboard';

const emptyDashboard = (): DashboardResponse => ({
  overview: null,
  routeStats: [],
  ageDistribution: [],
  stuckPuzzles: [],
  hotExhibits: [],
});

export const useDashboard = () => {
  const { request } = useApiClient();
  const data = shallowRef<DashboardResponse>(emptyDashboard());
  const pending = shallowRef(false);
  const error = shallowRef<Error | null>(null);

  const refresh = async () => {
    pending.value = true;
    error.value = null;
    try {
      data.value = await request<DashboardResponse>('/api/admin/dashboard');
    } catch (caught) {
      error.value = caught instanceof Error ? caught : new Error('看板数据加载失败。');
      data.value = emptyDashboard();
    } finally {
      pending.value = false;
    }
  };

  return {
    data,
    pending,
    error,
    refresh,
  };
};
