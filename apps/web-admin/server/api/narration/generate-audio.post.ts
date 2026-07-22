import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ stageId?: string }>(event);
  const stageId = String(body?.stageId ?? '').trim();

  if (!stageId) {
    throw createError({
      statusCode: 400,
      message: '缺少节点 ID。',
    });
  }

  const response = await backendFetch<ApiResponse<string>>(event, '/Narration/generate-audio', {
    method: 'POST',
    body: {
      stageId,
    },
  });

  return unwrapApiResponse(response);
});
