/** 导游 Guide — 对齐 schema GuideResponse / SaveGuideRequest / UpdateGuideRequest */

/** generationStatus：0 未开始 / 1 处理中 / 2 已完成 / 3 失败 */
export const GUIDE_GENERATION_STATUS = {
  NotStarted: 0,
  Processing: 1,
  Completed: 2,
  Failed: 3,
} as const

export type GuideGenerationStatusCode =
  (typeof GUIDE_GENERATION_STATUS)[keyof typeof GUIDE_GENERATION_STATUS]

export interface GuideResponse {
  id?: string | null
  guideCode?: string | null
  name?: string | null
  avatarAttachmentId?: string | null
  avatarUrl?: string | null
  description?: string | null
  semanticProfile?: string | null
  styleProfileJson?: string | null
  voiceStyle?: string | null
  voiceProvider?: string | null
  providerVoiceId?: string | null
  providerModel?: string | null
  voiceLanguage?: string | null
  speechRate?: number | null
  volume?: number | null
  pitch?: number | null
  voiceSampleAttachmentId?: string | null
  voiceSampleUrl?: string | null
  voiceStatus?: number | null
  generationRunId?: string | null
  generationStatus?: number | null
  generationProgress?: number | null
  generationError?: string | null
  isSystemDefault?: number | null
  narrationStyle?: string | null
  styleReferencePath?: string | null
  status?: number | null
  sortOrder?: number | null
  version?: number | null
  updatedAt?: string | null
}

export interface GuideResponseListTotalPageResult {
  list?: GuideResponse[] | null
  pageIndex?: number
  pageSize?: number
  total?: number
  totalPages?: number
}

export interface GuideListQuery {
  keyword?: string | null
  status?: number | null
  voiceStatus?: number | null
  pageIndex: number
  pageSize: number
}

export interface SaveGuideRequest {
  guideCode?: string | null
  name: string
  avatarAttachmentId?: string | null
  description?: string | null
  semanticProfile?: string | null
  voiceStyle?: string | null
  voiceProvider?: string | null
  providerVoiceId?: string | null
  providerModel?: string | null
  voiceLanguage?: string | null
  speechRate?: number | null
  volume?: number | null
  pitch?: number | null
  voiceSampleAttachmentId?: string | null
  voiceStatus?: number
  isSystemDefault?: number
  narrationStyle?: string | null
  styleReferencePath?: string | null
  status?: number
  sortOrder?: number
  replacementGuideId?: string | null
}

export interface UpdateGuideRequest extends SaveGuideRequest {
  id: string
  version?: number
}

export interface DeleteGuideRequest {
  id: string
  replacementGuideId?: string | null
}

/** POST create-with-material / update-with-material 异步返回 */
export interface GuideGenerationCreateResponse {
  guideId?: string | null
  materialId?: string | null
  runId?: string | null
  generationStatus?: number | null
  voiceStatus?: number | null
}

/** GET /api/TtsVoice/list */
export interface TtsVoiceResponse {
  id?: string | null
  provider?: string | null
  providerVoiceId?: string | null
  voiceName?: string | null
  description?: string[] | null
  voiceType?: string | null
  visibility?: string | null
  providerCreatedDate?: string | null
}

/** 列表 / 表单统一视图模型，主键一律 string */
export interface GuideRecord {
  id: string
  guideCode: string
  name: string
  avatarAttachmentId: string | null
  avatarUrl: string | null
  description: string
  semanticProfile: string
  voiceStyle: string
  voiceProvider: string
  providerVoiceId: string
  providerModel: string
  voiceLanguage: string
  speechRate: number | null
  volume: number | null
  pitch: number | null
  voiceSampleAttachmentId: string | null
  voiceSampleUrl: string | null
  voiceStatus: number
  generationRunId: string | null
  generationStatus: number
  generationProgress: number | null
  generationError: string | null
  isSystemDefault: number
  narrationStyle: string
  status: number
  sortOrder: number
  version: number
  updatedAt: string | null
  /** 语义生成未完成（同路线 isGenerating：列表仅刷新） */
  isGenerating: boolean
}

export type GuideDraft = Omit<
  GuideRecord,
  | 'id'
  | 'avatarUrl'
  | 'voiceSampleUrl'
  | 'updatedAt'
  | 'generationRunId'
  | 'generationStatus'
  | 'generationProgress'
  | 'generationError'
  | 'isGenerating'
> & {
  id?: string
  /** 表单预览用头像 URL（不提交） */
  avatarPreviewUrl?: string | null
  /**
   * 音色材料本地文件（mp3 / mp4），multipart 字段名 `material`
   * 对齐 create-with-material / update-with-material
   */
  materialFile?: File | null
  materialFileName?: string
  /**
   * 语义/语料资料本地文件（txt），multipart 字段名 `txtmaterial`
   * 对齐 create-with-material / update-with-material
   */
  txtMaterialFile?: File | null
  txtMaterialFileName?: string
}

export const GUIDE_STATUS_OPTIONS = [
  { value: 0, label: '全部状态' },
  { value: 1, label: '启用' },
  { value: 2, label: '停用' },
] as const

export const GUIDE_VOICE_STATUS_OPTIONS = [
  { value: 0, label: '全部音色' },
  { value: 1, label: '未配置' },
  { value: 2, label: '已就绪' },
  { value: 3, label: '异常' },
] as const

export const GUIDE_FORM_STATUS_OPTIONS = [
  { value: 1, label: '启用' },
  { value: 2, label: '停用' },
] as const

export const GUIDE_FORM_VOICE_STATUS_OPTIONS = [
  { value: 1, label: '未配置' },
  { value: 2, label: '已就绪' },
  { value: 3, label: '异常' },
] as const

export const GUIDE_GENERATION_STATUS_OPTIONS = [
  { value: GUIDE_GENERATION_STATUS.NotStarted, label: '未开始' },
  { value: GUIDE_GENERATION_STATUS.Processing, label: '处理中' },
  { value: GUIDE_GENERATION_STATUS.Completed, label: '已完成' },
  { value: GUIDE_GENERATION_STATUS.Failed, label: '失败' },
] as const

export const getGuideGenerationStatusMeta = (status: number) => {
  if (status === GUIDE_GENERATION_STATUS.Completed) {
    return { label: '已完成', className: 'bg-emerald-500/10 text-emerald-300' }
  }
  if (status === GUIDE_GENERATION_STATUS.Processing) {
    return { label: '处理中', className: 'bg-sky-500/10 text-sky-200' }
  }
  if (status === GUIDE_GENERATION_STATUS.Failed) {
    return { label: '失败', className: 'bg-rose-500/10 text-rose-200' }
  }
  return { label: '未开始', className: 'bg-slate-500/10 text-slate-300' }
}

/** 未完成生成：列表仅允许刷新（对齐路线 isGenerating） */
export const isGuideGenerationIncomplete = (status: number | null | undefined) =>
  Number(status ?? GUIDE_GENERATION_STATUS.NotStarted) !== GUIDE_GENERATION_STATUS.Completed
