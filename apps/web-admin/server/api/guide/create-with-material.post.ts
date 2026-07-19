import type { ApiResponse } from '~~/app/types/api'
import type { GuideGenerationCreateResponse } from '~~/app/types/guide'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/**
 * 创建导游并上传语义材料（txt / mp3 / mp4）。
 * 对齐 POST /api/Guide/create-with-material（multipart）。
 */
export default defineEventHandler(async (event): Promise<GuideGenerationCreateResponse | null> => {
  const formData = await readFormData(event)

  const response = await backendFetch<ApiResponse<GuideGenerationCreateResponse>>(
    event,
    '/api/Guide/create-with-material',
    {
      method: 'POST',
      body: formData,
    },
  )

  return unwrapApiResponse(response) ?? null
})
