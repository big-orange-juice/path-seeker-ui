import type { ApiResponse } from '~~/app/types/api';
import type { CulturalPlaceRecord } from '~~/app/types/cultural-place';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async event => {
  const id = String(getRouterParam(event, 'id') || '').trim();
  if (!id || id === '0') throw createError({ statusCode: 400, message: '景点 ID 不能为空。' });
  return unwrapApiResponse(await backendFetch<ApiResponse<CulturalPlaceRecord>>(event, '/CulturalPlace/Get', { query: { id } }));
});
