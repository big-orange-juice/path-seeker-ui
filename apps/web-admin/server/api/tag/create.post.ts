import type { ApiResponse } from '~~/app/types/api'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'
export default defineEventHandler(async (event) => unwrapApiResponse(await backendFetch<ApiResponse<string>>(event, '/Tag/Create', { method: 'POST', body: await readBody(event) })))