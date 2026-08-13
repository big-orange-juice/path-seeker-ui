export interface PronunciationPage<T> {
  items: T[] | null
  total: number
}

export interface PronunciationBatch {
  id: string | null
  scopeType: number
  museumId: string | null
  sourceType: string | null
  guideId: string | null
  status: number
  taskId: string | null
  candidateCount: number
  validCount: number
  conflictCount: number
  publishedCount: number
  rejectedCount: number
  unresolvedCount: number
  errorMessage: string | null
  createdAt: string
}

export interface PronunciationEntry {
  id: string | null
  batchId: string | null
  scopeType: number
  museumId: string | null
  phrase: string | null
  pronunciation: string | null
  category: string | null
  sourceType: number
  confidence: number | null
  evidenceJson: string | null
  validationJson: string | null
  status: number
  priority: number
  version: number
  remark: string | null
  createdAt: string
}

export interface AffectedNarration {
  stageId: string | null
  routeId: string | null
  routeTitle: string | null
  museumId: string | null
  museumName: string | null
  stageTitle: string | null
  guideId: string | null
  guideName: string | null
  pronunciationStatus: number
  audioStatus: number
  audioAttachmentId: string | null
}

export interface RegenerationResult {
  submittedCount: number
  items: Array<{
    stageId: string | null
    success: boolean
    taskId: string | null
    error: string | null
  }> | null
}

export interface PronunciationEntryDraft {
  scopeType: number
  museumId: string
  phrase: string
  pronunciation: string
  category: string
  priority: number
  remark: string
}

export interface PronunciationGenerationDraft {
  scopeType: number
  museumId: string
  sourceType: string
  guideId: string
  materialIds: string
  includeNarrations: boolean
  text: string
}

export const PRONUNCIATION_PATTERN = /^(\([a-züv]+[1-5]\))+$/

export const scopeLabel = (value: number) => value === 2 ? '博物馆' : '全局'

export const batchStatusLabel = (value: number) => ({
  0: '等待中', 1: '生成中', 2: '已完成', 3: '失败', 4: '已取消',
}[value] ?? `状态 ${value}`)

export const entryStatusLabel = (value: number) => ({
  0: '待校对', 1: '已发布', 2: '已拒绝', 3: '已停用', 4: '冲突',
}[value] ?? `状态 ${value}`)

export const pronunciationStatusLabel = (value: number) => ({
  0: '未解析', 1: '解析中', 2: '已完成', 3: '失败', 4: '已过期',
}[value] ?? `状态 ${value}`)
