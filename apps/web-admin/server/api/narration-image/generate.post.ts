import type { ApiResponse } from '~~/app/types/api'
import type {
  GenerateRouteStageNarrationImageRequest,
  GenerateRouteStageNarrationImageResponse,
} from '~~/app/types/narration'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/**
 * 提交解说配图 AI 生成任务。
 * 成功后附件会自动绑定到节点；前端手动刷新 detail.images 同步列表。
 */
export default defineEventHandler(async (event): Promise<GenerateRouteStageNarrationImageResponse | null> => {
  const body = await readBody<GenerateRouteStageNarrationImageRequest>(event)
  const stageId = String(body?.stageId ?? '').trim()
  const prompt = String(body?.prompt ?? '').trim()
  const idempotencyKey = String(body?.idempotencyKey ?? '').trim()

  if (!stageId || !prompt || !idempotencyKey) {
    throw createError({
      statusCode: 400,
      message: '缺少站点、画面描述或请求信息。',
    })
  }
  if (prompt.length > 4000) {
    throw createError({
      statusCode: 400,
      message: '画面描述过长，请精简后再试。',
    })
  }
  if (idempotencyKey.length > 128) {
    throw createError({
      statusCode: 400,
      message: '请求标识无效。',
    })
  }

  const referenceImageUrls = Array.isArray(body?.referenceImageUrls)
    ? body.referenceImageUrls
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0)
      .slice(0, 5)
    : []

  // parameters 不传；priority 固定默认 10000（UI 不展示）
  const payload: GenerateRouteStageNarrationImageRequest = {
    stageId,
    prompt,
    idempotencyKey,
    priority: 10000,
  }
  if (referenceImageUrls.length) {
    payload.referenceImageUrls = referenceImageUrls
  }

  const response = await backendFetch<ApiResponse<GenerateRouteStageNarrationImageResponse>>(
    event,
    '/NarrationImage/generate',
    {
      method: 'POST',
      body: payload,
    },
  )

  return unwrapApiResponse(response) ?? null
})
