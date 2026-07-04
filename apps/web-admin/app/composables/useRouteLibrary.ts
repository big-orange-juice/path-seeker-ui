import { computed, reactive, shallowRef, toValue, watch } from 'vue';
import { useApiClient } from '@/composables/useApiClient';
import type {
  RouteAdminResponse,
  RouteAdminResponseListTotalPageResult,
  RouteDetailResponse,
  RouteMutationPayload,
  RoutePageRequest,
  RouteRecord,
} from '@/types/route';

const DEFAULT_PAGE_SIZE = 10;

const normalizeText = (value: string | null | undefined) => String(value ?? '').trim();

export const ROUTE_PUBLISH_STATUS_OPTIONS = [
  { label: '全部状态', value: -1 },
  { label: '未发布', value: 1 },
  { label: '已发布', value: 2 },
] as const;

export const useRouteLibrary = (
  museumIdSource?: string | null | undefined | (() => string | null | undefined)
) => {
  const runtimeConfig = useRuntimeConfig();
  const museumId = computed(() => {
    const sourceValue = museumIdSource === undefined
      ? runtimeConfig.public.museumId
      : toValue(museumIdSource);

    return String(sourceValue ?? '').trim();
  });
  const { request } = useApiClient();
  const hasSelectedMuseum = computed(() => Boolean(museumId.value));

  const filters = reactive({
    keyword: '',
    publishStatus: -1,
  });

  const pageIndex = shallowRef(1);
  const pageSize = shallowRef(DEFAULT_PAGE_SIZE);
  const sorting = shallowRef<Array<{ id: string; desc: boolean }>>([{ id: 'sortOrder', desc: false }]);

  const queryPayload = computed<RoutePageRequest>(() => ({
    pageIndex: pageIndex.value,
    pageSize: pageSize.value,
    museumId: museumId.value || null,
    publishStatus: filters.publishStatus < 0 ? null : filters.publishStatus,
    keyword: filters.keyword.trim() || null,
  }));

  const { data, pending, error, refresh } = useAsyncData(
    computed(() => `route-library:list:${museumId.value}`),
    () => request<RouteAdminResponseListTotalPageResult<RouteAdminResponse>>('/api/route/query', {
      method: 'POST',
      body: queryPayload.value,
    }),
    {
      default: () => ({
        list: [],
        pageIndex: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        total: 0,
        totalPages: 0,
      }),
      immediate: false,
      watch: [queryPayload],
    }
  );

  watch(
    hasSelectedMuseum,
    (selected) => {
      if (!selected) {
        return;
      }

      void refresh();
    },
    { immediate: true }
  );

  const rows = computed<RouteRecord[]>(() => {
    const list = (data.value.list ?? []).map((item) => ({
      id: normalizeText(item.id) || crypto.randomUUID(),
      routeCode: normalizeText(item.routeCode),
      routeType: item.routeType ?? 0,
      museumId: normalizeText(item.museumId) || null,
      title: normalizeText(item.title),
      theme: normalizeText(item.theme),
      scaleType: item.scaleType ?? 0,
      difficultyLevel: item.difficultyLevel ?? 0,
      ageGroup: item.ageGroup ?? 0,
      allowTeam: item.allowTeam ?? 0,
      minTeamSize: item.minTeamSize ?? 0,
      maxTeamSize: item.maxTeamSize ?? 0,
      estimatedMinutes: item.estimatedMinutes ?? null,
      totalScore: item.totalScore ?? 0,
      puzzleCount: item.puzzleCount ?? 0,
      intro: normalizeText(item.intro),
      rewardTitle: normalizeText(item.rewardTitle),
      publishStatus: item.publishStatus ?? 0,
      auditStatus: item.auditStatus ?? 0,
      auditRemark: normalizeText(item.auditRemark),
      sortOrder: item.sortOrder ?? 0,
      isGenerating: Boolean(item.isGenerating),
    }));

    const currentSorting = sorting.value[0];
    if (!currentSorting) {
      return list;
    }

    const nextList = [...list].sort((left, right) => {
      const leftValue = left[currentSorting.id as keyof RouteRecord];
      const rightValue = right[currentSorting.id as keyof RouteRecord];

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        const result = leftValue - rightValue;
        return currentSorting.desc ? -result : result;
      }

      const leftText = String(leftValue ?? '');
      const rightText = String(rightValue ?? '');
      const result = leftText.localeCompare(rightText, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
      return currentSorting.desc ? -result : result;
    });

    return nextList;
  });

  const setPage = (nextPage: number) => {
    const totalPages = Math.max(data.value.totalPages ?? 1, 1);
    pageIndex.value = Math.min(Math.max(nextPage, 1), totalPages);
  };

  const setPageSize = (nextPageSize: number) => {
    pageSize.value = nextPageSize;
    pageIndex.value = 1;
  };

  const resetFilters = () => {
    filters.keyword = '';
    filters.publishStatus = -1;
    pageIndex.value = 1;
  };

  const toggleSort = (columnId: string) => {
    const current = sorting.value[0];
    if (!current || current.id !== columnId) {
      sorting.value = [{ id: columnId, desc: false }];
      return;
    }

    if (!current.desc) {
      sorting.value = [{ id: columnId, desc: true }];
      return;
    }

    sorting.value = [{ id: 'sortOrder', desc: false }];
  };

  const publishRoute = async (payload: RouteMutationPayload) => {
    await request('/api/route/publish', {
      method: 'POST',
      body: payload,
    });

    await refresh();
  };

  const deleteRoute = async (id: string) => {
    await request(`/api/route/${id}`, {
      method: 'DELETE',
    });

    await refresh();
  };

  const fetchRouteDetail = (id: string) =>
    request<RouteDetailResponse>('/api/route/detail', {
      method: 'GET',
      query: { id },
    });

  watch([museumId, () => filters.keyword, () => filters.publishStatus], () => {
    pageIndex.value = 1;
  });

  return {
    museumId,
    filters,
    rows,
    pending,
    error,
    refresh,
    pageIndex,
    pageSize,
    sorting,
    total: computed(() => data.value.total ?? 0),
    totalPages: computed(() => data.value.totalPages ?? 0),
    setPage,
    setPageSize,
    resetFilters,
    toggleSort,
    publishRoute,
    deleteRoute,
    fetchRouteDetail,
  };
};
