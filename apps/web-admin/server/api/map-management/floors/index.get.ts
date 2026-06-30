import type { ApiResponse } from '~~/app/types/api';
import type { FloorResponse } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event): Promise<FloorResponse[]> => {
  const query = getQuery(event);
  const museumId = Number(query.museumId || 0);

  const response: ApiResponse<FloorResponse[]> = await backendFetch(event, '/api/Museum/Floors', {
    query: { museumId },
  });

  return unwrapApiResponse(response) ?? [];
});
