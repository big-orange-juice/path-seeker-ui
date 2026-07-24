import type { ApiResponse } from '~~/app/types/api';
import type { UpdateAdminUserPayload } from '~~/app/types/admin-user';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event): Promise<void> => {
  const body = await readBody<UpdateAdminUserPayload>(event);
  const response = await backendFetch<ApiResponse>(event, '/Admin/UpdateAdmin', {
    method: 'POST',
    body: {
      id: String(body?.id || '').trim(),
      realName: String(body?.realName || '').trim() || null,
      phone: String(body?.phone || '').trim() || null,
      email: String(body?.email || '').trim() || null,
      roleId: String(body?.roleId || '').trim(),
    },
  });

  unwrapApiResponse(response);
});
