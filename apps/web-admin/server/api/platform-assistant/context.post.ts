import type { ApiResponse } from '~~/app/types/api';
import type {
  PlatformAssistantContextRequest,
  PlatformAssistantContextResponse,
} from '~~/app/types/platform-assistant';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

const trimNullable = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  return text ? text : null;
};

/**
 * 提交页面上下文（显式字段）由后端重新核验并裁剪。
 *
 * 前端提交值一律视为"未授权候选"：后端用 IRouteDataPermissionService /
 * IGuideDataPermissionService 校验后返回保留的对象与 dropped（字段 + 原因）。
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const sessionId = String(query.sessionId ?? '').trim();

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: '缺少平台助手会话 ID（sessionId）。',
    });
  }

  const body = await readBody<PlatformAssistantContextRequest>(event);

  const response = await backendFetch<ApiResponse<PlatformAssistantContextResponse>>(
    event,
    '/PlatformAssistant/context',
    {
      method: 'POST',
      query: { sessionId },
      body: {
        path: trimNullable(body?.path),
        museumId: trimNullable(body?.museumId),
        collectionId: trimNullable(body?.collectionId),
        routeId: trimNullable(body?.routeId),
        stageId: trimNullable(body?.stageId),
        guideId: trimNullable(body?.guideId),
      },
    },
  );

  return unwrapApiResponse(response);
});
