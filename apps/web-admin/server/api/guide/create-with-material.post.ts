import type { ApiResponse } from '~~/app/types/api'
import type { GuideGenerationCreateResponse } from '~~/app/types/guide'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'
import { prepareGuideMaterialFormData } from '~~/server/utils/extractGuideVoiceMaterial'

/**
 * 创建导游并上传生成材料。
 * multipart：`material`（音频或视频；视频由服务端转换为 mp3）/ `txtmaterial`。
 * 对齐 POST /Guide/create-with-material。
 */
export default defineEventHandler(async (event): Promise<GuideGenerationCreateResponse | null> => {
  const formData = await readFormData(event)
  const prepared = await prepareGuideMaterialFormData(formData)

  const response = await backendFetch<ApiResponse<GuideGenerationCreateResponse>>(
    event,
    '/Guide/create-with-material',
    {
      method: 'POST',
      body: prepared,
    },
  )

  return unwrapApiResponse(response) ?? null
})
