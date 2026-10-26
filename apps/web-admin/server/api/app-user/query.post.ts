import type { ApiResponse } from '~~/app/types/api';
import type { AppUserPage } from '~~/app/types/app-user';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event);
  return unwrapApiResponse(await backendFetch<ApiResponse<AppUserPage>>(event, '/AppUser/PageList', {
    method: 'POST', body,
  }));
});
