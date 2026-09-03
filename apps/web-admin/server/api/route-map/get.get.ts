import type { ApiResponse } from '~~/app/types/api'
import type { RouteMapDetail } from '~~/app/types/route-map'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'
export default defineEventHandler(async event => unwrapApiResponse(await backendFetch<ApiResponse<RouteMapDetail>>(event, '/RouteMap/Get', { query: { routeId: String(getQuery(event).routeId || '').trim() } })))
