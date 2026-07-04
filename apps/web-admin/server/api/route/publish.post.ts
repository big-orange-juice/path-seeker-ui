import type { ApiResponse } from '~~/app/types/api';
import type { RouteMutationPayload } from '~~/app/types/route';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<RouteMutationPayload>(event);
  const response = await backendFetch<ApiResponse>(event, '/api/Route/Publish', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
