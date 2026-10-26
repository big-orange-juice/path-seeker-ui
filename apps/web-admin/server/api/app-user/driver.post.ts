import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event);
  return unwrapApiResponse(await backendFetch<ApiResponse<null>>(event, '/AppUser/ChangeDriver', {
    method: 'POST', body,
  }));
});
