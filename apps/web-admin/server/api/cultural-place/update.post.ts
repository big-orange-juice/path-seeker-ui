import type { ApiResponse } from '~~/app/types/api';
import type { CulturalPlaceDraft } from '~~/app/types/cultural-place';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async event => {
  const body = await readBody<CulturalPlaceDraft>(event);
  if (!body?.id || !body.museumId || !body.code?.trim() || !body.name?.trim()) throw createError({ statusCode: 400, message: '文化点、目的地、编码和名称不能为空。' });
  return unwrapApiResponse(await backendFetch<ApiResponse>(event, '/CulturalPlace/Update', { method: 'POST', body }));
});
