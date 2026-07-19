import type { ApiResponse } from '~~/app/types/api'
import type { DeleteGuideRequest } from '~~/app/types/guide'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async (event) => {
  const body = await readBody<DeleteGuideRequest>(event)
  const id = String(body?.id || '').trim()
  if (!id) {
    throw createError({
      statusCode: 400,
      message: '缺少导游 ID。',
    })
  }

  const response = await backendFetch<ApiResponse>(event, '/api/Guide/delete', {
    method: 'POST',
    body: {
      id,
      replacementGuideId: body.replacementGuideId
        ? String(body.replacementGuideId).trim() || null
        : null,
    },
  })

  return unwrapApiResponse(response)
})
