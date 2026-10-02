import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async event => {
  const body = await readBody<{ id: string }>(event);
  if (typeof body?.id !== 'string' || !body.id.trim()) throw createError({ statusCode: 400, message: '缺少文化点信息。' });
  return unwrapApiResponse(await backendFetch<ApiResponse>(event, '/CulturalPlace/Delete', { method: 'POST', body: { id: body.id } }));
});
