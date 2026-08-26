import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const response = await backendFetch<ApiResponse<string>>(event, '/SiteArea/Create', { method: 'POST', body });
  return unwrapApiResponse(response);
});
