/** 导游 Guide — 对齐 schema GuideResponse / SaveGuideRequest / UpdateGuideRequest */

export interface GuideResponse {
  id?: string | null
  guideCode?: string | null
  name?: string | null
  avatarAttachmentId?: string | null
  avatarUrl?: string | null
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
  voiceSampleUrl?: string | null
  voiceStatus?: number | null
  isSystemDefault?: number | null
  narrationStyle?: string | null
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
  guideCode: string
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
  isSystemDefault: number
  narrationStyle: string
  status: number
  sortOrder: number
  version: number
  updatedAt: string | null
}

export type GuideDraft = Omit<GuideRecord, 'avatarUrl' | 'voiceSampleUrl' | 'updatedAt'> & {
  id?: string
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
