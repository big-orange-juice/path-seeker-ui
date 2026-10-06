/**
 * 节点额外音频（讲解前 / 讲解后播放的文件音频）。
 *
 * 对齐后端 `NarrationExtraAudioController`（§3 节点额外音频）：
 * - 前缀 `/api/NarrationExtraAudio`，全部 `[AdminOnly]`；
 * - ID 一律按 string 处理，避免雪花精度丢失；
 * - 时长来自附件元数据，为空时界面显示「时长待确认」。
 */

/** 播放位置：讲解前 / 讲解后 */
export type ExtraAudioPosition = 'before' | 'after'

/** 单条额外音频（GET list 的 before/after 数组元素） */
export interface ExtraAudioItem {
  id: string
  stageId: string
  attachmentId: string
  /** 可播放地址；公开地址或签名地址，与讲解音频一致 */
  audioUrl: string | null
  position: ExtraAudioPosition
  sortOrder: number
  title: string | null
  /** 1=启用 0=停用 */
  enabled: number
  /** 秒；为空表示附件元数据缺失，界面显示「时长待确认」 */
  durationSeconds: number | null
  mimeType: string | null
  /** 编辑并发校验版本 */
  version: number
  createdAt: string
  updatedAt: string
}

/** GET /list 响应：按讲解前/讲解后分组 */
export interface ExtraAudioGroupResponse {
  stageId: string
  /** 单条时长上限（秒），默认 60；前端据此提前提示，后端仍强制校验 */
  maxDurationSeconds: number
  before: ExtraAudioItem[]
  after: ExtraAudioItem[]
}

/** POST /create */
export interface CreateExtraAudioRequest {
  stageId: string
  attachmentId: string
  position: ExtraAudioPosition
  /** 不传时后端追加到该组末尾 */
  sortOrder?: number
  title?: string | null
  /** 1=启用 0=停用；缺省启用 */
  enabled?: number
}

/**
 * POST /update（表单式，只提交需要改动的字段）
 * `titleSpecified = true` 才会执行「清空标题」，否则空字符串被当作「不修改」。
 */
export interface UpdateExtraAudioRequest {
  id: string
  attachmentId?: string | null
  position?: ExtraAudioPosition
  sortOrder?: number
  title?: string | null
  titleSpecified?: boolean
  enabled?: number
  version?: number
}

/** POST /reorder */
export interface ReorderExtraAudioRequest {
  stageId: string
  position: ExtraAudioPosition
  items: { id: string; sortOrder: number }[]
}

/** POST /enabled */
export interface SetExtraAudioEnabledRequest {
  id: string
  enabled: number
  version?: number
}

/** POST /copy：把源节点配置复制到目标节点（多语言转换使用，只复制附件关联） */
export interface CopyExtraAudioRequest {
  sourceStageId: string
  targetStageId: string
  /** true=先清除目标节点已有配置再复制 */
  replace: boolean
}

/** 组内排序键，与 ExtraAudioPosition 一致 */
export interface ExtraAudioGroup {
  position: ExtraAudioPosition
  label: string
  items: ExtraAudioItem[]
}
