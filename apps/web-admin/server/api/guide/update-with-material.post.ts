import type { ApiResponse } from '~~/app/types/api'
import type { GuideGenerationCreateResponse } from '~~/app/types/guide'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'
import { prepareGuideMaterialFormData } from '~~/server/utils/extractGuideVoiceMaterial'

/**
 * 更新导游并可选上传生成材料。
 * multipart：`material`（音频或视频；视频服务端 ffmpeg 抽音为 mp3）/ `txtmaterial`。
 * 对齐 POST /Guide/update-with-material。
 */
export default defineEventHandler(async (event): Promise<GuideGenerationCreateResponse | null> => {
  const formData = await readFormData(event)
  const prepared = await prepareGuideMaterialFormData(formData)

  const response = await backendFetch<ApiResponse<GuideGenerationCreateResponse>>(
    event,
    '/Guide/update-with-material',
    {
      method: 'POST',
      body: prepared,
    },
  )

  return unwrapApiResponse(response) ?? null
})
