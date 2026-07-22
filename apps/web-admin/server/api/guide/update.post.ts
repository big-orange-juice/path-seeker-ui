import type { ApiResponse } from '~~/app/types/api'
import type { UpdateGuideRequest } from '~~/app/types/guide'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateGuideRequest>(event)
  const response = await backendFetch<ApiResponse>(event, '/Guide/update', {
    method: 'POST',
    body,
  })

  return unwrapApiResponse(response)
})
