import type { ApiResponse } from '~~/app/types/api'
import type { GuideGenerationCreateResponse } from '~~/app/types/guide'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/**
 * 更新导游并可选上传生成材料。
 * multipart：`material`（mp3/mp4 音色）/ `txtmaterial`（txt 语义资料）。
 * 对齐 POST /Guide/update-with-material。
 */
export default defineEventHandler(async (event): Promise<GuideGenerationCreateResponse | null> => {
  const formData = await readFormData(event)

  const response = await backendFetch<ApiResponse<GuideGenerationCreateResponse>>(
    event,
    '/Guide/update-with-material',
    {
      method: 'POST',
      body: formData,
    },
  )

  return unwrapApiResponse(response) ?? null
})
