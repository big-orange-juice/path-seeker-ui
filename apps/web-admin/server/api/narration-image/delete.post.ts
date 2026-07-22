import type { ApiResponse } from '~~/app/types/api'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/** 删除解说配图；id 为雪花主键，按 string 透传 */
export default defineEventHandler(async (event): Promise<boolean> => {
  const body = await readBody<{ id?: string | null }>(event)
  const id = String(body?.id ?? '').trim()

  if (!id) {
    throw createError({
      statusCode: 400,
      message: '缺少配图 ID。',
    })
  }

  const response = await backendFetch<ApiResponse>(event, '/NarrationImage/delete', {
    method: 'POST',
    body: { id },
  })

  unwrapApiResponse(response)
  return true
})
