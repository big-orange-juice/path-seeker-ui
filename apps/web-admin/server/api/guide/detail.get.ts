import type { ApiResponse } from '~~/app/types/api'
import type { GuideResponse } from '~~/app/types/guide'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async (event): Promise<GuideResponse | null> => {
  const query = getQuery(event)
  // 雪花 ID 按 string 透传，禁止 Number()
  const id = String(query.id || '').trim()
  if (!id) {
    throw createError({
      statusCode: 400,
      message: '缺少导游 ID。',
    })
  }

  const response = await backendFetch<ApiResponse<GuideResponse>>(event, '/api/Guide/detail', {
    query: { id },
  })

  return unwrapApiResponse(response)
})
