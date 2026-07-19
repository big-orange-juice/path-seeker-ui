import type { ApiResponse } from '~~/app/types/api';
import type { RouteAuditPayload } from '~~/app/types/route';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<RouteAuditPayload>(event);
  const response = await backendFetch<ApiResponse>(event, '/api/Route/Audit', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
