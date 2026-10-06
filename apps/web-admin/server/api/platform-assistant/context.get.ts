import type { ApiResponse } from '~~/app/types/api';
import type { PlatformAssistantContextResponse } from '~~/app/types/platform-assistant';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/** 读取最近一次已核验的页面上下文（会话未提交过时后端返回空上下文）。 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const sessionId = String(query.sessionId ?? '').trim();

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: '缺少平台助手会话 ID（sessionId）。',
    });
  }

  const response = await backendFetch<ApiResponse<PlatformAssistantContextResponse>>(
    event,
    '/PlatformAssistant/context',
    {
      method: 'GET',
      query: { sessionId },
    },
  );

  return unwrapApiResponse(response);
});
