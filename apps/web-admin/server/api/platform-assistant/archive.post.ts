import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/** 归档平台助手会话（会话正在执行时后端返回 409 冲突）。 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ id?: string | null }>(event);
  const id = String(body?.id ?? '').trim();

  if (!id) {
    throw createError({
      statusCode: 400,
      message: '缺少平台助手会话 ID（id）。',
    });
  }

  const response = await backendFetch<ApiResponse>(event, '/PlatformAssistant/archive', {
    method: 'POST',
    body: { id },
  });

  return unwrapApiResponse(response);
});
