import type { ApiResponse } from '~~/app/types/api';
import type { FloorResponse, FloorResponseListTotalPageResult } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event): Promise<FloorResponse[] | FloorResponseListTotalPageResult<FloorResponse>> => {
  const query = getQuery(event);
  const museumId = String(query.museumId || '').trim();

  const response: ApiResponse<FloorResponse[] | FloorResponseListTotalPageResult<FloorResponse>> = await backendFetch(event, '/api/Museum/Floors', {
    query: { museumId },
  });

  return unwrapApiResponse(response) ?? [];
});

