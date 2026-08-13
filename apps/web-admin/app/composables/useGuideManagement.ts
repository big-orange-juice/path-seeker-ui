import { computed, reactive, shallowRef, toRefs, watch } from 'vue'
import { useApiClient } from '@/composables/useApiClient'
import {
  GUIDE_GENERATION_STATUS,
  isGuideGenerationIncomplete,
  type GuideDraft,
  type GuideGenerationCreateResponse,
  type GuideListQuery,
  type GuideRecord,
  type GuideResponse,
  type GuideResponseListTotalPageResult,
  type GuideStyleReferenceFile,
  type TtsVoiceResponse,
} from '@/types/guide'

const DEFAULT_PAGE_SIZE = 20
const DEFAULT_STATUS = 1
const DEFAULT_VOICE_STATUS = 1

const createEmptyPageResult = (): GuideResponseListTotalPageResult => ({
  list: [],
  pageIndex: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 0,
})

const normalizeText = (value: string | null | undefined) => String(value ?? '').trim()

const appendFormField = (
  formData: FormData,
  key: string,
  value: string | number | null | undefined,
) => {
  if (value === null || value === undefined) {
    return
  }
  const text = String(value).trim()
  if (!text && typeof value !== 'number') {
    return
  }
  formData.append(key, String(value))
}

/**
 * 后端常返回 `/Guide/voice-preview?guideId=`（base 已含 /api 时的相对路径），
 * 或完整 URL 中含 `/api/Guide/voice-preview`。
 * 转为 Nuxt 同源代理地址，供 `<audio>` 携带登录 cookie 播放。
 */
/** 从文件 URL 提取展示用文件名（用于风格参考 Tabs） */
export const extractStyleReferenceFileName = (fileUrl: string): string => {
  const raw = normalizeText(fileUrl)
  if (!raw) {
    return '未命名文件'
  }

  try {
    const pathname = new URL(raw, 'http://local.invalid').pathname
    const segment = pathname.split('/').filter(Boolean).pop() || ''
    const decoded = decodeURIComponent(segment).trim()
    if (decoded) {
      return decoded
    }
  } catch {
    // ignore parse errors
  }

  const fallback = raw.split(/[\\/]/).filter(Boolean).pop()
  return fallback?.trim() || raw
}

export const mapStyleReferenceFiles = (urls: string[] | null | undefined): GuideStyleReferenceFile[] => {
  if (!Array.isArray(urls)) {
    return []
  }

  const nameCount = new Map<string, number>()

  return urls
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .map((url) => {
      const baseName = extractStyleReferenceFileName(url)
      const seen = nameCount.get(baseName) ?? 0
      nameCount.set(baseName, seen + 1)
      // 同名文件追加序号，保证 Tab key/label 可区分
      const name = seen === 0 ? baseName : `${baseName} (${seen + 1})`
      return { url, name }
    })
}

export const resolveGuideVoiceSamplePlayUrl = (
  voiceSampleUrl: string | null | undefined,
  guideId: string | null | undefined,
): string | null => {
  const raw = normalizeText(voiceSampleUrl)
  const id = normalizeText(guideId)
  if (!raw) {
    return null
  }

  // 已是本站代理地址（Nuxt BFF，与后端 base 无关）
  if (raw.startsWith('/api/guide/voice-preview')) {
    return raw
  }

  // 公网直链可直接播；排除后端试听地址（base 含 /api 后相对路径为 /Guide/...）
  if (
    /^https?:\/\//i.test(raw)
    && !/\/(?:api\/)?Guide\/voice-preview/i.test(raw)
  ) {
    return raw
  }

  let resolvedGuideId = id
  try {
    const parsed = new URL(raw, 'http://local.invalid')
    const fromQuery = normalizeText(parsed.searchParams.get('guideId'))
    if (fromQuery) {
      resolvedGuideId = fromQuery
    }
  } catch {
    // ignore parse errors
  }

  if (!resolvedGuideId) {
    return null
  }

  return `/api/guide/voice-preview?guideId=${encodeURIComponent(resolvedGuideId)}`
}

export const mapGuideResponse = (item: GuideResponse): GuideRecord => {
  const generationStatus =
    typeof item.generationStatus === 'number'
      ? item.generationStatus
      : GUIDE_GENERATION_STATUS.Completed

  const id = String(item.id ?? '').trim()

  return {
    id,
    guideCode: item.guideCode ?? '',
    name: item.name ?? '',
    ownerAdminName: item.ownerAdminName ?? '',
    avatarAttachmentId: item.avatarAttachmentId ? String(item.avatarAttachmentId) : null,
    avatarUrl: item.avatarUrl ?? null,
    description: item.description ?? '',
    tagIds: Array.isArray(item.tagIds)
      ? item.tagIds.map((tagId) => String(tagId ?? '').trim()).filter(Boolean)
      : [],
    semanticProfile: item.semanticProfile ?? '',
    styleDescription: item.styleDescription ?? '',
    voiceStyle: item.voiceStyle ?? '',
    voiceProvider: item.voiceProvider ?? '',
    providerVoiceId: item.providerVoiceId ?? '',
    providerModel: item.providerModel ?? '',
    voiceLanguage: item.voiceLanguage ?? '',
    speechRate: item.speechRate ?? null,
    volume: item.volume ?? null,
    pitch: item.pitch ?? null,
    voiceSampleAttachmentId: item.voiceSampleAttachmentId
      ? String(item.voiceSampleAttachmentId)
      : null,
    voiceSampleUrl: resolveGuideVoiceSamplePlayUrl(item.voiceSampleUrl, id),
    voiceStatus: item.voiceStatus ?? DEFAULT_VOICE_STATUS,
    generationRunId: item.generationRunId ? String(item.generationRunId) : null,
    generationStatus,
    generationProgress:
      typeof item.generationProgress === 'number' ? item.generationProgress : null,
    generationError: item.generationError ?? null,
    isSystemDefault: item.isSystemDefault ?? 0,
    narrationStyle: item.narrationStyle ?? '',
    status: item.status ?? DEFAULT_STATUS,
    sortOrder: item.sortOrder ?? 0,
    version: item.version ?? 1,
    updatedAt: item.updatedAt ?? null,
    isGenerating: isGuideGenerationIncomplete(generationStatus),
  }
}

export const createEmptyGuideDraft = (): GuideDraft => ({
  guideCode: '',
  name: '',
  avatarAttachmentId: null,
  avatarPreviewUrl: null,
  description: '',
  tagIds: [],
  semanticProfile: '',
  voiceStyle: '',
  voiceProvider: '',
  providerVoiceId: '',
  providerModel: '',
  voiceLanguage: 'zh-CN',
  speechRate: 1,
  volume: 1,
  pitch: 1,
  voiceSampleAttachmentId: null,
  voiceSampleUrl: null,
  voiceStatus: DEFAULT_VOICE_STATUS,
  isSystemDefault: 0,
  narrationStyle: '',
  status: DEFAULT_STATUS,
  sortOrder: 0,
  version: 1,
  materialFile: null,
  materialFileName: '',
  materialFiles: [],
  txtMaterialFile: null,
  txtMaterialFileName: '',
})

export const createGuideDraftFromRecord = (record: GuideRecord): GuideDraft => ({
  id: record.id,
  guideCode: record.guideCode,
  name: record.name,
  avatarAttachmentId: record.avatarAttachmentId,
  avatarPreviewUrl: record.avatarUrl,
  description: record.description,
  tagIds: [...(record.tagIds ?? [])],
  semanticProfile: record.semanticProfile,
  voiceStyle: record.voiceStyle,
  voiceProvider: record.voiceProvider,
  providerVoiceId: record.providerVoiceId,
  providerModel: record.providerModel,
  voiceLanguage: record.voiceLanguage || 'zh-CN',
  speechRate: record.speechRate ?? 1,
  volume: record.volume ?? 1,
  pitch: record.pitch ?? 1,
  voiceSampleAttachmentId: record.voiceSampleAttachmentId,
  voiceSampleUrl: record.voiceSampleUrl,
  voiceStatus: record.voiceStatus,
  isSystemDefault: record.isSystemDefault,
  narrationStyle: record.narrationStyle,
  status: record.status,
  sortOrder: record.sortOrder,
  version: record.version,
  materialFile: null,
  materialFileName: '',
  materialFiles: [],
  txtMaterialFile: null,
  txtMaterialFileName: '',
})

const buildMaterialFormData = (draft: GuideDraft, mode: 'create' | 'edit') => {
  const formData = new FormData()
  const name = normalizeText(draft.name)

  if (mode === 'edit') {
    appendFormField(formData, 'Id', normalizeText(draft.id))
    appendFormField(formData, 'Version', draft.version || 1)
  }

  appendFormField(formData, 'GuideCode', normalizeText(draft.guideCode) || undefined)
  appendFormField(formData, 'Name', name)
  appendFormField(formData, 'AvatarAttachmentId', draft.avatarAttachmentId)
  appendFormField(formData, 'Description', draft.description)
  ;(draft.tagIds ?? []).forEach((tagId) => appendFormField(formData, 'TagIds', String(tagId)))
  appendFormField(formData, 'SemanticProfile', draft.semanticProfile)
  appendFormField(formData, 'VoiceStyle', draft.voiceStyle)
  appendFormField(formData, 'VoiceProvider', draft.voiceProvider)
  appendFormField(formData, 'ProviderVoiceId', draft.providerVoiceId)
  appendFormField(formData, 'ProviderModel', draft.providerModel)
  appendFormField(formData, 'VoiceLanguage', draft.voiceLanguage || 'zh-CN')
  appendFormField(formData, 'SpeechRate', draft.speechRate ?? 1)
  appendFormField(formData, 'Volume', draft.volume ?? 1)
  appendFormField(formData, 'Pitch', draft.pitch ?? 1)
  appendFormField(formData, 'VoiceSampleAttachmentId', draft.voiceSampleAttachmentId)
  appendFormField(formData, 'VoiceStatus', draft.voiceStatus || DEFAULT_VOICE_STATUS)
  appendFormField(formData, 'IsSystemDefault', draft.isSystemDefault ? 1 : 0)
  appendFormField(formData, 'NarrationStyle', draft.narrationStyle)
  appendFormField(formData, 'Status', draft.status || DEFAULT_STATUS)
  appendFormField(formData, 'SortOrder', Number.isFinite(draft.sortOrder) ? draft.sortOrder : 0)

  // multipart：material 可多份；txtmaterial 为讲解文风（可选，单文件）
  const materialList =
    Array.isArray(draft.materialFiles) && draft.materialFiles.length
      ? draft.materialFiles.filter((item): item is File => item instanceof File)
      : draft.materialFile instanceof File
        ? [draft.materialFile]
        : []

  for (const file of materialList) {
    formData.append('material', file, file.name)
  }

  if (draft.txtMaterialFile instanceof File) {
    formData.append('txtmaterial', draft.txtMaterialFile, draft.txtMaterialFile.name)
  }

  return formData
}

export const useGuideManagement = () => {
  const { request } = useApiClient()

  const filters = reactive({
    keyword: '',
    status: 0,
    voiceStatus: 0,
  })

  const pageIndex = shallowRef(1)
  const pageSize = shallowRef(DEFAULT_PAGE_SIZE)

  const queryPayload = computed<GuideListQuery>(() => ({
    keyword: filters.keyword.trim() || null,
    status: filters.status || null,
    voiceStatus: filters.voiceStatus || null,
    pageIndex: pageIndex.value,
    pageSize: pageSize.value,
  }))

  const data = shallowRef(createEmptyPageResult())
  const pending = shallowRef(false)
  const error = shallowRef<Error | null>(null)
  let requestVersion = 0

  const refresh = async () => {
    const currentVersion = ++requestVersion
    const payload = { ...queryPayload.value }
    pending.value = true
    error.value = null
    try {
      const result = await request<GuideResponseListTotalPageResult>('/api/guide/query', {
        query: {
          keyword: payload.keyword || undefined,
          status: payload.status ?? undefined,
          voiceStatus: payload.voiceStatus ?? undefined,
          pageIndex: payload.pageIndex,
          pageSize: payload.pageSize,
        },
      })
      if (currentVersion !== requestVersion) return
      data.value = result
    } catch (caught) {
      if (currentVersion !== requestVersion) return
      error.value = caught instanceof Error ? caught : new Error('导游数据加载失败。')
    } finally {
      if (currentVersion === requestVersion) pending.value = false
    }
  }

  watch(queryPayload, () => {
    if (import.meta.client) void refresh()
  }, { immediate: true })

  const rows = computed(() =>
    (data.value.list ?? [])
      .map(mapGuideResponse)
      .filter((item) => Boolean(item.id)),
  )

  const total = computed(() => data.value.total ?? 0)
  const totalPages = computed(() => data.value.totalPages ?? 0)

  watch(
    () => [filters.keyword, filters.status, filters.voiceStatus] as const,
    () => {
      pageIndex.value = 1
    },
  )

  const setPage = (next: number) => {
    pageIndex.value = Math.max(1, next)
  }

  const setPageSize = (next: number) => {
    pageSize.value = Math.max(1, next)
    pageIndex.value = 1
  }

  const resetFilters = () => {
    filters.keyword = ''
    filters.status = 0
    filters.voiceStatus = 0
    pageIndex.value = 1
  }

  const fetchGuideDetail = async (id: string) => {
    const detail = await request<GuideResponse | null>('/api/guide/detail', {
      query: { id },
    })
    return detail ? mapGuideResponse(detail) : null
  }

  /** 风格参考文件地址列表（按文件名拆 Tab） */
  const fetchGuideStyleReferenceFiles = async (id: string) => {
    const list = await request<string[]>('/api/guide/style-reference-files', {
      query: { id },
    })
    return mapStyleReferenceFiles(list)
  }

  /** 通过文件链接读取文本内容 */
  const fetchGuideStyleReferenceFileContent = async (fileUrl: string) => {
    const result = await request<{ text: string }>('/api/guide/style-reference-file-content', {
      query: { url: fileUrl },
    })
    return typeof result?.text === 'string' ? result.text : ''
  }

  const fetchTtsVoices = async (keyword?: string) => {
    const list = await request<TtsVoiceResponse[]>('/api/tts-voice/list', {
      query: {
        keyword: keyword?.trim() || undefined,
      },
    })
    return Array.isArray(list) ? list : []
  }

  /** 异步创建/更新：拿到返回即可关闭弹窗并刷新列表 */
  const saveGuide = async (draft: GuideDraft, mode: 'create' | 'edit') => {
    const name = normalizeText(draft.name)
    if (!name) {
      throw new Error('请填写导游名称。')
    }

    if (mode === 'edit' && !normalizeText(draft.id)) {
      throw new Error('缺少导游 ID。')
    }

    const formData = buildMaterialFormData(draft, mode)
    const endpoint =
      mode === 'edit' ? '/api/guide/update-with-material' : '/api/guide/create-with-material'

    const result = await request<GuideGenerationCreateResponse | null>(endpoint, {
      method: 'POST',
      body: formData,
    })

    await refresh()
    return result
  }

  const deleteGuide = async (id: string, replacementGuideId?: string | null) => {
    await request('/api/guide/delete', {
      method: 'POST',
      body: {
        id,
        replacementGuideId: replacementGuideId ? String(replacementGuideId).trim() || null : null,
      },
    })
    await refresh()
  }

  return {
    ...toRefs(filters),
    rows,
    pending,
    error,
    refresh,
    pageIndex,
    pageSize,
    total,
    totalPages,
    setPage,
    setPageSize,
    resetFilters,
    fetchGuideDetail,
    fetchGuideStyleReferenceFiles,
    fetchGuideStyleReferenceFileContent,
    fetchTtsVoices,
    saveGuide,
    deleteGuide,
    createEmptyGuideDraft,
    createGuideDraftFromRecord,
  }
}
