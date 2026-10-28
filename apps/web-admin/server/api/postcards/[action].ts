import type { ApiResponse } from '~~/app/types/api'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

const actions: Record<string, { path: string; method: 'GET' | 'POST' }> = {
  templates: { path: 'Templates', method: 'GET' },
  'save-template': { path: 'SaveTemplate', method: 'POST' },
  node: { path: 'Node', method: 'GET' },
  'save-node': { path: 'SaveNode', method: 'POST' },
}

export default defineEventHandler(async event => {
  const action = actions[getRouterParam(event, 'action') || '']
  if (!action || event.method !== action.method) throw createError({ statusCode: 405, message: '不支持此操作' })
  const query = getQuery(event)
  return unwrapApiResponse(await backendFetch<ApiResponse<unknown>>(event, `/Postcard/${action.path}`, {
    method: action.method,
    query: action.method === 'GET' && typeof query.stageId === 'string' ? { stageId: query.stageId } : undefined,
    body: action.method === 'POST' ? await readBody(event) : undefined,
  }))
})
