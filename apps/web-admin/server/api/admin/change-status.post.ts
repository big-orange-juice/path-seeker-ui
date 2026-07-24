import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event): Promise<void> => {
  const body = await readBody<{ adminId?: string; status?: number }>(event);
  const response = await backendFetch<ApiResponse>(event, '/Admin/ChangeStatus', {
    method: 'POST',
    body: {
      adminId: String(body?.adminId || '').trim(),
      status: Number(body?.status),
    },
  });

  unwrapApiResponse(response);
});
