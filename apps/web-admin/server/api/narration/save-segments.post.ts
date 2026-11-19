import type { ApiResponse } from '~~/app/types/api'
import type { NarrationDetailResponse, SaveNarrationSegmentsRequest } from '~~/app/types/narration'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async event => {
  const body = await readBody<SaveNarrationSegmentsRequest>(event)
  if (typeof body?.stageId !== 'string' || !body.stageId.trim() || !Array.isArray(body.segments)
    || body.segments.some(segment => typeof segment.text !== 'string' || !segment.text.trim())) {
    throw createError({ statusCode: 400, message: '请填写站点和每段讲解正文。' })
  }
  if (body.videoTriggerPercent != null && (!Number.isInteger(body.videoTriggerPercent) || body.videoTriggerPercent < 0 || body.videoTriggerPercent > 99)) {
    throw createError({ statusCode: 400, message: '视频插播进度请填写0至99的整数。' })
  }
  return unwrapApiResponse(await backendFetch<ApiResponse<NarrationDetailResponse>>(event, '/Narration/save-segments', { method: 'POST', body }))
})
