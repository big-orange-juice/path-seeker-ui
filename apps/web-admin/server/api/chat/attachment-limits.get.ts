import type { ApiResponse } from '~~/app/types/api'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async (event) => {
  const response = await backendFetch<ApiResponse<{ maxAttachmentsPerMessage: number }>>(
    event, '/Chat/attachment-limits',
  )
  return unwrapApiResponse(response)
})
