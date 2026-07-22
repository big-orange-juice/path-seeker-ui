import type { ApiResponse } from '~~/app/types/api'
import type { NarrationDetailResponse } from '~~/app/types/narration'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/** 对齐 docs/schema UpdateNarrationTextRequest */
export interface UpdateNarrationTextBody {
  stageId: string
  narrationText: string
  version?: number
}

export default defineEventHandler(async (event): Promise<NarrationDetailResponse | null> => {
  const body = await readBody<UpdateNarrationTextBody>(event)
  const stageId = String(body?.stageId ?? '').trim()
  const narrationText = String(body?.narrationText ?? '').trim()

  if (!stageId) {
    throw createError({
      statusCode: 400,
      message: '缺少节点 ID。',
    })
  }

  if (!narrationText) {
    throw createError({
      statusCode: 400,
      message: '解说词不能为空。',
    })
  }

  const payload: UpdateNarrationTextBody = {
    stageId,
    narrationText,
  }

  if (typeof body?.version === 'number' && Number.isFinite(body.version) && body.version >= 1) {
    payload.version = Math.trunc(body.version)
  }

  const response = await backendFetch<ApiResponse<NarrationDetailResponse>>(
    event,
    '/Narration/update-text',
    {
      method: 'POST',
      body: payload,
    },
  )

  return unwrapApiResponse(response) ?? null
})
