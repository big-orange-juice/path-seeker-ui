import type { ApiResponse } from '~~/app/types/api'
import type { OutdoorTemplatePreview } from '~~/app/types/outdoor-template'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async event => {
  const body = await readBody<{ routeId: string; fixedRouteCode: string; previewToken: string }>(event)
  if (typeof body?.routeId !== 'string' || !body.routeId.trim() || !['A', 'B', 'A+B'].includes(body.fixedRouteCode)
    || typeof body.previewToken !== 'string' || !body.previewToken.trim()) {
    throw createError({ statusCode: 400, message: '请先预览模板变更。' })
  }
  return unwrapApiResponse(await backendFetch<ApiResponse<OutdoorTemplatePreview>>(event, '/Gameplay/ApplyOutdoorTemplate', { method: 'POST', body }))
})
