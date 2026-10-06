import type { ApiResponse } from '~~/app/types/api';
import type { PlatformAssistantManualSearchResponse } from '~~/app/types/platform-assistant';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

const DEFAULT_TOP_K = 5;

/**
 * 手册章节检索：命中章节返回章节标题、页码区间（PageStart/PageEnd）与片段。
 * 关键词为空后端返回 400；手册未配置 19002、索引不可用 19003 由前端按错误码给出明确文案。
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const keyword = String(query.keyword ?? '').trim();

  if (!keyword) {
    throw createError({
      statusCode: 400,
      message: '检索关键词不能为空。',
    });
  }

  const rawTopK = Number(String(query.topK ?? '').trim());
  const topK = Number.isFinite(rawTopK) && rawTopK >= 1
    ? Math.min(20, Math.trunc(rawTopK))
    : DEFAULT_TOP_K;

  const response = await backendFetch<ApiResponse<PlatformAssistantManualSearchResponse>>(
    event,
    '/PlatformAssistant/manual/search',
    {
      method: 'GET',
      query: { keyword, topK },
    },
  );

  return unwrapApiResponse(response);
});
