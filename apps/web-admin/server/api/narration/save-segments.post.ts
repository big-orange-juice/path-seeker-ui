import type { ApiResponse } from '~~/app/types/api'
import type { NarrationDetailResponse, SaveNarrationSegmentsRequest } from '~~/app/types/narration'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async event => {
  const body = await readBody<SaveNarrationSegmentsRequest>(event)
  if (typeof body?.stageId !== 'string' || !body.stageId.trim() || !Array.isArray(body.segments)
    || body.segments.some(segment => typeof segment.text !== 'string' || !segment.text.trim())) {
    throw createError({ statusCode: 400, message: '请填写站点和每段讲解正文。' })
  }
  return unwrapApiResponse(await backendFetch<ApiResponse<NarrationDetailResponse>>(event, '/Narration/save-segments', { method: 'POST', body }))
})
