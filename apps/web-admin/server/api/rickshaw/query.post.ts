import type { ApiResponse } from '~~/app/types/api';
import type { RickshawPage } from '~~/app/types/rickshaw';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event);
  return unwrapApiResponse(await backendFetch<ApiResponse<RickshawPage>>(event, '/Rickshaw/PageList', {
    method: 'POST', body,
  }));
});
