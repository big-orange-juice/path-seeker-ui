import type { ApiResponse } from '~~/app/types/api'
import type { NarrationNodePronunciationResponse, SaveNarrationPronunciationRequest } from '~~/app/types/narration'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async (event): Promise<NarrationNodePronunciationResponse[]> => {
  const body = await readBody<Partial<SaveNarrationPronunciationRequest>>(event)
  const payload: SaveNarrationPronunciationRequest = { stageId: String(body?.stageId ?? '').trim(), phrase: String(body?.phrase ?? '').trim(), pronunciation: String(body?.pronunciation ?? '').trim() }
  if (!payload.stageId || !payload.phrase || !payload.pronunciation) throw createError({ statusCode: 400, message: '节点、词语和拼音不能为空。' })
  const response = await backendFetch<ApiResponse<NarrationNodePronunciationResponse[]>>(event, '/Narration/pronunciations', { method: 'POST', body: payload })
  return unwrapApiResponse(response) ?? []
})
