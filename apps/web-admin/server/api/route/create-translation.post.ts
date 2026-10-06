import type { ApiResponse } from '~~/app/types/api';
import { TOUR_LANGUAGES } from '@path-seeker/ts-shared';
import type { CreateRouteTranslationPayload, RouteTranslationResponse } from '~~/app/types/route';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async event => {
  const body = await readBody<CreateRouteTranslationPayload>(event);
  if (typeof body?.routeId !== 'string' || !body.routeId.trim() || !TOUR_LANGUAGES.some(language => language.value !== 'zh' && language.value === body.locale)) throw createError({ statusCode: 400, message: '请选择中文源路线和目标语言。' });
  return unwrapApiResponse(await backendFetch<ApiResponse<RouteTranslationResponse>>(event, '/Route/CreateTranslation', { method: 'POST', body }));
});
