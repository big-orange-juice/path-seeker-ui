import type { ApiResponse } from '~~/app/types/api'
import type {
  CreateRouteStageNarrationImageRequest,
} from '~~/app/types/narration'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/**
 * 绑定已上传附件为解说配图。
 * 后端返回新建记录 id（string）；前端再刷 detail 拿 imageUrl。
 */
export default defineEventHandler(async (event): Promise<string | null> => {
  const body = await readBody<CreateRouteStageNarrationImageRequest>(event)
  const stageId = String(body?.stageId ?? '').trim()
  const attachmentId = String(body?.attachmentId ?? '').trim()

  if (!stageId || !attachmentId) {
    throw createError({
      statusCode: 400,
      message: '缺少站点或附件信息。',
    })
  }

  const payload: CreateRouteStageNarrationImageRequest = {
    stageId,
    attachmentId,
  }
  if (typeof body?.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
    payload.sortOrder = Math.max(0, Math.round(body.sortOrder))
  }

  const response = await backendFetch<ApiResponse<string>>(event, '/NarrationImage/create', {
    method: 'POST',
    body: payload,
  })

  return unwrapApiResponse(response) ?? null
})
