/** GET /api/Narration/detail 响应（ID 一律按 string 处理） */
export interface NarrationDetailResponse {
  stageId?: string | null
  guideId?: string | null
  guideName?: string | null
  guideVersion?: number
  resolvedStyle?: string | null
  narrationText?: string | null
  textHash?: string | null
  textStatus?: number
  textError?: string | null
  ttsTaskId?: string | null
  audioAttachmentId?: string | null
  audioUrl?: string | null
  audioStatus?: number
  durationMs?: number | null
  version?: number
}

/** POST /api/Narration/update-stage */
export interface UpdateNarrationStageRequest {
  stageId: string
  title?: string | null
  subtitle?: string | null
  exhibitId?: string | null
  guideId?: string | null
  userStyleInput?: string | null
  sceneContext?: string | null
  targetDurationSeconds?: number | null
  expectedUpdatedAt?: string | null
}

export interface UpdateNarrationStageResponse {
  stageId?: string | null
  narrationUpdated?: boolean
  narrationReset?: boolean
  guideId?: string | null
  resolvedStyle?: string | null
  updatedAt?: string | null
}

/** POST /api/Narration/change-guide */
export interface ChangeNarrationGuideRequest {
  stageId: string
  guideId: string
  expectedUpdatedAt?: string | null
}

export interface ChangeNarrationGuideResponse {
  stageId?: string | null
  previousGuideId?: string | null
  guideId?: string | null
  guideName?: string | null
  narrationReset?: boolean
  requiresNarrationGeneration?: boolean
  updatedAt?: string | null
}
