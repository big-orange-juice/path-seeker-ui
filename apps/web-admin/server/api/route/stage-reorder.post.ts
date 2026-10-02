import type { ApiResponse } from '~~/app/types/api'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async event => {
  const body = await readBody<{ routeId: string; orderedStageIds: string[] }>(event)
  if (typeof body?.routeId !== 'string' || !Array.isArray(body.orderedStageIds) || body.orderedStageIds.some(id => typeof id !== 'string' || !id.trim())
    || new Set(body.orderedStageIds).size !== body.orderedStageIds.length) throw createError({ statusCode: 400, message: '请提交完整且不重复的站点顺序。' })
  return unwrapApiResponse(await backendFetch<ApiResponse>(event, '/Gameplay/StageReorder', { method: 'POST', body }))
})
