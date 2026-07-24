import type { ApiResponse } from '~~/app/types/api'
import type { RoutePosterResponse } from '~~/app/types/poster'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/**
 * 按路线 ID 拉取海报列表（GET /api/Route/Posters）。
 * routeId 按 string 透传，避免雪花精度丢失。
 */
export default defineEventHandler(async (event): Promise<RoutePosterResponse[]> => {
  const query = getQuery(event)
  const routeId = String(query.routeId ?? '').trim()

  if (!routeId) {
    throw createError({
      statusCode: 400,
      message: '缺少路线标识。',
    })
  }

  const response = await backendFetch<ApiResponse<RoutePosterResponse[] | null>>(
    event,
    '/Route/Posters',
    {
      method: 'GET',
      query: { routeId },
    },
  )

  const data = unwrapApiResponse(response)
  return Array.isArray(data) ? data : []
})
