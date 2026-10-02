import type { ApiResponse } from '~~/app/types/api';
import type { BuildOutdoorRouteDraftPayload, BuildOutdoorRouteDraftResponse } from '~~/app/types/route';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async event => {
  const body = await readBody<BuildOutdoorRouteDraftPayload>(event);
  if (typeof body?.museumId !== 'string' || !body.museumId.trim() || !body.title?.trim()
    || !Array.isArray(body.placeIds) || body.placeIds.length < 2
    || body.placeIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(body.placeIds).size !== body.placeIds.length) {
    throw createError({ statusCode: 400, message: '请选择目的地、填写标题，并按顺序选择至少两个不同的文化点。' });
  }
  return unwrapApiResponse(await backendFetch<ApiResponse<BuildOutdoorRouteDraftResponse>>(event, '/Route/BuildOutdoorDraft', { method: 'POST', body }));
});
