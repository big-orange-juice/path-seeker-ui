import type { ApiResponse } from '~~/app/types/api';
import type { PlatformAssistantConfirmResponse } from '~~/app/types/platform-assistant';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/**
 * 写入类工具逐次确认：把 SSE confirmation.required 里下发的确认令牌
 * 升级为一次性执行许可（后端用后即焚，令牌过期/已用返回 409 冲突）。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ sessionId?: string | null; confirmationToken?: string | null }>(event);
  const sessionId = String(body?.sessionId ?? '').trim();
  const confirmationToken = String(body?.confirmationToken ?? '').trim();

  if (!sessionId || !confirmationToken) {
    throw createError({
      statusCode: 400,
      message: '缺少会话 ID 或确认令牌，无法确认写操作。',
    });
  }

  const response = await backendFetch<ApiResponse<PlatformAssistantConfirmResponse>>(
    event,
    '/PlatformAssistant/confirm',
    {
      method: 'POST',
      body: { sessionId, confirmationToken },
    },
  );

  return unwrapApiResponse(response);
});
