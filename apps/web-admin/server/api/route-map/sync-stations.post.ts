import type { ApiResponse } from '~~/app/types/api'
import type { RouteMapDetail } from '~~/app/types/route-map'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'
export default defineEventHandler(async event => unwrapApiResponse(await backendFetch<ApiResponse<RouteMapDetail>>(event, '/RouteMap/SyncStations', { method: 'POST', body: await readBody<{ routeId: string }>(event) })))
