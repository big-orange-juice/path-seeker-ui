import { computed, reactive, shallowRef, toRefs, watch } from 'vue'
import { useApiClient } from '@/composables/useApiClient'
import type {
  GuideDraft,
  GuideListQuery,
  GuideRecord,
  GuideResponse,
  GuideResponseListTotalPageResult,
  SaveGuideRequest,
  UpdateGuideRequest,
} from '@/types/guide'

const DEFAULT_PAGE_SIZE = 20
const DEFAULT_STATUS = 1
const DEFAULT_VOICE_STATUS = 1

const normalizeText = (value: string | null | undefined) => String(value ?? '').trim()

const toNullableText = (value: string | null | undefined) => {
  const text = normalizeText(value)
  return text || null
}

const toOptionalNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null
  }
  return Number(value)
}

export const mapGuideResponse = (item: GuideResponse): GuideRecord => ({
  id: String(item.id ?? '').trim(),
  guideCode: item.guideCode ?? '',
  name: item.name ?? '',
  avatarAttachmentId: item.avatarAttachmentId ? String(item.avatarAttachmentId) : null,
  avatarUrl: item.avatarUrl ?? null,
  description: item.description ?? '',
  semanticProfile: item.semanticProfile ?? '',
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
  voiceSampleUrl: item.voiceSampleUrl ?? null,
  voiceStatus: item.voiceStatus ?? DEFAULT_VOICE_STATUS,
  isSystemDefault: item.isSystemDefault ?? 0,
  narrationStyle: item.narrationStyle ?? '',
  status: item.status ?? DEFAULT_STATUS,
  sortOrder: item.sortOrder ?? 0,
  version: item.version ?? 1,
  updatedAt: item.updatedAt ?? null,
})

export const createEmptyGuideDraft = (): GuideDraft => ({
  guideCode: '',
  name: '',
  avatarAttachmentId: null,
  description: '',
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
  voiceStatus: DEFAULT_VOICE_STATUS,
  isSystemDefault: 0,
  narrationStyle: '',
  status: DEFAULT_STATUS,
  sortOrder: 0,
  version: 1,
})

export const createGuideDraftFromRecord = (record: GuideRecord): GuideDraft => ({
  id: record.id,
  guideCode: record.guideCode,
  name: record.name,
  avatarAttachmentId: record.avatarAttachmentId,
  description: record.description,
  semanticProfile: record.semanticProfile,
  voiceStyle: record.voiceStyle,
  voiceProvider: record.voiceProvider,
  providerVoiceId: record.providerVoiceId,
  providerModel: record.providerModel,
  voiceLanguage: record.voiceLanguage,
  speechRate: record.speechRate,
  volume: record.volume,
  pitch: record.pitch,
  voiceSampleAttachmentId: record.voiceSampleAttachmentId,
  voiceStatus: record.voiceStatus,
  isSystemDefault: record.isSystemDefault,
  narrationStyle: record.narrationStyle,
  status: record.status,
  sortOrder: record.sortOrder,
  version: record.version,
})

const toSavePayload = (draft: GuideDraft): SaveGuideRequest => ({
  guideCode: normalizeText(draft.guideCode),
  name: normalizeText(draft.name),
  avatarAttachmentId: toNullableText(draft.avatarAttachmentId),
  description: toNullableText(draft.description),
  semanticProfile: toNullableText(draft.semanticProfile),
  voiceStyle: toNullableText(draft.voiceStyle),
  voiceProvider: toNullableText(draft.voiceProvider),
  providerVoiceId: toNullableText(draft.providerVoiceId),
  providerModel: toNullableText(draft.providerModel),
  voiceLanguage: toNullableText(draft.voiceLanguage),
  speechRate: toOptionalNumber(draft.speechRate) ?? 1,
  volume: toOptionalNumber(draft.volume) ?? 1,
  pitch: toOptionalNumber(draft.pitch) ?? 1,
  voiceSampleAttachmentId: toNullableText(draft.voiceSampleAttachmentId),
  voiceStatus: draft.voiceStatus || DEFAULT_VOICE_STATUS,
  isSystemDefault: draft.isSystemDefault ? 1 : 0,
  narrationStyle: toNullableText(draft.narrationStyle),
  status: draft.status || DEFAULT_STATUS,
  sortOrder: Number.isFinite(draft.sortOrder) ? Number(draft.sortOrder) : 0,
})

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

  const { data, pending, error, refresh } = useAsyncData(
    'guide-management:list',
    () =>
      request<GuideResponseListTotalPageResult>('/api/guide/query', {
        query: {
          keyword: queryPayload.value.keyword || undefined,
          status: queryPayload.value.status ?? undefined,
          voiceStatus: queryPayload.value.voiceStatus ?? undefined,
          pageIndex: queryPayload.value.pageIndex,
          pageSize: queryPayload.value.pageSize,
        },
      }),
    {
      default: () => ({
        list: [],
        pageIndex: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        total: 0,
        totalPages: 0,
      }),
      watch: [queryPayload],
    },
  )

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

  const createGuide = async (draft: GuideDraft) => {
    const payload = toSavePayload(draft)
    const id = await request<string>('/api/guide/create', {
      method: 'POST',
      body: payload,
    })
    await refresh()
    return String(id || '').trim()
  }

  const updateGuide = async (draft: GuideDraft) => {
    const id = String(draft.id || '').trim()
    if (!id) {
      throw new Error('缺少导游 ID。')
    }

    const payload: UpdateGuideRequest = {
      ...toSavePayload(draft),
      id,
      version: draft.version || 1,
    }

    await request('/api/guide/update', {
      method: 'POST',
      body: payload,
    })
    await refresh()
    return id
  }

  const saveGuide = async (draft: GuideDraft, mode: 'create' | 'edit') => {
    if (mode === 'edit') {
      return updateGuide(draft)
    }
    return createGuide(draft)
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
    saveGuide,
    deleteGuide,
    createEmptyGuideDraft,
    createGuideDraftFromRecord,
  }
}
