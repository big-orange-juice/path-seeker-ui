import type { ApiResponse } from '~~/app/types/api';
import type { PlatformAssistantManualAnswerResponse } from '~~/app/types/platform-assistant';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

const MAX_QUESTION_LENGTH = 2000;

/**
 * 手册问答：返回答案与出处（章节 + 页码）。
 * 后端契约：PlatformAssistantManualAskRequest { Question(1-2000), TopK(1-20，缺省取配置) }。
 * 手册未配置 19002、索引不可用 19003 由前端按错误码给出明确文案。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ question?: string | null; topK?: number | null }>(event);
  const question = String(body?.question ?? '').trim();

  if (!question) {
    throw createError({
      statusCode: 400,
      message: '问题不能为空。',
    });
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    throw createError({
      statusCode: 400,
      message: `问题过长，最多 ${MAX_QUESTION_LENGTH} 字。`,
    });
  }

  const rawTopK = body?.topK;
  const topK = typeof rawTopK === 'number' && Number.isFinite(rawTopK)
    ? Math.min(20, Math.max(1, Math.trunc(rawTopK)))
    : null;

  const response = await backendFetch<ApiResponse<PlatformAssistantManualAnswerResponse>>(
    event,
    '/PlatformAssistant/manual/ask',
    {
      method: 'POST',
      body: { question, topK },
    },
  );

  return unwrapApiResponse(response);
});
