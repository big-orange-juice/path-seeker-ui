import type { ApiResponse } from '~~/app/types/api';
import type {
  RouteAdminResponse,
  RouteAdminResponseListTotalPageResult,
  RoutePageRequest,
} from '~~/app/types/route';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

const resolveList = (payload: unknown): RouteAdminResponse[] => {
  const source = payload && typeof payload === 'object'
    ? payload as Record<string, unknown>
    : {};

  const candidate = source.list ?? source.items ?? source.records ?? [];

  if (Array.isArray(candidate)) {
    return candidate as RouteAdminResponse[];
  }

  if (candidate && typeof candidate === 'object' && Array.isArray((candidate as { $values?: unknown[] }).$values)) {
    return (candidate as { $values: RouteAdminResponse[] }).$values;
  }

  return [];
};

const resolveNumber = (value: unknown, fallback: number) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

/** 对齐 schema：POST /api/Route/PageList（无 Query 接口） */
export default defineEventHandler(async (event) => {
  const body = await readBody<RoutePageRequest>(event);
  const response = await backendFetch<ApiResponse<RouteAdminResponseListTotalPageResult<RouteAdminResponse>>>(
    event,
    '/api/Route/PageList',
    {
      method: 'POST',
      body,
    }
  );

  const data = unwrapApiResponse(response);

  return {
    list: resolveList(data),
    pageIndex: resolveNumber(data?.pageIndex, body.pageIndex || 1),
    pageSize: resolveNumber(data?.pageSize, body.pageSize || 10),
    total: resolveNumber(data?.total, 0),
    totalPages: resolveNumber(data?.totalPages, 0),
  } satisfies RouteAdminResponseListTotalPageResult<RouteAdminResponse>;
});
