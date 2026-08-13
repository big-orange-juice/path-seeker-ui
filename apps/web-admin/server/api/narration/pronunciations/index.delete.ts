import type { ApiResponse } from '~~/app/types/api'
import type { DeleteNarrationPronunciationRequest, NarrationNodePronunciationResponse } from '~~/app/types/narration'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async (event): Promise<NarrationNodePronunciationResponse[]> => {
  const body = await readBody<Partial<DeleteNarrationPronunciationRequest>>(event)
  const payload = { stageId: String(body?.stageId ?? '').trim(), phrase: String(body?.phrase ?? '').trim() }
  if (!payload.stageId || !payload.phrase) throw createError({ statusCode: 400, message: '节点和词语不能为空。' })
  const response = await backendFetch<ApiResponse<NarrationNodePronunciationResponse[]>>(event, '/Narration/pronunciations', { method: 'DELETE', body: payload })
  return unwrapApiResponse(response) ?? []
})
