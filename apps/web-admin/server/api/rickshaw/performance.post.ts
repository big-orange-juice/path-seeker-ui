import type { ApiResponse } from '~~/app/types/api';
import type { RickshawPerformance } from '~~/app/types/rickshaw';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event);
  return unwrapApiResponse(await backendFetch<ApiResponse<RickshawPerformance[]>>(event, '/Rickshaw/Performance', {
    method: 'POST', body,
  }));
});
