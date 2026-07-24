/**
 * 路线海报相关类型。
 * 主键 / 附件 ID / 路线 ID 一律 string，避免雪花精度丢失。
 */

/** POST /api/Poster/Generate — 异步生成海报，成功后自动写入海报表 */
export interface GenerateRoutePosterRequest {
  routeId: string
  prompt: string
  /** 可选；前端默认不传 */
  modelName?: string | null
  /** 可选；最多 5，前端默认不传，优先用 URL 参考 */
  referenceAttachmentIds?: string[] | null
  /** 可选；最多 5，节点图 / 外链 */
  referenceImageUrls?: string[] | null
  /** 默认 10000，UI 不展示 */
  priority?: number | null
  /** 可选；前端默认不传 */
  parameters?: Record<string, unknown> | null
}

export interface GenerateRoutePosterResponse {
  taskId?: string | null
  routeId?: string | null
  status?: number
  referenceImageCount?: number
  autoBind?: boolean
}

/** GET /api/Route/Posters 或 POST /api/Poster/PageList 条目 */
export interface RoutePosterResponse {
  id?: string | null
  routeId?: string | null
  attachmentId?: string | null
  imageUrl?: string | null
  title?: string | null
  description?: string | null
  sortOrder?: number
  status?: number
  createdAt?: string | null
  updatedAt?: string | null
}

/** 弹窗内从节点收集的候选参考图 */
export interface RoutePosterCandidateImage {
  url: string
  /** 展示标签，如「封面」「第 2 站 · 拼图」 */
  label: string
  /** 来源：cover | node | narration | external */
  source: 'cover' | 'node' | 'narration' | 'external'
  stageId?: string | null
}
