import type { ApiResponse } from '~~/app/types/api';
import type { CulturalPlaceExtra, CulturalPlaceArchive } from '~~/app/types/cultural-place';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async event => {
  const body = await readBody<{ placeId: string; extraList?: CulturalPlaceExtra[] | null; archive?: CulturalPlaceArchive | null }>(event);
  if (!body?.placeId) throw createError({ statusCode: 400, message: '景点 ID 不能为空。' });
  return unwrapApiResponse(await backendFetch<ApiResponse>(event, '/CulturalPlace/SaveMetadata', { method: 'POST', body }));
});
