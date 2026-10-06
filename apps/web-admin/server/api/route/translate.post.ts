import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async event => {
  const body = await readBody<{ routeId?: string; clientRequestId?: string }>(event);
  if (typeof body?.routeId !== 'string' || !body.routeId.trim()) throw createError({ statusCode: 400, message: '请选择目标语言路线。' });
  return unwrapApiResponse(await backendFetch<ApiResponse<unknown>>(event, '/Route/Translate', { method: 'POST', body }));
});
