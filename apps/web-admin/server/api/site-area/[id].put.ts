import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') ?? '').trim();
  const body = await readBody<Record<string, unknown>>(event);
  const response = await backendFetch<ApiResponse<unknown>>(event, '/SiteArea/Update', { method: 'POST', body: { ...body, id } });
  return unwrapApiResponse(response);
});
