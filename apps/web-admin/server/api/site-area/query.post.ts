import type { ApiResponse } from '~~/app/types/api';
import type { SiteAreaPageResult, SiteAreaResponse } from '~~/app/types/site-area';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event);
  const response = await backendFetch<ApiResponse<SiteAreaPageResult<SiteAreaResponse>>>(event, '/SiteArea/PageList', { method: 'POST', body });
  return unwrapApiResponse(response) ?? { list: [], pageIndex: 1, pageSize: 50, total: 0, totalPages: 0 };
});
