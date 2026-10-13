import type { ApiResponse } from '~~/app/types/api'
import type { RouteMapDetail } from '~~/app/types/route-map'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'
export default defineEventHandler(async event => unwrapApiResponse(await backendFetch<ApiResponse<RouteMapDetail>>(event, '/RouteMap/SaveSegment', { method: 'POST', signal: AbortSignal.timeout(80000), body: await readBody<Record<string, unknown>>(event) })))
