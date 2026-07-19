import type { ApiResponse } from '~~/app/types/api'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

/** 对齐 docs/schema UpdateRouteStageRequest；ID 一律 string 透传 */
export interface UpdateRouteStageBody {
  id: string
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
  expectedUpdatedAt?: string | null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateRouteStageBody>(event)
  const id = String(body?.id ?? '').trim()
  const routeId = String(body?.routeId ?? '').trim()

  if (!id || !routeId) {
    throw createError({
      statusCode: 400,
      message: '缺少节点 ID 或路线 ID。',
    })
  }

  const response = await backendFetch<ApiResponse>(event, '/api/Gameplay/StageUpdate', {
    method: 'POST',
    body: {
      ...body,
      id,
      routeId,
    },
  })

  return unwrapApiResponse(response)
})
