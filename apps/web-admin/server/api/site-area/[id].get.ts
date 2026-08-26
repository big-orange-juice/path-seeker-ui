import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') ?? '').trim();
  const response = await backendFetch<ApiResponse<unknown>>(event, '/SiteArea/Get', { query: { id } });
  return unwrapApiResponse(response);
});
