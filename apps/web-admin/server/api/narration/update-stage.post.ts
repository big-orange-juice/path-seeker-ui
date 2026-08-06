import type { ApiResponse } from '~~/app/types/api'
import type {
  UpdateNarrationStageRequest,
  UpdateNarrationStageResponse,
} from '~~/app/types/narration'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/**
 * 编辑 AI 解说节点并同步解说产物元数据。
 * 对齐 POST /Narration/update-stage（含 attachmentIds 配图全量同步）。
 */
export default defineEventHandler(async (event): Promise<UpdateNarrationStageResponse | null> => {
  const body = await readBody<UpdateNarrationStageRequest>(event)
  const stageId = String(body?.stageId ?? '').trim()

  if (!stageId) {
    throw createError({
      statusCode: 400,
      message: '缺少站点信息。',
    })
  }

  const payload: UpdateNarrationStageRequest = {
    stageId,
  }

  if (body?.title !== undefined) {
    payload.title = body.title == null ? null : String(body.title)
  }
  if (body?.subtitle !== undefined) {
    payload.subtitle = body.subtitle == null ? null : String(body.subtitle)
  }
  if (body?.exhibitId !== undefined) {
    payload.exhibitId = body.exhibitId == null ? null : String(body.exhibitId).trim() || null
  }
  if (body?.guideId !== undefined) {
    payload.guideId = body.guideId == null ? null : String(body.guideId).trim() || null
  }
  if (body?.userStyleInput !== undefined) {
    payload.userStyleInput =
      body.userStyleInput == null ? null : String(body.userStyleInput)
  }
  if (body?.sceneContext !== undefined) {
    payload.sceneContext = body.sceneContext == null ? null : String(body.sceneContext)
  }
  if (
    body?.targetDurationSeconds !== undefined
    && body.targetDurationSeconds !== null
    && Number.isFinite(Number(body.targetDurationSeconds))
  ) {
    const sec = Math.trunc(Number(body.targetDurationSeconds))
    payload.targetDurationSeconds = Math.min(600, Math.max(10, sec))
  }
  if (body?.expectedUpdatedAt) {
    payload.expectedUpdatedAt = String(body.expectedUpdatedAt)
  }
  // 配图附件 ID 全量同步；元素一律 string，避免雪花精度丢失
  if (body?.attachmentIds !== undefined) {
    if (body.attachmentIds == null) {
      payload.attachmentIds = null
    } else if (Array.isArray(body.attachmentIds)) {
      payload.attachmentIds = body.attachmentIds
        .map((id) => String(id ?? '').trim())
        .filter(Boolean)
    } else {
      payload.attachmentIds = []
    }
  }

  const response = await backendFetch<ApiResponse<UpdateNarrationStageResponse>>(
    event,
    '/Narration/update-stage',
    {
      method: 'POST',
      body: payload,
    },
  )

  return unwrapApiResponse(response) ?? null
})
