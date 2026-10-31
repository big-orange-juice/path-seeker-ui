import type { ApiResponse } from '~~/app/types/api'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async event => {
  const body = await readBody<{ stageId: string; prerequisiteStageId: string | null }>(event)
  if (typeof body?.stageId !== 'string' || !body.stageId.trim()
    || (body.prerequisiteStageId != null && typeof body.prerequisiteStageId !== 'string')) {
    throw createError({ statusCode: 400, message: '请选择有效的站点。' })
  }
  return unwrapApiResponse(await backendFetch<ApiResponse>(event, '/Gameplay/StageAutoTriggerUpdate', { method: 'POST', body }))
})
