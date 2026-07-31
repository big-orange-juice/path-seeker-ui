import type { ApiResponse } from '~~/app/types/api'
import type { RouteNarrationTaskStatusResponse } from '~~/app/types/narration'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/**
 * 代理 GET /api/Narration/route-task-status。
 * chat 异步生成解说词后，节点编辑页手动刷新用；routeId 按 string 透传。
 */
export default defineEventHandler(async (event): Promise<RouteNarrationTaskStatusResponse | null> => {
  const query = getQuery(event)
  const routeId = String(query.routeId ?? '').trim()

  if (!routeId) {
    throw createError({
      statusCode: 400,
      message: '缺少路线 ID。',
    })
  }

  const response = await backendFetch<ApiResponse<RouteNarrationTaskStatusResponse>>(
    event,
    '/Narration/route-task-status',
    {
      method: 'GET',
      query: {
        routeId,
      },
    },
  )

  return unwrapApiResponse(response) ?? null
})
