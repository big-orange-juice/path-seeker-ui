import type { ApiResponse } from '~~/app/types/api';
import type { AdminUserPageQuery, AdminUserPageResult, AdminUserRecord } from '~~/app/types/admin-user';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event): Promise<AdminUserPageResult> => {
  const body = await readBody<Partial<AdminUserPageQuery>>(event);
  const pageIndex = Math.max(1, Number(body?.pageIndex || 1) || 1);
  const pageSize = Math.max(1, Number(body?.pageSize || 10) || 10);
  const keyword = String(body?.keyword || '').trim();
  const roleId = String(body?.roleId || '').trim();
  const statusRaw = body?.status;

  const response = await backendFetch<ApiResponse<AdminUserPageResult>>(event, '/Admin/PageList', {
    method: 'POST',
    body: {
      pageIndex,
      pageSize,
      keyword: keyword || null,
      roleId: roleId || null,
      status:
        statusRaw === null || statusRaw === undefined || Number(statusRaw) === 0
          ? null
          : Number(statusRaw),
    },
  });

  const data = unwrapApiResponse(response);
  return {
    list: ((data?.list ?? []) as AdminUserRecord[]).map((item) => ({
      ...item,
      id: String(item.id ?? ''),
      roleId: String(item.roleId ?? ''),
    })),
    pageIndex: data?.pageIndex ?? pageIndex,
    pageSize: data?.pageSize ?? pageSize,
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
  };
});
