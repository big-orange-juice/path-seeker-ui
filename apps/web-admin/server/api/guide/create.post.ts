import type { ApiResponse } from '~~/app/types/api'
import type { SaveGuideRequest } from '~~/app/types/guide'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async (event) => {
  const body = await readBody<SaveGuideRequest>(event)
  const response = await backendFetch<ApiResponse<string>>(event, '/api/Guide/create', {
    method: 'POST',
    body,
  })

  return unwrapApiResponse(response)
})
