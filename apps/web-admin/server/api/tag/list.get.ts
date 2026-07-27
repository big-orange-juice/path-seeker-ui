import type { ApiResponse } from '~~/app/types/api'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'
export default defineEventHandler(async (event) => {
  const category = String(getQuery(event).category ?? '').trim()
  const response = await backendFetch<ApiResponse<unknown[]>>(event, '/Tag/List', { query: { category: category || undefined } })
  return unwrapApiResponse(response) ?? []
})