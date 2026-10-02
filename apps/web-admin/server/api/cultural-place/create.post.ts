import type { ApiResponse } from '~~/app/types/api';
import type { CulturalPlaceDraft } from '~~/app/types/cultural-place';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async event => {
  const body = await readBody<CulturalPlaceDraft>(event);
  if (!body?.museumId || !body.code?.trim() || !body.name?.trim()) throw createError({ statusCode: 400, message: '目的地、编码和名称不能为空。' });
  const payload = {
    museumId: body.museumId, code: body.code, name: body.name, category: body.category,
    address: body.address, description: body.description, recommendedMinutes: body.recommendedMinutes,
    longitude: body.longitude, latitude: body.latitude, coordinateSystem: body.coordinateSystem,
    coverAttachmentId: body.coverAttachmentId, sortOrder: body.sortOrder,
  };
  return unwrapApiResponse(await backendFetch<ApiResponse<string>>(event, '/CulturalPlace/Create', { method: 'POST', body: payload }));
});
