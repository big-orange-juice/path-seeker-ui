import type { ApiResponse } from '~~/app/types/api'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/**
 * 对齐 GET /api/Guide/style-reference-files?id=
 * 返回风格参考文件地址列表（string[]）。
 */
export default defineEventHandler(async (event): Promise<string[]> => {
  const query = getQuery(event)
  // 雪花 ID 按 string 透传，禁止 Number()
  const id = String(query.id || '').trim()
  if (!id) {
    throw createError({
      statusCode: 400,
      message: '缺少导游 ID。',
    })
  }

  const response = await backendFetch<ApiResponse<string[]>>(
    event,
    '/api/Guide/style-reference-files',
    {
      query: { id },
    },
  )

  const data = unwrapApiResponse(response)
  if (!Array.isArray(data)) {
    return []
  }

  return data
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
})
