import type { ApiResponse } from '~~/app/types/api';
import type { AdminRoleOption } from '~~/app/types/admin-user';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event): Promise<AdminRoleOption[]> => {
  const response = await backendFetch<ApiResponse<AdminRoleOption[]>>(event, '/Admin/Roles', {
    method: 'GET',
  });

  const data = unwrapApiResponse(response);
  return (Array.isArray(data) ? data : []).map((item) => ({
    ...item,
    id: String(item.id ?? ''),
    permissions: Array.isArray(item.permissions) ? item.permissions.map(String) : [],
  }));
});
