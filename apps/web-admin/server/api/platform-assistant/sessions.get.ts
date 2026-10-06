import type { ApiResponse } from '~~/app/types/api';
import type { ChatSessionResponse } from '~~/app/types/chat';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/** 当前账号的平台助手会话列表（scene=platform）。 */
export default defineEventHandler(async (event) => {
  const response = await backendFetch<ApiResponse<ChatSessionResponse[]>>(
    event,
    '/PlatformAssistant/sessions',
    { method: 'GET' },
  );

  return unwrapApiResponse(response) ?? [];
});
