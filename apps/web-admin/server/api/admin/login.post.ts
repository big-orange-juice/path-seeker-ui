import type { ApiResponse } from '~~/app/types/api';
import type { AdminLoginPayload, AdminLoginResponse } from '~~/app/types/auth';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event): Promise<AdminLoginResponse | null> => {
  const body = await readBody<AdminLoginPayload>(event);
  const response = await backendFetch<ApiResponse<AdminLoginResponse>>(event, '/Admin/Login', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
