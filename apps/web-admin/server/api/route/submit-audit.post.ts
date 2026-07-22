import type { ApiResponse } from '~~/app/types/api';
import type { RouteIdPayload } from '~~/app/types/route';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<RouteIdPayload>(event);
  const response = await backendFetch<ApiResponse>(event, '/Route/SubmitAudit', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
