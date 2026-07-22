import type { ApiResponse } from '~~/app/types/api';
import type { FacilityResponse } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event): Promise<FacilityResponse[]> => {
  const query = getQuery(event);
  const museumId = String(query.museumId || '').trim();

  const response: ApiResponse<FacilityResponse[]> = await backendFetch(event, '/Museum/Facilities', {
    query: { museumId },
  });

  return unwrapApiResponse(response) ?? [];
});
