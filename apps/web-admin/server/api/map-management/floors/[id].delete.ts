import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  const response = await backendFetch<ApiResponse>(event, '/api/Museum/DeleteFloor', {
    method: 'POST',
    body: { id },
  });

  return unwrapApiResponse(response);
});
