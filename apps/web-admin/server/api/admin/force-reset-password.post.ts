import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event): Promise<void> => {
  const body = await readBody<{ adminId?: string; newPassword?: string }>(event);
  const response = await backendFetch<ApiResponse>(event, '/Admin/ForceResetPassword', {
    method: 'POST',
    body: {
      adminId: String(body?.adminId || '').trim(),
      newPassword: String(body?.newPassword || ''),
    },
  });

  unwrapApiResponse(response);
});
