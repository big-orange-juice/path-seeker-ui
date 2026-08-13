import type { ApiResponse } from '~~/app/types/api'
import type { NarrationNodePronunciationResponse } from '~~/app/types/narration'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async (event): Promise<NarrationNodePronunciationResponse[]> => {
  const stageId = String(getQuery(event).stageId ?? '').trim()
  if (!stageId) throw createError({ statusCode: 400, message: '缺少节点信息。' })
  const response = await backendFetch<ApiResponse<NarrationNodePronunciationResponse[]>>(event, '/Narration/pronunciations', { query: { stageId } })
  return unwrapApiResponse(response) ?? []
})
