import type { ApiResponse } from '~~/app/types/api'
import type { RoutePosterResponse } from '~~/app/types/poster'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async (event): Promise<RoutePosterResponse | null> => {
  const id = String(getQuery(event).id ?? '').trim()
  if (!id) throw createError({ statusCode: 400, message: '缺少海报标识。' })
  const response = await backendFetch<ApiResponse<RoutePosterResponse>>(event, '/Poster/Get', {
    method: 'GET',
    query: { id },
  })
  return unwrapApiResponse(response) ?? null
})