import type { ApiResponse } from '~~/app/types/api';
import type { CreateAdminUserPayload } from '~~/app/types/admin-user';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event): Promise<string> => {
  const body = await readBody<CreateAdminUserPayload>(event);
  const response = await backendFetch<ApiResponse<string>>(event, '/Admin/CreateAdmin', {
    method: 'POST',
    body: {
      username: String(body?.username || '').trim(),
      password: String(body?.password || ''),
      realName: String(body?.realName || '').trim() || null,
      phone: String(body?.phone || '').trim() || null,
      email: String(body?.email || '').trim() || null,
      roleId: String(body?.roleId || '').trim(),
    },
  });

  return String(unwrapApiResponse(response) ?? '');
});
