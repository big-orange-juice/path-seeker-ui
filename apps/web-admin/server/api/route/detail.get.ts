import type { ApiResponse } from '~~/app/types/api';
import type { RouteDetailResponse } from '~~/app/types/route';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event): Promise<RouteDetailResponse | null> => {
  const query = getQuery(event);
  const id = String(query.id || '').trim();

  const response: ApiResponse<RouteDetailResponse> = await backendFetch(event, '/Route/Detail', {
    query: { id },
  });

  return unwrapApiResponse(response);
});
