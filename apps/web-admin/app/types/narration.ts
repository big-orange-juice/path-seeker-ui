/**
 * 解说节点配图（detail.images）。
 * 主键 / 附件 ID 一律 string，避免雪花精度丢失。
 */
export interface RouteStageNarrationImageResponse {
  id?: string | null
  stageId?: string | null
  attachmentId?: string | null
  imageUrl?: string | null
  sortOrder?: number
  createdAt?: string | null
  updatedAt?: string | null
}

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
  images?: RouteStageNarrationImageResponse[] | null
}

/** POST /api/NarrationImage/create */
export interface CreateRouteStageNarrationImageRequest {
  stageId: string
  attachmentId: string
  sortOrder?: number | null
}

/** POST /api/NarrationImage/update */
export interface UpdateRouteStageNarrationImageRequest {
  id: string
  attachmentId: string
  sortOrder?: number
}

/**
 * POST /api/NarrationImage/generate — 异步生成配图。
 * 任务成功后附件自动绑定节点；前端轮询 detail.images 同步。
 * parameters 前端不传；priority 默认 10000 且 UI 不展示。
 */
export interface GenerateRouteStageNarrationImageRequest {
  stageId: string
  prompt: string
  referenceImageUrls?: string[] | null
  priority?: number | null
  parameters?: Record<string, unknown> | null
  idempotencyKey: string
}

export interface GenerateRouteStageNarrationImageResponse {
  taskId?: string | null
  stageId?: string | null
  status?: number
  referenceImageCount?: number
  autoBind?: boolean
}

/**
 * POST /api/Narration/update-stage
 * attachmentIds：按顺序全量保存配图附件（雪花 ID string）；
 * 与 POST /NarrationImage/create 并存，可即时 create，也可保存时批量同步。
 */
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
  /** 配图附件 ID 列表（有序）；传空数组表示清空 */
  attachmentIds?: string[] | null
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
