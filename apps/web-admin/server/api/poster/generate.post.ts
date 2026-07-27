import type { ApiResponse } from '~~/app/types/api'
import type {
  GenerateRoutePosterRequest,
  GenerateRoutePosterResponse,
} from '~~/app/types/poster'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/**
 * 提交路线海报 AI 生成任务。
 * modelName / referenceAttachmentIds / parameters 不传；
 * priority 固定 10000；成功后自动写入海报表，前端手动刷新列表同步。
 */
export default defineEventHandler(async (event): Promise<GenerateRoutePosterResponse | null> => {
  const body = await readBody<GenerateRoutePosterRequest>(event)
  const routeId = String(body?.routeId ?? '').trim()
  const prompt = String(body?.prompt ?? '').trim()

  if (!routeId || !prompt) {
    throw createError({
      statusCode: 400,
      message: '缺少路线或画面描述。',
    })
  }
  if (prompt.length > 4000) {
    throw createError({
      statusCode: 400,
      message: '画面描述过长，请精简后再试。',
    })
  }

  const referenceImageUrls = Array.isArray(body?.referenceImageUrls)
    ? body.referenceImageUrls
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0)
      .slice(0, 5)
    : []

  const payload: GenerateRoutePosterRequest = {
    routeId,
    prompt,
    priority: 10000,
  }
  if (referenceImageUrls.length) {
    payload.referenceImageUrls = referenceImageUrls
  }

  const response = await backendFetch<ApiResponse<GenerateRoutePosterResponse>>(
    event,
    '/Poster/Generate',
    {
      method: 'POST',
      body: payload,
    },
  )

  return unwrapApiResponse(response) ?? null
})
