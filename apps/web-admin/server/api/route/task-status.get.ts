import type { ApiResponse } from '~~/app/types/api'
import type { RouteTaskSummaryResponse } from '~~/app/types/route'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/**
 * 代理 GET /api/Route/TaskStatus。
 * 列表「生成中」补进度百分比；routeId 按 string 透传。
 */
export default defineEventHandler(async (event): Promise<RouteTaskSummaryResponse | null> => {
  const query = getQuery(event)
  const routeId = String(query.routeId ?? '').trim()

  if (!routeId) {
    throw createError({
      statusCode: 400,
      message: '缺少路线 ID。',
    })
  }

  const response = await backendFetch<ApiResponse<RouteTaskSummaryResponse>>(
    event,
    '/Route/TaskStatus',
    {
      method: 'GET',
      query: {
        routeId,
      },
    },
  )

  return unwrapApiResponse(response) ?? null
})
