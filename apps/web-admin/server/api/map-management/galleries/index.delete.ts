import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ id: number }>(event);
  const response = await backendFetch<ApiResponse>(event, '/api/Gallery/Delete', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
