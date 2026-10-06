import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/**
 * 创建平台助手会话。
 * 后端固定 scene=platform 且不绑定 routeId/stageId（ContextRouteId 一律为 null），
 * 因此这里只转发 title，避免与页面内 Chat 的会话上下文混淆。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ title?: string | null }>(event);
  const title = String(body?.title ?? '').trim();

  const response = await backendFetch<ApiResponse<string>>(event, '/PlatformAssistant/sessions', {
    method: 'POST',
    body: {
      title: title ? title.slice(0, 256) : null,
    },
  });

  return unwrapApiResponse(response);
});
