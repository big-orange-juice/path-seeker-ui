import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '').trim();
  const response = await backendFetch<ApiResponse>(event, '/api/Exhibit/Delete', {
    method: 'POST',
    body: { id },
  });

  return unwrapApiResponse(response);
});
