import type { ApiResponse } from '~~/app/types/api';
import type { ChatMessageResponse } from '~~/app/types/chat';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/** 平台助手会话历史消息。 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const sessionId = String(query.sessionId ?? '').trim();

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: '缺少平台助手会话 ID（sessionId）。',
    });
  }

  const response = await backendFetch<ApiResponse<ChatMessageResponse[]>>(
    event,
    '/PlatformAssistant/history',
    {
      method: 'GET',
      query: { sessionId },
    },
  );

  return unwrapApiResponse(response) ?? [];
});
