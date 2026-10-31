import type { ApiResponse } from '~~/app/types/api';
import type { BuildOutdoorRouteDraftPayload, BuildOutdoorRouteDraftResponse } from '~~/app/types/route';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async event => {
  const body = await readBody<BuildOutdoorRouteDraftPayload>(event);
  if (typeof body?.museumId !== 'string' || !body.museumId.trim() || !body.title?.trim()
    || !['A', 'B', 'A+B', 'D'].includes(body.fixedRouteCode)
    || !Array.isArray(body.placeIds)
    || (body.fixedRouteCode === 'D' && body.placeIds.length !== 0)
    || body.placeIds.some(id => typeof id !== 'string' || !id.trim())) {
    throw createError({ statusCode: 400, message: '请选择目的地和线路，填写路线标题；自定义 D 线从空白路线开始。' });
  }
  return unwrapApiResponse(await backendFetch<ApiResponse<BuildOutdoorRouteDraftResponse>>(event, '/Route/BuildOutdoorDraft', { method: 'POST', body }));
});
