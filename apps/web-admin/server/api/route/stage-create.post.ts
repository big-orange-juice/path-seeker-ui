import type { ApiResponse } from '~~/app/types/api'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/** 对齐 docs/schema CreateRouteStageRequest；ID 一律 string 透传 */
export interface CreateRouteStageBody {
  routeId: string
  stageNo?: number
  sortOrder?: number
  title?: string | null
  subtitle?: string | null
  interactionType?: number
  refPuzzleId?: string | null
  refExhibitId?: string | null
  unlockRule?: number
  isRequired?: number
  score?: number
  /** 交互专属参数 JSON 字符串 */
  config?: string | null
  nextRule?: string | null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateRouteStageBody>(event)
  const routeId = String(body?.routeId ?? '').trim()

  if (!routeId) {
    throw createError({
      statusCode: 400,
      message: '缺少路线 ID。',
    })
  }

  const response = await backendFetch<ApiResponse<string>>(event, '/Gameplay/StageCreate', {
    method: 'POST',
    body: {
      ...body,
      routeId,
      refPuzzleId: body?.refPuzzleId != null ? String(body.refPuzzleId) : null,
      refExhibitId: body?.refExhibitId != null ? String(body.refExhibitId) : null,
    },
  })

  return unwrapApiResponse(response)
})
