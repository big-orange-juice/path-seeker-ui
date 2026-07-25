import type { ApiResponse } from '~~/app/types/api'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/** 对齐 docs/schema IdRequest；节点主键 string 透传 */
export interface DeleteRouteStageBody {
  id: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<DeleteRouteStageBody>(event)
  const id = String(body?.id ?? '').trim()

  if (!id) {
    throw createError({
      statusCode: 400,
      message: '缺少节点 ID。',
    })
  }

  const response = await backendFetch<ApiResponse>(event, '/Gameplay/StageDelete', {
    method: 'POST',
    body: { id },
  })

  return unwrapApiResponse(response)
})
