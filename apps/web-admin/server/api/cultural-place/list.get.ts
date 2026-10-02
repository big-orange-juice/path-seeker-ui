import type { ApiResponse } from '~~/app/types/api';
import type { CulturalPlaceRecord } from '~~/app/types/cultural-place';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async event => {
  const query = getQuery(event);
  const museumId = typeof query.museumId === 'string' ? query.museumId.trim() : '';
  if (!museumId) throw createError({ statusCode: 400, message: '请选择所属目的地。' });
  return unwrapApiResponse(await backendFetch<ApiResponse<CulturalPlaceRecord[]>>(event, '/CulturalPlace/ListByMuseum', {
    query: { museumId, enabledOnly: query.enabledOnly === 'true' },
  })) ?? [];
});
