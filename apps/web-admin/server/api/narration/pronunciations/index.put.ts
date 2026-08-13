import type { ApiResponse } from '~~/app/types/api'
import type { NarrationNodePronunciationResponse, UpdateNarrationPronunciationRequest } from '~~/app/types/narration'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async (event): Promise<NarrationNodePronunciationResponse[]> => {
  const body = await readBody<Partial<UpdateNarrationPronunciationRequest>>(event)
  const payload: UpdateNarrationPronunciationRequest = { stageId: String(body?.stageId ?? '').trim(), originalPhrase: String(body?.originalPhrase ?? '').trim(), phrase: String(body?.phrase ?? '').trim(), pronunciation: String(body?.pronunciation ?? '').trim() }
  if (!payload.stageId || !payload.originalPhrase || !payload.phrase || !payload.pronunciation) throw createError({ statusCode: 400, message: '节点、原词语、新词语和拼音不能为空。' })
  const response = await backendFetch<ApiResponse<NarrationNodePronunciationResponse[]>>(event, '/Narration/pronunciations', { method: 'PUT', body: payload })
  return unwrapApiResponse(response) ?? []
})
