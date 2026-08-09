import { computed, reactive, shallowRef, toValue, watch } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { useApiClient } from '@/composables/useApiClient';
import {
  ROUTE_AUDIT_STATUS_OPTIONS,
  ROUTE_PUBLISH_STATUS_OPTIONS,
} from '@/constants/routeWorkflow';
import type {
  RouteAdminResponse,
  RouteAdminResponseListTotalPageResult,
  RouteAuditPayload,
  RouteDetailResponse,
  RouteIdPayload,
  RouteMutationPayload,
  RoutePageRequest,
  RouteRecord,
  RouteTaskSummaryResponse,
} from '@/types/route';

const DEFAULT_PAGE_SIZE = 10;

const normalizeText = (value: string | null | undefined) => String(value ?? '').trim();

/** 将接口进度规范到 0–100 整数；非法值返回 null */
const normalizeProgressPercent = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
};

/**
 * 从 TaskStatus 汇总推算列表进度：
 * - 有子任务时取 progressPercent 均值
 * - 仅排队、尚无进度时记 0
 */
const resolveProgressFromTaskSummary = (
  summary: RouteTaskSummaryResponse | null | undefined
): number | null => {
  if (!summary) {
    return null;
  }

  const tasks = Array.isArray(summary.tasks) ? summary.tasks : [];
  if (!tasks.length) {
    // 1=排队中：已进入生成流程但尚无子进度
    return summary.taskStatus === 1 ? 0 : null;
  }

  let sum = 0;
  let count = 0;
  for (const task of tasks) {
    const percent = normalizeProgressPercent(task.progressPercent);
    if (percent == null) {
      continue;
    }
    sum += percent;
    count += 1;
  }

  if (!count) {
    return summary.taskStatus === 1 ? 0 : null;
  }

  return Math.round(sum / count);
};

export { ROUTE_PUBLISH_STATUS_OPTIONS, ROUTE_AUDIT_STATUS_OPTIONS };

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
    ownerName: '',
    publishStatus: -1,
    auditStatus: -1,
  });

  const pageIndex = shallowRef(1);
  const pageSize = shallowRef(DEFAULT_PAGE_SIZE);
  const sorting = shallowRef<Array<{ id: string; desc: boolean }>>([{ id: 'sortOrder', desc: false }]);

  const queryPayload = computed<RoutePageRequest>(() => ({
    pageIndex: pageIndex.value,
    pageSize: pageSize.value,
    museumId: museumId.value || null,
    publishStatus: filters.publishStatus < 0 ? null : filters.publishStatus,
    auditStatus: filters.auditStatus < 0 ? null : filters.auditStatus,
    ownerName: filters.ownerName.trim() || null,
    keyword: filters.keyword.trim() || null,
  }));

  const { data, pending, error, refresh } = useAsyncData(
    computed(() => `route-library:list:${museumId.value}`),
    () => request<RouteAdminResponseListTotalPageResult<RouteAdminResponse>>('/api/route/page-list', {
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

  /**
   * 列表未带 progressPercent 时，按 routeId 缓存 TaskStatus 聚合进度。
   * 仅覆盖当前页 isGenerating 行，避免无关请求。
   */
  const progressByRouteId = shallowRef<Record<string, number>>({});
  let progressFetchToken = 0;

  const enrichGeneratingProgress = async (list: RouteAdminResponse[]) => {
    const token = ++progressFetchToken;
    const generating = list.filter((item) => Boolean(item.isGenerating));
    if (!generating.length) {
      progressByRouteId.value = {};
      return;
    }

    const nextMap: Record<string, number> = {};
    await Promise.all(
      generating.map(async (item) => {
        const id = normalizeText(item.id);
        if (!id) {
          return;
        }

        const fromList = normalizeProgressPercent(item.progressPercent);
        if (fromList != null) {
          nextMap[id] = fromList;
          return;
        }

        try {
          const summary = await request<RouteTaskSummaryResponse>('/api/route/task-status', {
            method: 'GET',
            query: { routeId: id },
          });
          const percent = resolveProgressFromTaskSummary(summary);
          if (percent != null) {
            nextMap[id] = percent;
          }
        } catch {
          // 单行失败不影响列表主体；保持无百分比展示
        }
      })
    );

    if (token !== progressFetchToken) {
      return;
    }

    progressByRouteId.value = nextMap;
  };

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

  watch(
    () => data.value.list,
    (list) => {
      void enrichGeneratingProgress(list ?? []);
    },
    { immediate: true }
  );

  const rows = computed<RouteRecord[]>(() => {
    const list = (data.value.list ?? []).map((item) => {
      const id = normalizeText(item.id) || uuidv4();
      const listProgress = normalizeProgressPercent(item.progressPercent);
      const cachedProgress =
        typeof progressByRouteId.value[id] === 'number'
          ? progressByRouteId.value[id]!
          : null;

      return {
        id,
        routeCode: normalizeText(item.routeCode),
        routeType: item.routeType ?? 0,
        museumId: normalizeText(item.museumId) || null,
        title: normalizeText(item.title),
        theme: normalizeText(item.theme),
        coverImageUrl: normalizeText(item.coverImageUrl) || null,
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
        // 缺省按需审展示；管理员免审路线后端会回 false
        auditRequired: typeof item.auditRequired === 'boolean' ? item.auditRequired : true,
        ownerId: normalizeText(item.ownerId) || null,
        ownerName: normalizeText(item.ownerName),
        canEdit: typeof item.canEdit === 'boolean' ? item.canEdit : null,
        sortOrder: item.sortOrder ?? 0,
        isGenerating: Boolean(item.isGenerating),
        taskStatus: typeof item.taskStatus === 'number' ? item.taskStatus : null,
        taskStatusText: normalizeText(item.taskStatusText),
        progressPercent: listProgress ?? cachedProgress,
      };
    });

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
    filters.ownerName = '';
    filters.publishStatus = -1;
    filters.auditStatus = -1;
    pageIndex.value = 1;
  };

  const setPendingAuditFilter = () => {
    filters.publishStatus = -1;
    filters.auditStatus = 1;
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

  const submitAudit = async (payload: RouteIdPayload) => {
    await request('/api/route/submit-audit', {
      method: 'POST',
      body: payload,
    });

    await refresh();
  };

  const auditRoute = async (payload: RouteAuditPayload) => {
    await request('/api/route/audit', {
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

  watch(
    [museumId, () => filters.keyword, () => filters.publishStatus, () => filters.auditStatus],
    () => {
      pageIndex.value = 1;
    }
  );

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
    setPendingAuditFilter,
    toggleSort,
    publishRoute,
    submitAudit,
    auditRoute,
    deleteRoute,
    fetchRouteDetail,
  };
};
