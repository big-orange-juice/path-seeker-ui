import type { ApiResponse } from '~~/app/types/api';
import type { ChatMessageResponse } from '~~/app/types/chat';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const sessionId = String(query.sessionId ?? '').trim();

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: '缺少会话 ID。',
    });
  }

  const response = await backendFetch<ApiResponse<ChatMessageResponse[]>>(event, '/api/Chat/history', {
    method: 'GET',
    query: {
      sessionId,
    },
  });

  return unwrapApiResponse(response) ?? [];
});
