import type { ApiResponse } from '~~/app/types/api';
import type { NarrationDetailResponse } from '~~/app/types/narration';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event): Promise<NarrationDetailResponse | null> => {
  const query = getQuery(event);
  const stageId = String(query.stageId ?? '').trim();

  if (!stageId) {
    throw createError({
      statusCode: 400,
      message: '缺少节点 ID。',
    });
  }

  // stageId 雪花 ID 按字符串透传，避免 JS 精度丢失
  const response = await backendFetch<ApiResponse<NarrationDetailResponse>>(event, '/api/Narration/detail', {
    method: 'GET',
    query: {
      stageId,
    },
  });

  return unwrapApiResponse(response) ?? null;
});
