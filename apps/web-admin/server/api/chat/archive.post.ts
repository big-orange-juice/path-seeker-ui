import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ id?: string | null }>(event);
  const id = String(body?.id ?? '').trim();

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: '缺少会话 ID。',
    });
  }

  const response = await backendFetch<ApiResponse>(event, '/api/Chat/archive', {
    method: 'POST',
    body: { id },
  });

  return unwrapApiResponse(response);
});
