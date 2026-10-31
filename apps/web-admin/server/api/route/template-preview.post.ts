import type { ApiResponse } from '~~/app/types/api'
import type { OutdoorTemplatePreview } from '~~/app/types/outdoor-template'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async event => {
  const body = await readBody<{ routeId: string; fixedRouteCode: string }>(event)
  if (typeof body?.routeId !== 'string' || !body.routeId.trim() || !['A', 'B', 'A+B'].includes(body.fixedRouteCode)) {
    throw createError({ statusCode: 400, message: '请选择固定路线模板。' })
  }
  return unwrapApiResponse(await backendFetch<ApiResponse<OutdoorTemplatePreview>>(event, '/Gameplay/PreviewOutdoorTemplate', { method: 'POST', body }))
})
