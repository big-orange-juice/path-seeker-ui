import type { ApiResponse } from '~~/app/types/api'
import type { TtsVoiceResponse } from '~~/app/types/guide'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/**
 * 查询公开音色与当前用户私有音色。
 * 对齐 GET /api/TtsVoice/list
 */
export default defineEventHandler(async (event): Promise<TtsVoiceResponse[]> => {
  const query = getQuery(event)
  const keyword = String(query.keyword || query.Keyword || '').trim()
  const voiceType = String(query.voiceType || query.VoiceType || '').trim()

  const response = await backendFetch<ApiResponse<TtsVoiceResponse[]>>(
    event,
    '/api/TtsVoice/list',
    {
      query: {
        Keyword: keyword || undefined,
        VoiceType: voiceType || undefined,
      },
    },
  )

  const data = unwrapApiResponse(response)
  return Array.isArray(data) ? data : []
})
